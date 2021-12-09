# Manually Testing Facebook Pixel Hunt

The Facebook Pixel Hunt extension includes automated integration tests which test both
image-based GET and JS-based POST requests and a small sample set of pages. However, testing
against the public web is necessary too, since we can't anticipate what web authors might be
doing, and it is constantly changing.

## Setup

Make sure to go through all the installation requirements in [README.md](README.md#Quickstart).

You will need to run the following commands in this repository:

```
# install all the dependencies for building this study
npm install

# spin up the study in developer mode. This will
# launch another version of Firefox with the study web extension installed.
npm run dev
```

# Testing using the "playtest" UI

The Facebook Pixel Hunt comes with a "playtest" UI, which will launch on startup. If you close this tab,
you can get back to it by loading the add-on Preferences page via `about:addons` (see the `...` menu next to the
"Facebook Pixel Hunt (Playtest Edition)" entry.)

The UI allows you to stop/start data collection, and to export a set of CSV files.

1. Do not enable any advertisement or content blocking. Many of these block tracking pixels.
2. Load sites with known trackers (a web search for "facebook pixel" will turn up many such sites).

If you would like to use test data, the "playtest" mode will also listen for FB pixels firing to localhost, so
you may use the test webserver:

```
npm run test:integration:webserver
```

You may then browse http://localhost:8000 and should

3. Make sure to close any tabs you visit, which is needed to finalize a WebScience "page visit".

4. Export the data using the "playtest" UI.

You can export your data using the "Download" button on the playtest UI, this will download two CSV files:

`facebook-pixel-hunt-pageNavigations.csv`
`facebook-pixel-hunt-pixels.csv`

See `tests/integration/study.test.ts` for the types of data integrity the integration test checks for. At minimum,
you can try joining these two files on the `pageId` column and ensure that the pixel events appear to be related
to the page navigation events.

# Testing using the "production" build

The production build encrypts data locally and does not log it. Using the debugger in `about:debugging` on the
Facebook Pixel Hunt extension is the easiest way to see the raw data, by searching for code such as:
`pixelHuntPings.fbpixelhuntPixel.submit()`
`pixelHuntPings.fbpixelhuntJourney.submit()`

And setting a breakpoint.