# Release Process for Facebook Pixel Hunt

## Version bump

For any release, the version numbers in both `package.json` and `manifest.*.json` must be bumped, using semantic versioning.

Modify these and push to a `release` branch on GitHub.

## Build the release XPI

Before pushing the PR, ensure that building an unsigned XPI works and that it installs and works in Nightly (see `STUDY_QA.md`):

```bash
npm install
npm run package
```

The output will be in `./web-ext-artifacts`.

## Create a Github release

Create a new github release, prefixing the tag with `v` (`v1.2.3` for version `1.2.3`). Attach the unsigned release XPI that you
built in the previous step.

## Merge `release` branch to `main`

Be sure to open a PR and merge the `release` branch back to `main`.

## Submit to AMO

Upload the unsigned XPI to AMO https://addons.mozilla.org/en-US/developers/, using the XPI and source code ZIP from the github
release in the previous step.

If this is a new study, ask the add-ons team in #addons on Slack to enable an appropriate badge ("by Firefox", or "Verified").
