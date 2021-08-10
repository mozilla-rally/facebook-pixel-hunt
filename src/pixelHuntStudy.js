/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import PixelEvent from "../lib/PixelEvent";
import localforage from "localforage";

export function initialize() {
    console.log("example module initialized.");
}

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
        await localforage.setItem(pixel.key(), pixel.dump());
      } catch {
        console.log("Failed to store");
      }
      
    } else {
      // Somehow the listener fired, but not for a facebook pixel?
      console.warn("Inside Completion listener");
      console.warn(url);
    }
}
