# Facebook Pixel Hunt

_status: In development_

## Requirements
* [Node.js](https://nodejs.org/en/)
* [Mozilla web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)

This repository contains the code needed to build the Rally Study 01 Web Extension. 
The study submits data through [Mozilla Rally's Web Extension](https://github.com/mozilla-rally/rally-core-addon),
or can be run locally without Mozilla Rally installed on your computer.

## Quickstart

```bash
# install all dependencies
npm install

# run developer mode.
# this will run web-ext and listen for all input files, 
# and will rebuild and auto-reload for you.
npm run watch

# build the addon and output the xpi so that it can be side-loaded in Firefox Nightly.
npm run build:addon

# --- Other commands you might be interested in ---
# generate documentation for all modules in the doc/ directory.
npm run doc

# run unit tests
npm run test:unit
```

## Understanding this repository

## the data collected by this study