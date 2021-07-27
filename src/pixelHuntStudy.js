/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import PixelEvent from "../lib/PixelEvent";

export function initialize() {
    console.log("example module initialized.");
}

// responds to browser.webRequest.onCompleted events
// emits and stores a PixelEvent
export function fbPixelListener(details) {
    const url = new URL(details.url);
    if (url.hostname === 'www.facebook.com' && url.pathname.match(/^\/tr/)) {
      console.log("Pixel Found!");
      //console.log(details);
      //console.log(url.search)
      console.log("tab:", details.tabId)
      console.log("request:",details.requestId);
      const pixel = new PixelEvent(details);
      //console.log(JSON.stringify(pixel.attributes));
    } else {
      console.log("Inside Completion listener");
      console.log(url);
    }
}