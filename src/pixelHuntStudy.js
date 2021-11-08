/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as pixelHuntPings from "../src/generated/pings.js";
import * as facebookPixel from "../src/generated/facebookPixel.js";
import browser from "webextension-polyfill";

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

    // Look for the presence of Facebook authentication cookies.
    // https://www.facebook.com/policy/cookies/
    const cookies = await browser.cookies.getAll({ domain: "facebook.com" });
    // c_user should be set if the user has ever logged in.
    const has_c_user = Boolean(cookies.filter(a => a.name === "c_user")[0]);
    const has_xs = Boolean(cookies.filter(a => a.name === "xs")[0]);

    facebookPixel.hasFacebookLoginCookies.set(has_c_user && has_xs);

    if (enableDevMode) {
      // FIXME it would be preferable to get this straight from Glean, but unfortunately it does not seem to be
      // holding more than one ping at a time in its local storage when submission is disabled.
      // TODO file issue to follow up.
      const testPings = (await browser.storage.local.get("testPings"))["testPings"];
      // If this storage object already exists, append to it.
      if (Array.isArray(testPings)) {
        testPings.push({ "url": "" + url, "hasFacebookLoginCookies": Boolean(has_c_user && has_xs) });

        await browser.storage.local.set({ testPings });
      } else {
        await browser.storage.local.set({ "testPings": [] });
      }
    } else {
      pixelHuntPings.fbpixelhuntEvent.submit();
    }
  }
}