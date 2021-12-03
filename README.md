# Facebook Pixel Hunt

_status: In development_

## Requirements
* [Node.js](https://nodejs.org/en/)
* [Mozilla web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)

This repository contains the code needed to build the Facebook Pixel Hunt Web Extension.  This extension is a playtest version which only collects and stores data locally.

## Quickstart

```bash
# install all dependencies
npm install

# run in developer aka "playtest" mode.
# this will run web-ext and listen for all input files, 
# and will rebuild and auto-reload for you.
npm run dev

# build the extension and output a .zip of the extension in ./web-ext-artifacts
npm run package

# build a "playtest" version extension and output a .zip of the extension in ./web-ext-artifacts
npm run package:developer

# run integration tests
npm run test:integration
```

## The data collected by this study

See the [Glean documentation](./docs/metrics.md) for details.