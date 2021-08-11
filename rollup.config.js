/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is the Rollup configuration for the study template. It is
// part of the build system, and you should not have to modify it.

import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import nodeResolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import globby from "globby";
import typescript from '@rollup/plugin-typescript';

/**
 * Helper to detect developer mode.
 *
 * @param cliArgs the command line arguments.
 * @return {Boolean} whether or not developer mode is enabled.
 */
function isDevMode(cliArgs) {
  return Boolean(cliArgs["config-enable-developer-mode"]);
}

export default (cliArgs) => {
  // Configuration for the main background script, src/background.js.
  // The script will be output to dist/background.js with any module
  // dependencies (your own modules or modules from NPM) bundled in.
  const rollupConfig = [
    {
      input: "src/background.ts",
      output: {
        dir: "dist",
        format: "cjs",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        typescript(),
        replace({
          // In Developer Mode, the study does not submit data and
          // gracefully handles communication errors with the Core
          // Add-on.
          __ENABLE_DEVELOPER_MODE__: isDevMode(cliArgs),
          preventAssignment: true
        }),
        nodeResolve({
          browser: true,
          preferBuiltins: true,
        }),
        commonjs(),
        // Configuration for non-JavaScript assets (src/**/*) that
        // are not JavaScript files (i.e., do not end in .js). These
        // files will be copied to dist/ with the same relative path
        // they have in src/.
        copy({
          targets: [{
            src: [
              "src/**/*",
              "!src/**/*.js",
            ],
            dest: "dist/",
          }],
          flatten: false,
        }),
        // FIXME glean.js isn't importing webextension-polyfill so it's hard to roll up.
        copy({
          targets: [{
            src: "node_modules/webextension-polyfill/dist/browser-polyfill.min.js",
            dest: "dist/"
          }],
          flatten: true,
        })
      ],
    }
  ];

  // Configuration for content scripts (src/**/*.content.js) and
  // worker scripts (src/**/*.worker.js). These files will be
  // output to dist/ with the same relative path they have in
  // src/, but with any module dependencies (your own modules or
  // modules from npm) bundled in. We provide this configuration
  // because content scripts and worker scripts have separate
  // execution environments from background scripts, and a
  // background script might want to reference the bundled
  // scripts (e.g., browser.contentScripts.register() or new
  // Worker()).
  const scriptPaths = globby.sync([`src/**/*.content.js`, `src/**/*.worker.js`]);
  for (const scriptPath of scriptPaths) {
    rollupConfig.push({
      input: scriptPath,
      output: {
        file: `dist/${scriptPath.slice("src/".length)}`,
        format: "iife",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        resolve({
          browser: true,
        }),
        commonjs(),
      ],
    });
  }

  return rollupConfig;
}
