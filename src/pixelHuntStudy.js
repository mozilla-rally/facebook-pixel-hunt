/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as pixelHuntPings from "../src/generated/pings.js";
import * as facebookPixel from "../src/generated/facebookPixel.js";

const fbHostname = ["www.facebook.com"];
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);

if (enableDevMode) {
  fbHostname.push("localhost");
}
// responds to browser.webRequest.onCompleted events
export async function fbPixelListener(details) {
  console.debug("fbPixelListener fired:", details);
  // Facebook pixels live at `*://www.facebook.com/tr/`
  const url = new URL(details.url);
  if (fbHostname.includes(url.hostname) && url.pathname.match(/^\/tr/)) {
    console.debug("FB pixel caught, saving:", url);
    facebookPixel.url.setUrl(url);

    if (!enableDevMode) {
      pixelHuntPings.fbpixelhuntEvent.submit();
    }
  }
}