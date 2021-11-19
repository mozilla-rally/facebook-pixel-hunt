/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import browser from "webextension-polyfill";

import * as pixelHuntPings from "../src/generated/pings.js";
import * as facebookPixel from "../src/generated/facebookPixel.js";
// import * as pageNavigation from "../src/generated/pageNavigations.js";

const fbHostname = ["www.facebook.com"];
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);

if (enableDevMode) {
  fbHostname.push("localhost");
}
// responds to browser.webRequest.onCompleted events
export async function fbPixelListener(details) {
  // Facebook pixels live at `*://www.facebook.com/tr/`
  const url = new URL(details.url);
  let originUrl = undefined;
  if (details.originUrl) {
    originUrl = new URL(details.originUrl);
  }
  const tabId = details.tabId;

  if (fbHostname.includes(url.hostname) && url.pathname.match(/^\/tr/)) {
    facebookPixel.url.setUrl(url);

    // Pixels may be either HTTP GET requests for an image, or a POST from JS.
    // If a POST is detected, collect the form data submitted as well.
    let formData;
    if (details.method === "POST") {
      if ("requestBody" in details && "formData" in details.requestBody) {
        const rawFormData = details.requestBody.formData;
        formData = new URLSearchParams(rawFormData).toString();
        // facebookPixel.formData.set(formData);
      }
    }

    // Look for the presence of Facebook authentication cookies.
    // https://www.facebook.com/policy/cookies/
    const cookies = await browser.cookies.getAll({ domain: "facebook.com" });
    // c_user should be set if the user has ever logged in.
    const has_c_user = Boolean(cookies.filter(a => a.name === "c_user")[0]);
    const has_xs = Boolean(cookies.filter(a => a.name === "xs")[0]);

    facebookPixel.hasFacebookLoginCookies.set(has_c_user && has_xs);

    // Attempt to associate this pixel tracker sighting with a WebScience Page ID.
    const pageVisits = (await browser.storage.local.get("pageVisits"))["pageVisits"];
    let pageId;
    for (const visit of pageVisits) {
      const visitUrl = new URL(visit.url);
      if (visitUrl.origin === originUrl.origin && visit.tabId === tabId) {
        pageId = visit.pageId;
      }
    }

    if (pageId) {
      facebookPixel.pageId.set(pageId);
    } else {
      console.warn("No page ID found for Facebook tracker:", details);
    }

    if (enableDevMode) {
      // FIXME it would be preferable to get this straight from Glean, but unfortunately it does not seem to be
      // holding more than one ping at a time in its local storage when submission is disabled.
      // TODO file issue to follow up.
      const testPings = (await browser.storage.local.get("testPings"))["testPings"];
      // If this storage object already exists, append to it.
      const result = {
        "pageId": pageId,
        "url": url.toString(),
        "hasFacebookLoginCookies": Boolean(has_c_user && has_xs),
        "formData": JSON.stringify(formData)
      };
      if (Array.isArray(testPings)) {
        testPings.push(result);

        await browser.storage.local.set({ testPings });
      } else {
        await browser.storage.local.set({ "testPings": [result] });
      }
    } else {
      // TODO implement in glean yaml
      // pixelHuntPings.pageNavigationEvent.submit();
      pixelHuntPings.fbpixelhuntEvent.submit();
    }
  }
}