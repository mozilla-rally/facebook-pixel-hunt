/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import browser from "webextension-polyfill";

import * as pixelHuntPings from "../src/generated/pings";
import * as facebookPixel from "../src/generated/facebookPixel";
import * as userJourney from "../src/generated/userJourney.js";

const fbHostname = ["www.facebook.com"];
// @ts-ignore
const enableDevMode = Boolean(__ENABLE_DEVELOPER_MODE__);

if (enableDevMode) {
  fbHostname.push("localhost");
}
/**
  * Responds to browser.webRequest.onCompleted events.
  *
  * Note: Chrome and Firefox both require a return type of `void` (undefined) or `Promise<BlockingResponse>` here, because this
  * API *might* block content when configured in "blocking" mode.
  *
  * We're not blocking content and just want to handle this async, since we depend on async WebExtension APIs. So, this returns undefined when called
  * synchronously, because typescript will complain if we try to pass an async function here.
  *
  * TODO: Firefox explicitly supports async callbacks for this API, make sure Chrome does as well.
  *
  * @param {browser.WebRequest.OnBeforeRequestDetailsTypes} - details for the web request.
  */
export function fbPixelListener(details: browser.WebRequest.OnBeforeRequestDetailsType) {
  handlePixel(details).catch((err: Error) => console.error("Facbook Pixel Hunt Listener Error:", err));
}

/**
 * Internal async handler for Facebook pixels.
 *
 * @param {browser.WebRequest.OnBeforeRequestDetailsTypes} - details for the web request.
 */
async function handlePixel(details: browser.WebRequest.OnBeforeRequestDetailsType) {
  const url = new URL(details.url);
  let originUrl = undefined;
  if (details.initiator) {
    originUrl = new URL(details.initiator);
  }
  const tabId = details.tabId;

  // Facebook pixels live at `*://www.facebook.com/tr/`
  if (fbHostname.includes(url.hostname) && url.pathname.match(/^\/tr/)) {

    // Pixels may be either HTTP GET requests for an image, or a POST from JS.
    // If a POST is detected, collect the form data submitted as well.
    let formData;
    if (details.method === "POST") {
      if ("requestBody" in details && "formData" in details.requestBody) {
        const rawFormData = details.requestBody.formData;
        formData = new URLSearchParams(rawFormData).toString();
      }
    }

    // Look for the presence of Facebook authentication cookies.
    // https://www.facebook.com/policy/cookies/
    const cookies = await browser.cookies.getAll({ domain: "facebook.com" });
    // c_user should be set if the user has ever logged in.
    const has_c_user = Boolean(cookies.filter(a => a.name === "c_user")[0]);
    const has_xs = Boolean(cookies.filter(a => a.name === "xs")[0]);

    const hasFacebookLoginCookies = (has_c_user && has_xs);

    // Record this pixel event sighting so it can be matched up with navigation events later.
    const foundPixel = { url: url.toString(), originUrl: originUrl.toString(), tabId: tabId.toString(), hasFacebookLoginCookies, formData };

    browser.storage.local.set({ [`facebook-pixel-${details.requestId}`]: foundPixel });
  }
}

/**
 * Listen for page navigation ("user journey") events.
 *
 * @param {Object} pageData - WebScience page data details.
 */
export async function pageDataListener(pageData) {
  if (enableDevMode) {
    // TODO it would be preferable to get this straight from Glean.
    await browser.storage.local.set({ [`pageNavigationPing-${pageData.pageId}`]: pageData });
  } else {
    if (!pageData.pageId) {
      console.warn("No pageID assigned by pageNavigation:", pageData);
    }
    userJourney.pageId.set(pageData.pageId);
    if (pageData.attentionDuration > 1.0) {
      userJourney.attentionDuration.set(parseInt(pageData.attentionDuration));
    }
    if (pageData.audioDuration > 1.0) {
      userJourney.audioDuration.set(parseInt(pageData.audioDuration));
    }
    if (pageData.maxRelativeScrollDepth > 1.0) {
      userJourney.maxRelativeScrollDepth.set(parseInt(pageData.maxRelativeScrollDepth));
    }
    const pageVisitStart = new Date(pageData.pageVisitStartTime);
    const pageVisitStop = new Date(pageData.pageVisitStopTime);
    userJourney.pageVisitStartDateTime.set(pageVisitStart);
    userJourney.pageVisitStopDateTime.set(pageVisitStop);
    // Referrer is optional, and will be an empty string if unset.
    if (pageData.referrer) {
      userJourney.referrer.setUrl(pageData.referrer);
    }
    userJourney.url.setUrl(pageData.url);

    pixelHuntPings.fbpixelhuntJourney.submit();
  }
}

/**
 * Listen for page visit start.
 *
 * This creates a record in local storage for each page visit.
 *
 * @param {Object} pageVisit - WebScience page visit details.
 */
export async function pageVisitStartListener(pageVisit) {
  browser.storage.local.set({ [`pageVisit-${pageVisit.pageId}`]: pageVisit });
}
/**
 * Listen for page visit stop.
 *
 * This removes any entries from local storage regarding this page visit,
 * and looks in local storage for matching facebook pixel events.
 *
 * @param {Object} pageVisit - WebScience page visit details.
 */
export async function pageVisitStopListener(pageVisit) {
  const storage = await browser.storage.local.get(null);

  for (const [visitKey, storedPageVisit] of Object.entries(storage)) {
    if (!(visitKey === `pageVisit-${pageVisit.pageId}`)) {
      continue;
    }

    for (const [pixelKey, storedPixel] of Object.entries(storage)) {
      if (!(pixelKey.startsWith(`facebook-pixel`))) {
        continue;
      }

      const { url, originUrl, tabId, hasFacebookLoginCookies, formData } = storedPixel;

      if (parseInt(tabId) === storedPageVisit.tabId) {
        const pageId = storedPageVisit.pageId;

        if (enableDevMode) {
          // TODO it would be preferable to get this straight from Glean.
          const pixel = {
            pageId,
            "url": url.toString(),
            hasFacebookLoginCookies,
            "formData": formData
          };

          await browser.storage.local.set({ [`pixelPing-${pageId}`]: pixel });
        } else {
          facebookPixel.url.setUrl(url);
          facebookPixel.hasFacebookLoginCookies.set(!!hasFacebookLoginCookies)
          facebookPixel.pixelPageId.set(pageId);
          if (formData) {
            facebookPixel.formData.set(formData);
          }
          pixelHuntPings.fbpixelhuntPixel.submit();
        }

        await browser.storage.local.remove(pixelKey);
      }
    }
    // The page visit has ended, so it is safe to remove this now.
    await browser.storage.local.remove(visitKey);
  }
}
