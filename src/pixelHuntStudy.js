/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import browser from "webextension-polyfill";
import PixelEvent from "../lib/PixelEvent";

// responds to browser.webRequest.onCompleted events
// emits and stores a PixelEvent
export async function fbPixelListener(details) {

  // Facebook pixels live at `*://www.facebook.com/tr/`
  const url = new URL(details.url);
  if (url.hostname === 'www.facebook.com' && url.pathname.match(/^\/tr/)) {
    console.log("Pixel Found!");
    // parse the details
    const pixel = new PixelEvent(details);
    // log the details.
    try {
      await browser.storage.local.set({ [pixel.key()]: pixel.toJSONString() });
    } catch {
      console.log("Failed to store");
    }

  } else {
    // Somehow the listener fired, but not for a facebook pixel?
    console.warn("Inside Completion listener");
    console.warn(url);
  }
}
