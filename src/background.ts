/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled script to dist/background.js.

import type { Configuration } from "@mozilla/glean/dist/types/core/config";
import PingEncryptionPlugin from "@mozilla/glean/plugins/encryption";
import Glean, { Uploader, UploadResult, UploadResultStatus } from "@mozilla/glean/webext";
import { Dexie } from "dexie";

// Import the Rally API.
import { Rally, RunStates } from "@mozilla/rally-sdk";

// @ts-ignore
import * as webScience from "@mozilla/web-science";

// Import the WebExtensions polyfill, for cross-browser compatibility.
import browser from "webextension-polyfill";
import * as pixelHuntPings from "../src/generated/pings.js";
import * as rallyManagementMetrics from "../src/generated/rally.js";
import { fbPixelListener, pageDataListener, pageVisitStartListener, pageVisitStopListener } from './pixelHuntStudy';


// Developer mode runs locally and does not use the Firebase server.
// Data is collected locally, and an options page is provided to export it.
// @ts-ignore eslint-disable-next-line no-undef
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);

const publicKey = {
  "crv": "P-256",
  "kid": "rally-markup-fb-pixel-hunt",
  "kty": "EC",
  "x": "qdFmHybW2J4-8Nfms4cMKKNjvJ7WePqR4FYP_g8e8NE",
  "y": "iuDJdnd33MrW7Ow8TvddZut8-jyJXad3RoJS_t7UDps"
};

const fbUrls = ["*://www.facebook.com/*"];
if (enableDevMode) {
  fbUrls.push("*://localhost/*");
}

// TODO move to dynamic import, and only load in dev mode.
import pako from "pako";

class GetPingsUploader extends Uploader {
  async post(url: string, body: Uint8Array): Promise<UploadResult> {
    const ping = JSON.parse(new TextDecoder().decode(pako.inflate(body)));

    console.debug("Dev mode, storing glean ping instead of sending:", ping, url);

    const tableName = url.split("/")[5];
    const documentId = url.split("/")[7];
    console.debug("tableName:", tableName);

    const db = new Dexie("pixelhunt");

    const columns = [];
    const entries = {};
    for (const metric of Object.keys(ping.metrics)) {
      for (const [columnName, value] of Object.entries(ping.metrics[metric])) {
        const validColumnName = columnName.replace(".", "_");
        columns.push(validColumnName);
        entries[validColumnName] = value;
      }
    }

    console.debug("setting stores:", { [tableName]: columns.join() });
    // FIXME get this from glean yaml
    db.version(1).stores({
      "fbpixelhunt-journey": "id,rally_id,user_journey_page_visit_start_date_time,user_journey_page_visit_stop_date_time,user_journey_attention_duration,user_journey_page_id,user_journey_url",
      "fbpixelhunt-pixel": "id,rally_id,facebook_pixel_has_facebook_login_cookies,facebook_pixel_pixel_page_id,facebook_pixel_url",
      "study-enrollment": "id,rally_id"
    });

    await db.open();

    console.debug("using", tableName, "to store:", entries);
    await db.table(tableName).put({ id: documentId, ...entries });

    // Tell Glean upload went fine. Glean will then clear the ping from temporary storage.
    return {
      status: 200,
      // @ts-ignore
      result: UploadResultStatus.Success
    };
  }
}

if (enableDevMode) {
  console.debug("init glean");
  Glean.initialize("rally-markup-fb-pixel-hunt", true, {
    debug: { logPings: true },
    httpClient: new GetPingsUploader(),
  } as unknown as Configuration);

} else {
  Glean.initialize("rally-markup-fb-pixel-hunt", true, {
    debug: { logPings: false },
    plugins: [
      new PingEncryptionPlugin(publicKey)
    ]
  } as unknown as Configuration);
}

/**
 * Callback for handling changes in study running state from the Rally SDK.
 *
 * Studies which are running should install listeners and start data collection,
 * and studies which are paused should stop data collection and remove listeners.
 *
 * @param newState {RunStates} - either "resume" or "pause", representing the new state.
 */
async function stateChangeCallback(newState: RunStates) {
  switch (newState) {
    case RunStates.Running: {
      // The all-0 Rally ID indicates developer mode, in case data is accidentally sent.
      let rallyId = enableDevMode ? "00000000-0000-0000-0000-000000000000" : rally.rallyId;

      // The all-1 Rally ID means that there was an error with the Rally ID.
      if (!rallyId) {
        rallyId = "11111111-1111-1111-1111-111111111111";
      }
      console.info(`Study running with Rally ID: ${rallyId}`);

      const storage = await browser.storage.local.get("enrolled");
      if (storage.enrolled !== true) {
        console.info("Recording enrollment.");
        rallyManagementMetrics.id.set(rallyId);
        pixelHuntPings.studyEnrollment.submit();

        browser.storage.local.set({
          enrolled: true,
        });
      }

      console.info("Facebook Pixel Hunt data collection start");

      // Listen for requests to Facebook, and then report on the requests to the FB pixel.
      browser.webRequest.onBeforeRequest.addListener(fbPixelListener, { urls: fbUrls }, ["requestBody"]);

      // Listen for page navigation ("user journey") events.
      webScience.pageNavigation.onPageData.addListener(pageDataListener, { matchPatterns: ["<all_urls>"] });

      // Listen for page visit start an stop, so we can match up FB Pixels with user journeys.
      webScience.pageManager.onPageVisitStart.addListener(pageVisitStartListener);
      webScience.pageManager.onPageVisitStop.addListener(pageVisitStopListener);

      await browser.storage.local.set({ "state": RunStates.Running });

      break;
    }

    case RunStates.Paused: {
      console.info("Facebook Pixel Hunt data collection pause");

      browser.webRequest.onBeforeRequest.removeListener(fbPixelListener);

      webScience.pageNavigation.onPageData.removeListener(pageDataListener);
      webScience.pageManager.onPageVisitStart.removeListener(pageVisitStartListener);
      webScience.pageManager.onPageVisitStop.removeListener(pageVisitStopListener);

      await browser.storage.local.set({ "state": RunStates.Paused });

      break;
    }
  }
}

const studyId = "facebookPixelHunt";

/**
 * Firebase config for production.
 */
const firebaseConfig = {
  "apiKey": "AIzaSyAv_gSjNRMbEq3BFCNHPn0soXMCx2IxLeM",
  "authDomain": "moz-fx-data-rally-w-prod-dfa4.firebaseapp.com",
  "projectId": "moz-fx-data-rally-w-prod-dfa4",
  "storageBucket": "moz-fx-data-rally-w-prod-dfa4.appspot.com",
  "messagingSenderId": "982322764946",
  "appId": "1:982322764946:web:f9b6aea488cebde47ada4b",
  "functionsHost": "https://us-central1-moz-fx-data-rally-w-prod-dfa4.cloudfunctions.net"
}

const rallySite = "https://members.rally.mozilla.org/studies";
const enableEmulatorMode = false;

// Initialize the Rally SDK.
const rally = new Rally({
  enableDevMode,
  stateChangeCallback,
  rallySite,
  studyId,
  firebaseConfig,
  enableEmulatorMode,
});

// When in developer mode, open the options page with the playtest controls.
if (enableDevMode) {
  browser.runtime.onMessage.addListener((m, s) => {
    if (!("type" in m && m.type.startsWith("rally-sdk"))) {
      // Only listen for messages from the rally-sdk.
      return;
    }

    if (m.data.state === "Running") {
      stateChangeCallback(RunStates.Running);
    } else if (m.data.state === "Paused") {
      stateChangeCallback(RunStates.Paused);
    } else {
      throw new Error(`Unknown state: ${m.data.state}`);
    }
  });

  browser.storage.local.set({ "initialized": true }).then(() => {

    // Run by default in playtest/dev mode.
    stateChangeCallback(RunStates.Running);
    browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage())
  });
}
