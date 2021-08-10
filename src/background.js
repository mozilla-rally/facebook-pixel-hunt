/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled scripr to dist/background.js.

// Import the WebExtensions polyfill, for cross-browser compatibility.
import browser from "webextension-polyfill";

import { Rally, runStates } from "@mozilla/rally";
import { fbPixelListener } from './pixelHuntStudy';

// Initialize the Rally API.
const rally = new Rally(
  // The following constant is automatically provided by
  // the build system.
  __ENABLE_DEVELOPER_MODE__,
  // A sample callback with the study state.
  (newState) => {
    if (newState === runStates.RUNNING) {
      console.log("pixelHunt collection start");
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onCompleted.addListener(fbPixelListener, { urls: ["*://www.facebook.com/*"] });
    } else {
      console.log("pixelHunt collection pause");
      browser.webRequest.onCompleted.removeListener(fbPixelListener);
    }
  }
)

rally.rallyId().then(rallyId =>
  console.log(`Rally initialized with ID: ${rallyId}`)
).catch(err => console.error(err));

// FIXME since this is standalone, there is no way to see from the server if the study is active, so flip it on manually.
rally._resume();