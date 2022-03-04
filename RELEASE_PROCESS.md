# Release Process for Facebook Pixel Hunt

## Version bump

For any release, the version numbers in both `package.json` and `manifest.*.json` must be bumped, using semantic versioning.

Modify these and push to a `release` branch on GitHub.

## Wait for CI to build the extension packages.

CircleCI will build .zip files for the developer (aka playtest) and production version of the extension, these will be uploaded
to CircleCI as artifacts to the "Build and Lint" job:

https://app.circleci.com/pipelines/github/mozilla-rally/facebook-pixel-hunt?branch=release&filter=all

The "Firefox Integration Tests" tests should also be green.

## Compare extension package to live version

If there is a previous version of this extension live on AMO, download it and compare to the current package:

https://addons.mozilla.org/en-US/firefox/addon/facebook-pixel-hunt/versions/

`.xpi` files are `.zip` files, unzip these into seperate directories and run recursive diff (`diff -r`).
Only expected changes should be present:

- `META-INF/` contains the signing info, only in the live AMO version
- `manifest.json` should have a newer version
- any code changes should be present (may be rolled up)

## Create a Github release

Create a new github release, prefixing the tag with `v` (`v1.2.3` for version `1.2.3`). Attach the unsigned release XPI that you
built in the previous step.

Upload the artifacts from CI to the release page.

## Merge `release` branch to `main`

Be sure to open a PR and merge the `release` branch back to `main`.

## Submit to AMO

Upload the unsigned XPI to AMO https://addons.mozilla.org/en-US/developers/, using the XPI and source code ZIP from the github
release in the previous step.

If this is a new study, ask the add-ons team in #addons on Slack to enable an appropriate badge ("by Firefox", or "Verified").
