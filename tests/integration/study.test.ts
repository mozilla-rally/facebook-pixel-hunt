/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import fs from "fs";

import { findAndAct, getChromeDriver, getFirefoxDriver, extensionLogsPresent, WAIT_FOR_PROPERTY } from "./utils";
import { By, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox";

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

let driver;
let screenshotCount = 0;

describe("Rally Web Platform UX flows", function () {
  beforeEach(async () => {
    driver = await webDriverInitializer(loadExtension, headlessMode);

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
      until.elementTextIs(statusElement, "PAUSED"),
      WAIT_FOR_PROPERTY
    );
    // Selenium seems to think this is not clickable, likely the CSS toggle-button technique we are using.
    // TODO make sure there aren't any accessibility issues with this.
    await driver.executeScript(`document.getElementById("toggleEnabled").click()`);
    await driver.wait(
      until.elementTextIs(statusElement, "RUNNING"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, resuming study`),

      await driver.executeScript(`document.getElementById("toggleEnabled").click()`);
    await driver.wait(
      until.elementTextIs(statusElement, "PAUSED"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, pausing study`);
  });

  it("collects and exports data", async function () {

    await driver.wait(
      until.elementTextIs(driver.findElement(By.id("status")), "PAUSED"),
      WAIT_FOR_PROPERTY
    );
    // Selenium seems to think this is not clickable, likely the CSS toggle-button technique we are using.
    // TODO make sure there aren't any accessibility issues with this.
    await driver.executeScript(`document.getElementById("toggleEnabled").click()`);
    await driver.wait(
      until.elementTextIs(driver.findElement(By.id("status")), "RUNNING"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, resuming study`);

    // Collect some data locally by browsing the archived test set.
    await driver.get("http://localhost:8000");
    await driver.wait(until.titleIs(`Pixel Test`), WAIT_FOR_PROPERTY);

    driver.navigate().back();

    await driver.wait(until.titleIs("Facebook Pixel Hunt"), WAIT_FOR_PROPERTY);
    await findAndAct(driver, By.id("download"), e => e.click());

    // Fail if the CSV already exists in /tmp/ instead of overwriting or letting the browser download a copy.
    const expectedError = new Error();
    expectedError["code"] = "ENOENT";
    expectedError["errno"] = -2;
    expectedError["path"] = "/tmp/facebook-pixel-hunt.csv";
    expectedError["syscall"] = "access";

    await expect(fs.promises.access(`/tmp/facebook-pixel-hunt.csv`)).rejects.toEqual(expectedError);

    // FIXME Selenium does not work well with system dialogs like the download dialog.
    // TODO enable auto-download, which needs to be done per-browser.
    await findAndAct(driver, By.id("download"), e => e.click());

    // Expect there to be a new line in the CSV for each link clicked during the test.
    // TODO we could do a more in-depth test here, to ensure the data actually matches. This might
    // be better to do as a test in web-science though.
    const csvData = await fs.promises.readFile(`/tmp/facebook-pixel-hunt.csv`);
    expect(csvData.toString().split('\n').length).toEqual(6);

    await fs.promises.access(`/tmp/facebook-pixel-hunt.csv`);
    await fs.promises.rm(`/tmp/facebook-pixel-hunt.csv`)

    await driver.executeScript(`document.getElementById("toggleEnabled").click()`);
    await driver.wait(
      until.elementTextIs(driver.findElement(By.id("status")), "PAUSED"),
      WAIT_FOR_PROPERTY
    );
    await extensionLogsPresent(driver, testBrowser, `Rally SDK - dev mode, pausing study`);
  });

});