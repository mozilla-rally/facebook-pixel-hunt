/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is the web-ext configuration for the study template. It is
// part of the build system, and you should not have to modify it.

module.exports = {
  // Global options:
  verbose: true,
  // Command options:
  build: {
    overwriteDest: true,
  },
  run: {
    browserConsole: false,
    startUrl: [
      "about:debugging"
    ]
  },
  ignoreFiles: [
    "bin",
    "docs",
    "scripts",
    "src",
    "stories",
    "support",
    "tests",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "copyright.txt",
    "LICENSE",
    "package-lock.json",
    "package.json",
    "README.md",
    "rollup.config.*",
    "web-ext-config.js",
    "public/**/*.map",
    "tsconfig.json",
    "public/",
    "dist/tailwind.css",
    "tailwind.config.js",
    "web-ext-config.dev.js",
    "screenshots",
    "babel.config.cjs",
    "integration.log",
    "metrics.yaml",
    "pings.yaml",
    "manifest.dev.json",
    "manifest.prod.json",
    "STUDY_QA.md",
    "RELEASE_PROCESS.md"
  ],
};
