/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import browser from "webextension-polyfill";
import PixelEvent from "../lib/PixelEvent";

import * as pixelHuntPings from "../src/generated/pings.js";
import * as trackingPixel from "../src/generated/trackingpixel.js";

// responds to browser.webRequest.onCompleted events
// emits and stores a PixelEvent
export async function fbPixelListener(details) {

  // Facebook pixels live at `*://www.facebook.com/tr/`
  const url = new URL(details.url);
  if (url.hostname === 'www.facebook.com' && url.pathname.match(/^\/tr/)) {
    const pixel = new PixelEvent(details);
    try {
      const pixelId = pixel.key();
      trackingPixel.id.set(pixelId);
      pixelHuntPings.fbpixelhuntEvent.submit();

      if (__ENABLE_DEVELOPER_MODE__) {
        console.debug(pixelId, pixel.toJSONString());
        await browser.storage.local.set({ [pixelId]: pixel.toJSONString() });
      }
    } catch {
      console.error("Failed to store");
    }

  } else {
    throw new Error(`fbPixelListener fired for non-facebook site: ${url.href}`);
  }
}
