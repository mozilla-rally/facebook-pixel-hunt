/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export function initialize() {
    console.log("example module initialized.");
}

export function fbPixelListener(details) {
    const url = new URL(details.url);
    if (url.hostname === 'www.facebook.com' && url.pathname.match(/^\/tr/)) {
      console.log("Pixel Found!");
      //console.log(details);
      console.log(url.search)
      url.searchParams.forEach((v,k) => { console.log(k,":", v); } );
    } else {
      console.log("Inside Completion listener");
      console.log(url);
    }
}