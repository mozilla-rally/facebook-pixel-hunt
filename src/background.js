/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// This is the main background script for the study template.
// The build system will bundle dependencies into this script
// and output the bundled scripr to dist/background.js.

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/webext/plugins/encryption";

import * as rallyManagementMetrics from "../src/generated/rally.js";
import * as pixelHuntPings from "../src/generated/pings.js";

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
      console.info("pixelHunt collection start");
      // Listen for requests to facebook, and then grab the requests to the FB pixel.
      browser.webRequest.onCompleted.addListener(fbPixelListener, { urls: ["*://www.facebook.com/*"] });
      Glean.setUploadEnabled(!__ENABLE_DEVELOPER_MODE__);
    } else {
      console.info("pixelHunt collection pause");
      browser.webRequest.onCompleted.removeListener(fbPixelListener);
      Glean.setUploadEnabled(false);
    }
  }
)

rally.rallyId().then(rallyId => {
  console.info(`Rally initialized with ID: ${rallyId}`);
  // If we got to this point, then Rally is properly
  // initialized and we can flip collection on.
  const uploadEnabled = !__ENABLE_DEVELOPER_MODE__;
  Glean.initialize("rally-study-zero-one", uploadEnabled, {
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

  // FIXME since this is standalone, there is no way to see from the server if the study is active, so flip it on manually.
  rally._resume();

  // Send these regardless of the current study state.
  // TODO check if already sent using local storage
  rallyManagementMetrics.id.set(rallyId);
  pixelHuntPings.studyEnrollment.submit();

}).catch(err => console.error(err));