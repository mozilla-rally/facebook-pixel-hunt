/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled scripr to dist/background.js.

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/webext/plugins/encryption";

// @ts-ignore
import * as rallyManagementMetrics from "../src/generated/rally.js";
// @ts-ignore
import * as pixelHuntPings from "../src/generated/pings.js";

// Import the WebExtensions polyfill, for cross-browser compatibility.
import browser from "webextension-polyfill";

// @ts-ignore
import { Rally, runStates } from "@mozilla/rally";
// @ts-ignore
import { fbPixelListener } from './pixelHuntStudy.js';

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

// @ts-ignore
const devMode = !!__ENABLE_DEVELOPER_MODE__;

// Initialize the Rally API.
const rally = new Rally(
  // The following constant is automatically provided by
  // the build system.
  devMode,
  // A sample callback with the study state.
  (newState: any) => {
    if (newState === runStates.RUNNING) {
      console.info("pixelHunt collection start");
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onCompleted.addListener(fbPixelListener, { urls: ["*://www.facebook.com/*"] });
      Glean.setUploadEnabled(!devMode);
    } else {
      console.info("pixelHunt collection pause");
      browser.webRequest.onCompleted.removeListener(fbPixelListener);
      Glean.setUploadEnabled(false);
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
