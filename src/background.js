/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled scripr to dist/background.js.

import browser from "webextension-polyfill";

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/plugins/encryption";

import * as rallyManagementMetrics from "../src/generated/rally.js";
import * as pixelHuntPings from "../src/generated/pings.js";

// Import the WebExtensions polyfill, for cross-browser compatibility.
// Note that Rally and WebScience currently only support Firefox.
// import { browser } from "webextension-polyfill";

// Import the Rally API.
import { Rally, runStates } from "@mozilla/rally";
import { fbPixelListener } from './pixelHuntStudy';

// Import the WebScience API.

// Developer mode runs locally and does not use the Firebase server.
// Data is collected locally, and an options page is provided to export it.
// eslint-disable-next-line no-undef
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);
// Emulator mode connects to the Firebase emulators. Note that the Firebase
// config below must match.
// eslint-disable-next-line no-undef
const enableEmulatorMode = Boolean(__ENABLE_EMULATOR_MODE__);

const fbUrls = ["*://www.facebook.com/*"];
if (enableDevMode) {
  fbUrls.push("*://localhost/*");
}

// The Rally-assigned Study ID.
let studyId = "facebook-pixel-hunt";

// The website hosting the Rally UI.
let rallySite = "https://stage.rally-web.nonprod.dataops.mozgcp.net/";

// The current Firebase configuration.
let firebaseConfig = {
  "apiKey": "AIzaSyAj3z6_cRdiBzwTuVzey6sJm0hVDVBSrDg",
  "authDomain": "moz-fx-data-rall-nonprod-ac2a.firebaseapp.com",
  "projectId": "moz-fx-data-rall-nonprod-ac2a",
  "storageBucket": "moz-fx-data-rall-nonprod-ac2a.appspot.com",
  "messagingSenderId": "451372671583",
  "appId": "1:451372671583:web:eeb61e7d7c8ec898f5b1ea",
  "functionsHost": "https://us-central1-moz-fx-data-rall-nonprod-ac2a.cloudfunctions.net"
}

// Overrides for dev mode - use local emulators with "exampleStudy1" as study ID.
if (enableEmulatorMode) {
  studyId = "exampleStudy1";
  rallySite = "http://localhost:3000";
  firebaseConfig = {
    "apiKey": "abc123",
    "authDomain": "demo-rally.firebaseapp.com",
    "projectId": "demo-rally",
    "storageBucket": "demo-rally.appspot.com",
    "messagingSenderId": "abc123",
    "appId": "1:123:web:abc123",
    "functionsHost": "http://localhost:5001"
  }
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
    new PingEncryptionPlugin({
      "crv": "P-256",
      "kid": "rally-study-zero-one",
      "kty": "EC",
      "x": "-a1Ths2-TNF5jon3MlfQXov5lGA4YX98aYsQLc3Rskg",
      "y": "Cf8PIvq_CV46r_DBdvAc0d6aN1WeWAWKfiMtwkpNGqw"
    })
  ]
});

async function stateChangeCallback(newState) {
  switch (newState) {
    case (runStates.RUNNING): {
      console.log(`Study running with Rally ID: ${rally.rallyId}`);

      const storage = await browser.storage.local.get("enrolled");
      if (storage.enrolled !== true) {
        console.debug("Not enrolled, sending ping and recording enrollment.");
        rallyManagementMetrics.id.set(rally.rallyId);
        pixelHuntPings.studyEnrollment.submit();

        browser.storage.local.set({
          enrolled: true,
        });
      }

      Glean.setUploadEnabled(true);

      console.info("pixelHunt collection start");
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onCompleted.addListener(fbPixelListener, { urls: fbUrls });
      await browser.storage.local.set({ "state": runStates.RUNNING });

      break;
    }
    case (runStates.PAUSED): {
      Glean.setUploadEnabled(false);

      console.info("pixelHunt collection pause");
      browser.webRequest.onCompleted.removeListener(fbPixelListener);
      await browser.storage.local.set({ "state": runStates.PAUSED });

      break;
    }
  }
}

// Initialize the Rally SDK.
const rally = new Rally({ enableDevMode, stateChangeCallback, rallySite, studyId, firebaseConfig, enableEmulatorMode });

// When in developer mode, open the options page with the playtest controls.
if (enableDevMode) {
  browser.storage.local.set({ "initialized": true }).then(() =>
    browser.runtime.openOptionsPage()
  );
}
