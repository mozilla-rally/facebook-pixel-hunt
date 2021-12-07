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
  if (details.originUrl) {
    originUrl = new URL(details.originUrl);
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
    const foundPixels = (await browser.storage.local.get("foundPixels"))["foundPixels"];
    // If this storage object already exists, append to it.
    if (Array.isArray(foundPixels)) {
      foundPixels.push(foundPixel);

      await browser.storage.local.set({ foundPixels });
    } else {
      await browser.storage.local.set({ "foundPixels": [foundPixel] });
    }
  }
}

/**
 * Listen for page navigation ("user journey") events.
 *
 * @param {Object} pageData - WebScience page data details.
 */
export async function pageDataListener(pageData) {
  if (enableDevMode) {
    //
    // FIXME it would be preferable to get this straight from Glean, but unfortunately it does not seem to be
    // holding more than one ping at a time in its local storage when submission is disabled.
    // TODO file issue to follow up.

    const pageNavigationPings = (await browser.storage.local.get("pageNavigationPings"))["pageNavigationPings"];
    // If this storage object already exists, append to it.
    const result = pageData;
    if (Array.isArray(pageNavigationPings)) {
      pageNavigationPings.push(result);

      await browser.storage.local.set({ pageNavigationPings });
    } else {
      await browser.storage.local.set({ "pageNavigationPings": [result] });
    }
  } else {
    if (!pageData.pageId) {
      console.warn("No pageID assigned by pageNavigation:", pageData);
    }
    userJourney.pageId.set(pageData.pageId);
    userJourney.attentionDuration.set(pageData.attentionDuration);
    userJourney.audioDuration.set(pageData.audioDuration);
    userJourney.maxRelativeScrollDepth.set(pageData.maxRelativeScrollDepth);
    userJourney.pageVisitStartTime.set(pageData.pageVisitStartTime);
    userJourney.pageVisitStopTime.set(pageData.pageVisitStopTime);
    userJourney.referrer.setUrl(pageData.referrer);
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
  const pageVisits = (await browser.storage.local.get("pageVisits"))["pageVisits"];
  // If this storage object already exists, append to it.
  if (Array.isArray(pageVisits)) {
    pageVisits.push(pageVisit);

    await browser.storage.local.set({ pageVisits });
  } else {
    await browser.storage.local.set({ "pageVisits": [pageVisit] });
  }
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
  const pageVisits = (await browser.storage.local.get("pageVisits"))["pageVisits"];

  const matchingPageVisits = pageVisits.filter(a => a.pageId === pageVisit.pageId);

  // Save all other page visits back to local storage.
  const allPageVisits = pageVisits.filter(a => a.pageId !== pageVisit.pageId);
  await browser.storage.local.set({ allPageVisits });

  for (const matchingPageVisit of matchingPageVisits) {
    const foundPixels = (await browser.storage.local.get("foundPixels"))["foundPixels"];
    if (!foundPixels) {
      return;
    }
    const remainingPixels = [];
    for (const foundPixel of foundPixels) {
      const { url, originUrl, tabId, hasFacebookLoginCookies, formData } = foundPixel;

      if (originUrl === matchingPageVisit.url && parseInt(tabId) === matchingPageVisit.tabId) {
        const pageId = matchingPageVisit.pageId;

        if (enableDevMode) {
          // TODO it would be preferable to get this straight from Glean.
          const testPings = (await browser.storage.local.get("testPings"))["testPings"];
          // If this storage object already exists, append to it.
          const result = {
            pageId,
            "url": url.toString(),
            hasFacebookLoginCookies,
            "formData": formData
          };
          if (Array.isArray(testPings)) {
            testPings.push(result);

            await browser.storage.local.set({ testPings });
          } else {
            await browser.storage.local.set({ "testPings": [result] });
          }
        } else {
          facebookPixel.url.setUrl(url);
          facebookPixel.hasFacebookLoginCookies.set(!!hasFacebookLoginCookies)
          facebookPixel.pageId.set(pageId);
          facebookPixel.formData.set(formData);
          pixelHuntPings.fbpixelhuntPixel.submit();
        }
      } else {
        remainingPixels.push(foundPixel);
      }
    }
    // Save any unmatched pixel events back to local storage.
    await browser.storage.local.set({ foundPixels: remainingPixels });
  }
}
