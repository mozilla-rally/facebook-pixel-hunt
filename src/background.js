/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled scripr to dist/background.js.

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

let fbUrls = ["*://www.facebook.com/*"];
if (enableDevMode) {
  fbUrls = ["*://localhost/*"];
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

async function stateChangeCallback(newState) {
  switch (newState) {
    case (runStates.RUNNING):
      console.log(`Study running with Rally ID: ${rally.rallyId}`);
      console.info("pixelHunt collection start");
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onCompleted.addListener(fbPixelListener, { urls: fbUrls });

      await browser.storage.local.set({ "state": runStates.RUNNING });

      break;
    case (runStates.PAUSED):
      console.log(`Study paused with Rally ID: ${rally.rallyId}`);
      console.info("pixelHunt collection stop");

      browser.webRequest.onCompleted.removeListener(fbPixelListener);

      await browser.storage.local.set({ "state": runStates.PAUSED });

      break;
    case (runStates.ENDED):
      console.log(`Study ended with Rally ID: ${rally.rallyId}`);

      await browser.storage.local.set({ "ended": true });

      break;
    default:
      throw new Error(`Unknown study state: ${newState}`);
  }
}

// Initialize the Rally SDK.
const rally = new Rally({ enableDevMode, stateChangeCallback, rallySite, studyId, firebaseConfig, enableEmulatorMode });

// When in developer mode, open the options page with the playtest controls.
if (enableDevMode) {
  browser.storage.local.set({ "initialized": true }).then(browser.runtime.openOptionsPage());
}

// Take no further action until the rallyStateChange callback is called.