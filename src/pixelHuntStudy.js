/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import browser from "webextension-polyfill";
import PixelEvent from "../lib/PixelEvent";

let fbHostname = "www.facebook.com";
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);

if (enableDevMode) {
  fbHostname = "localhost";
}

// responds to browser.webRequest.onCompleted events
// emits and stores a PixelEvent
export async function fbPixelListener(details) {

  // Facebook pixels live at `*://www.facebook.com/tr/`
  const url = new URL(details.url);
  if (url.hostname === fbHostname && url.pathname.match(/^\/tr/)) {
    console.log("Pixel Found!");
    // parse the details
    const pixel = new PixelEvent(details);

    if (enableDevMode) {
      if (pixel.attributes) {
        console.debug("Storing pixel:", pixel);
        await browser.storage.local.set({ [pixel.key()]: pixel.attributes });
      }
    }

  } else {
    // Somehow the listener fired, but not for a facebook pixel?
    console.warn("Inside Completion listener");
    console.warn(url);
  }
}
