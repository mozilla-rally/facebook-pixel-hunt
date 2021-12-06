/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import fs from "fs";
import os from "os";

import { findAndAct, getChromeDriver, getFirefoxDriver, extensionLogsPresent, WAIT_FOR_PROPERTY, readCSVData } from "./utils";
import { By, until, WebDriver } from "selenium-webdriver";

import minimist from "minimist";

const args = (minimist(process.argv.slice(2)));
for (const arg of ["test_browser", "load_extension", "headless_mode"]) {
  if (!(arg in args)) {
    throw new Error(`Missing required option: --${arg}`);
  }
}

const testBrowser = args["test_browser"];
const loadExtension = args["load_extension"] === "true";
const headlessMode = args["headless_mode"] === "true";

export let webDriverInitializer: Function;
switch (testBrowser) {
  case "chrome":
    webDriverInitializer = getChromeDriver;
    break;
  case "firefox":
    webDriverInitializer = getFirefoxDriver;
    break;
  default:
    throw new Error(`Unknown test_browser: ${testBrowser}`);
}

console.info(`Running with test_browser: ${testBrowser}, load_extension: ${loadExtension}, headless_mode: ${headlessMode}`);

// Wait ten minutes overall before Jest times the test out.
jest.setTimeout(60 * 10000);

let tmpDir: string;
let driver: WebDriver;
let screenshotCount = 0;

describe("Rally Web Platform UX flows", function () {
  beforeEach(async () => {
    tmpDir = os.tmpdir();
    console.info("Using tmpdir:", tmpDir);
    driver = await webDriverInitializer(loadExtension, headlessMode, tmpDir);

    // If installed, the extension will open its options page.
    if (loadExtension) {
      await driver.wait(until.titleIs("Facebook Pixel Hunt"), WAIT_FOR_PROPERTY);
    }
  });

  afterEach(async () => {
    screenshotCount++;

    const image = await driver.takeScreenshot();
    let extension = loadExtension ? "extension" : "no_extension";
    let headless = headlessMode ? "headless" : "no_headless";

    const screenshotDir = `screenshots/${testBrowser}-${extension}-${headless}`;
    const screenshotFilename = `${screenshotDir}/out-${screenshotCount}.png`;
    try {
      await fs.promises.access(`./${screenshotDir}`)
    } catch (ex) {
      await fs.promises.mkdir(`./${screenshotDir}`);
    }
    await fs.promises.writeFile(screenshotFilename, image, "base64");
    console.log(`recorded screenshot: ${screenshotFilename}`)

    await driver.quit();
  });

  it("enables and disables study", async function () {
    const statusElement = await driver.findElement(By.id("status"));

    await driver.wait(
      until.elementTextIs(statusElement, "RUNNING"),
      WAIT_FOR_PROPERTY
    );
    // Selenium seems to think this is not clickable, likely the CSS toggle-button technique we are using.
    // TODO make sure there aren't any accessibility issues with this.
    await driver.executeScript(`document.getElementById("toggleEnabled").click()`);
    await driver.wait(
      until.elementTextIs(statusElement, "PAUSED"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, resuming study`);
    await driver.executeScript(`document.getElementById("toggleEnabled").click()`);

    await driver.wait(
      until.elementTextIs(statusElement, "RUNNING"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, pausing study`);
  });

  it("collects and exports data", async function () {

    await driver.wait(
      until.elementTextIs(driver.findElement(By.id("status")), "RUNNING"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, resuming study`);

    // Collect some data locally by browsing the archived test set.
    const originalTab = (await driver.getAllWindowHandles())[0];

    // First, visit a page with a plain, old-style <img> tag, which should trigger an HTTP GET.
    await driver.switchTo().newWindow("tab");
    await driver.get("http://localhost:8000/img.html");
    await driver.wait(until.titleIs(`Pixel Test (image)`), WAIT_FOR_PROPERTY);
    await driver.close();

    await driver.switchTo().window(originalTab);
    await driver.wait(until.titleIs("Facebook Pixel Hunt"), WAIT_FOR_PROPERTY);

    // Next, watch for JS-generated HTTP POST.
    await driver.switchTo().newWindow("tab");
    await driver.get("http://localhost:8000/js.html");
    await driver.wait(until.titleIs(`Pixel Test (JS)`), WAIT_FOR_PROPERTY);

    await driver.close();

    await driver.switchTo().window(originalTab);
    await driver.wait(until.titleIs("Facebook Pixel Hunt"), WAIT_FOR_PROPERTY);

    // Selenium does not work well with system dialogs like the download dialog.
    // TODO enable auto-download for Chrome, which needs to be done per-browser.
    // Our `webDriverInitializer` will do the right thing for Firefox, which just skips the dialog and
    // downloads the file to our tmpdir.
    await findAndAct(driver, By.id("download"), e => e.click());

    const pixelData = await readCSVData(`${tmpDir}/facebook-pixel-hunt-pixels.csv`);
    const navData = await readCSVData(`${tmpDir}/facebook-pixel-hunt-pageNavigations.csv`);

    // Cleanup any downloaded files. We do this before running tests, so if any
    // tests fail, cleanup is already done.
    for (const name of ["pixels", "pageNavigations"]) {
      await fs.promises.access(`${tmpDir}/facebook-pixel-hunt-${name}.csv`);
      await fs.promises.rm(`${tmpDir}/facebook-pixel-hunt-${name}.csv`)
    }

    // Run some data integrity tests on the output.
    let results = 0;
    for (const [i, pixelRow] of Object.entries(pixelData)) {
      if (parseInt(i) == 0) {
        // skip headers
        continue;
      }
      const pixelPageId = pixelRow[0];
      for (const [j, navRow] of Object.entries(navData)) {
        if (parseInt(j) == 0) {
          // skip headers
          continue;
        }
        const navPageId = navRow[0];

        if (pixelPageId === navPageId) {
          const pixelUrl = pixelRow[1];
          if (pixelUrl === "http://localhost:8000/tr") {
            // the JS-generated pixel will have no query string, and will have data present in the formData field.
            const navUrl = navRow[1];
            expect(navUrl).toBe("http://localhost:8000/js.html");

            const formData = pixelRow[3];
            expect(formData).toBe("abc=def&ghi=jkl");
          } else {
            // If this is an image pixel, the query string will be part of the URL, and there will be no formData.
            const navUrl = navRow[1];
            expect(navUrl).toBe("http://localhost:8000/img.html");

            const formData = pixelRow[3];
            expect(formData).toBe("undefined");
          }
          results++;
        }
      }
    }

    expect(results).toBe(2);

    await driver.executeScript(`document.getElementById("toggleEnabled").click()`);
    await driver.wait(
      until.elementTextIs(driver.findElement(By.id("status")), "PAUSED"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, pausing study`);
  });

});