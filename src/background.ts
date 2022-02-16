/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled script to dist/background.js.

// Import the WebExtensions polyfill, for cross-browser compatibility.
// Note that Rally and WebScience currently only support Firefox.
import browser from "webextension-polyfill";

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/plugins/encryption";

import * as rallyManagementMetrics from "../src/generated/rally.js";
import * as pixelHuntPings from "../src/generated/pings.js";

// Import the Rally API.
import { Rally, runStates } from "@mozilla/rally";
import { fbPixelListener, pageDataListener, pageVisitStartListener, pageVisitStopListener } from './pixelHuntStudy';
// @ts-ignore
import * as webScience from "@mozilla/web-science";

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
}

const fbUrls = ["*://www.facebook.com/*"];
if (enableDevMode) {
  fbUrls.push("*://localhost/*");
}

// This function will be called when the study state changes. By default,
// a study starts "paused". If a user opts-in to a particular study, then the
// state will change to "started".
//
// The study state may change at any time (for example, the server may choose to pause a particular study).
// Studies should stop data collection and try to unload as much as possible when in "paused" state.

Glean.initialize("rally-markup-fb-pixel-hunt", !enableDevMode, {
  debug: { logPings: enableDevMode },
  plugins: [
    new PingEncryptionPlugin(publicKey)
  ]
});


/**
 * Callback for handling changes in study running state from the Rally SDK.
 *
 * Studies which are running should install listeners and start data collection,
 * and studies which are paused should stop data collection and remove listeners.
 *
 * @param newState {String} - either "resume" or "pause", representing the new state.
 */
async function stateChangeCallback(newState: String) {
  switch (newState) {
    case (runStates.RUNNING): {
      // The all-0 Rally ID indicates developer mode, in case data is accidentally sent.
      let rallyId = enableDevMode ? "00000000-0000-0000-0000-000000000000" : rally._rallyId;

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

      await browser.storage.local.set({ "state": runStates.RUNNING });

      break;
    }
    case (runStates.PAUSED): {
      console.info("Facebook Pixel Hunt data collection pause");

      browser.webRequest.onBeforeRequest.removeListener(fbPixelListener);

      webScience.pageNavigation.onPageData.removeListener(pageDataListener);
      webScience.pageManager.onPageVisitStart.removeListener(pageVisitStartListener);
      webScience.pageManager.onPageVisitStop.removeListener(pageVisitStopListener);

      await browser.storage.local.set({ "state": runStates.PAUSED });

      break;
    }
  }
}

const firebaseConfig = {
  apiKey: "abc123",
  authDomain: "demo-rally.firebaseapp.com",
  projectId: "demo-rally",
  storageBucket: "demo-rally.appspot.com",
  messagingSenderId: "abc123",
  appId: "1:123:web:abc123",
  functionsHost: "http://localhost:5001",
};

const enableEmulatorMode = true;
const rallySite = "http://localhost:3000";
const studyId = "facebookPixelHunt";

// Initialize the Rally SDK.p
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
    if (m.data.state === "resume") {
      stateChangeCallback(runStates.RUNNING)
    } else if (m.data.state === "pause") {
      stateChangeCallback(runStates.PAUSED)
    } else {
      throw new Error(`Unknown state: ${m.data.state}`);
    }
  });

  browser.storage.local.set({ "state": runStates.PAUSED }).then(() =>
    browser.storage.local.set({ "initialized": true }).then(() =>
      browser.runtime.openOptionsPage()
    )
  );
}