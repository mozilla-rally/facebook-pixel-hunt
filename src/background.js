/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled script to dist/background.js.

import browser from "webextension-polyfill";

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/plugins/encryption";

import * as rallyManagementMetrics from "../src/generated/rally.js";
import * as pixelHuntPings from "../src/generated/pings.js";
import * as userJourney from "../src/generated/userJourney.js";

// Import the WebExtensions polyfill, for cross-browser compatibility.
// Note that Rally and WebScience currently only support Firefox.
// import { browser } from "webextension-polyfill";

// Import the Rally API.
import { Rally, runStates } from "@mozilla/rally";
import { fbPixelListener } from './pixelHuntStudy';
import * as webScience from "@mozilla/web-science";

// Developer mode runs locally and does not use the Firebase server.
// Data is collected locally, and an options page is provided to export it.
// eslint-disable-next-line no-undef
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);

const publicKey = {
  "crv": "P-256",
  "kid": "rally-study-zero-one",
  "kty": "EC",
  "x": "-a1Ths2-TNF5jon3MlfQXov5lGA4YX98aYsQLc3Rskg",
  "y": "Cf8PIvq_CV46r_DBdvAc0d6aN1WeWAWKfiMtwkpNGqw"
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

// Leave upload disabled initially, this will be enabled/disabled by the study as it is allowed to run.
const uploadEnabled = false;
Glean.initialize("rally-study-facebook-pixel-hunt", uploadEnabled, {
  debug: { logPings: true },
  plugins: [
    new PingEncryptionPlugin(publicKey)
  ]
});

async function stateChangeCallback(newState) {
  switch (newState) {
    case ("resume"): {
      const rallyId = enableDevMode ? "00000000-0000-0000-0000-000000000000" : rally._rallyId;
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

      Glean.setUploadEnabled(!enableDevMode);

      console.info("Facebook Pixel Hunt data collection start");
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onBeforeRequest.addListener(fbPixelListener, { urls: fbUrls }, ["requestBody"]);

      // Listen for page navigation events.
      this.pageDataListener = async (pageData) => {
        if (enableDevMode) {
          // FIXME it would be preferable to get this straight from Glean, but unfortunately it does not seem to be
          // holding more than one ping at a time in its local storage when submission is disabled.
          // TODO file issue to follow up.

          const pageNavigationPings = (await browser.storage.local.get("pageNavigationPings"))["pageNavigationPings"];
          // If this storage object already exists, append to it.
          const result = pageData;
          if (Array.isArray(pageNavigationPings)) {
            pageNavigationPings.push(result);

            await browser.storage.local.set({ pageNavigationPings });
          } else {
            await browser.storage.local.set({ "pageNavigationPings": [result] });
          }
        } else {
          userJourney.pageId.set(pageData.pageId);
          userJourney.attentionDuration.set(pageData.attentionDuration);
          userJourney.audioDuration.set(pageData.audioDuration);
          userJourney.maxRelativeScrollDepth.set(pageData.maxRelativeScrollDepth);
          userJourney.pageVisitStartTime.set(pageData.pageVisitStartTime);
          userJourney.pageVisitStopTime.set(pageData.pageVisitStopTime);
          userJourney.referrer.setUrl(pageData.referrer);
          userJourney.url.setUrl(pageData.url);

          pixelHuntPings.fbpixelhuntJourney.submit();
        }
      }

      webScience.pageNavigation.onPageData.addListener(this.pageDataListener, { matchPatterns: ["<all_urls>"] });

      // Record page visit start/stop, so we can match up facebook pixel events.
      webScience.pageManager.onPageVisitStart.addListener(async (details) => {
        const pageVisits = (await browser.storage.local.get("pageVisits"))["pageVisits"];
        // If this storage object already exists, append to it.
        if (Array.isArray(pageVisits)) {
          pageVisits.push(details);

          await browser.storage.local.set({ pageVisits });
        } else {
          await browser.storage.local.set({ "pageVisits": [details] });
        }
      });

      webScience.pageManager.onPageVisitStop.addListener(async (details) => {
        let pageVisits = (await browser.storage.local.get("pageVisits"))["pageVisits"];
        pageVisits = pageVisits.filter(a => a.pageId !== details.pageId)
        await browser.storage.local.set({ pageVisits });
      });

      await browser.storage.local.set({ "state": runStates.RUNNING });

      break;
    }
    case ("pause"): {
      Glean.setUploadEnabled(false);

      console.info("Facebook Pixel Hunt data collection pause");
      browser.webRequest.onBeforeRequest.removeListener(fbPixelListener);
      await browser.storage.local.set({ "state": runStates.PAUSED });

      break;
    }
  }
}

const schemaNamespace = "facebook-pixel-hunt";
// Initialize the Rally SDK.
const rally = new Rally();
rally.initialize(schemaNamespace, publicKey, enableDevMode, stateChangeCallback).then(() => {
  // The Rally Core Add-on expects the extension to automatically start, unlike the new Web Platform SDK.
  stateChangeCallback("resume")

  // When in developer mode, open the options page with the playtest controls.
  if (enableDevMode) {
    browser.runtime.onMessage.addListener((m, s) => {
      if (m.data.state === "resume") {
        stateChangeCallback("resume")
      } else if (m.data.state === "pause") {
        stateChangeCallback("pause")
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
});