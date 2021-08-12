/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled scripr to dist/background.js.

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/webext/plugins/encryption";

import * as rallyManagementMetrics from "../src/generated/rally";
import * as pixelHuntPings from "../src/generated/pings";

// Import the WebExtensions polyfill, for cross-browser compatibility.
import browser from "webextension-polyfill";

// @ts-ignore FIXME rally-sdk is written in typescript but only publishes a JS package.
import { Rally, runStates } from "@mozilla/rally";

import { fbPixelListener } from './pixelHuntStudy';

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

// @ts-ignore The following constant is automatically provided by
// the build system.
const devMode = !!__ENABLE_DEVELOPER_MODE__;

// Initialize the Rally API.
const rally = new Rally(
  devMode,
  // A sample callback with the study state.
  (newState: any) => {
    if (newState === runStates.RUNNING) {
      console.info("pixelHunt collection start");
      if (!devMode) {
        Glean.setUploadEnabled(true);
      }
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onCompleted.addListener(fbPixelListener, { urls: ["*://www.facebook.com/*"] });
    } else {
      console.info("pixelHunt collection pause");
      if (!devMode) {
        Glean.setUploadEnabled(false);
      }
      browser.webRequest.onCompleted.removeListener(fbPixelListener);
    }
  }
)

rally.rallyId().then(async (rallyId: string) => {
  console.info(`Rally initialized with ID: ${rallyId}`);

  const storage = await browser.storage.local.get("enrolled");
  if (storage.enrolled !== true) {
    console.debug("Not enrolled, sending ping and recording enrollment.");
    rallyManagementMetrics.id.set(rallyId);
    pixelHuntPings.studyEnrollment.submit();

    browser.storage.local.set({
      enrolled: true,
    });
  }

  // FIXME since this is standalone, there is no way to see from the server if the study is active, so flip it on manually.
  rally._resume();
});
