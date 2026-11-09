# Contributing to DevTab

Thanks for helping out. DevTab is a small, dependency-free Chrome extension, so the
workflow is deliberately simple.

## Before you start

- Open an issue first for anything larger than a typo or a one-line fix, so we can
  agree on the approach before you spend time on it.
- Check the [open issues](https://github.com/SriRamFevenz/DevTab/issues) and the
  roadmap before starting.
- By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Run it locally

DevTab has no build step and no dependencies. You only need Chrome (or any
Chromium-based browser) to run it.

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this repository folder.
3. Open a new tab. Chrome may ask you to confirm keeping the extension's new tab page.
4. After editing, click the reload icon on the DevTab card at `chrome://extensions`,
   then open a new tab.

## Test it

Tests use the built-in Node test runner, so you need Node 18 or newer. There is
nothing to install.

```
npm test
```

The suite covers the pure logic in `js/codec.js` (encoding, hashing, URL safety,
fuzzy search). If you add pure logic, put it in `js/codec.js` and add a test in
`test/`. DOM and `chrome.*` code is verified by hand in the browser.

Validate the manifest before opening a PR:

```
npm run validate
```

## Code guidelines

- Vanilla ES modules, Manifest V3. Do not add a framework, bundler, or runtime
  dependency without discussing it in an issue first.
- Render user-controlled text with `textContent` (see `js/ui.js`), never `innerHTML`.
- Keep `js/codec.js` free of DOM and `chrome.*` APIs so it stays unit-testable.
- Only `http(s)` URLs are allowed; use `normalizeUrl` from `js/codec.js`.
- Match the existing style: double quotes, two-space indent, small focused functions.
- Update `CHANGELOG.md` under **Unreleased** for user-visible changes.

## Branches and commits

- Keep `main` working. Do your work on a branch named `feature/...`, `fix/...`,
  or `docs/...`.
- Make small, focused commits with clear messages (for example
  `fix: keep pinned links after import`).
- Rebase or merge `main` into your branch if it has moved on.

## Pull requests

1. Push your branch and open a pull request against `main`.
2. Fill in the PR template: what changed, why, and how you tested it.
3. Make sure CI passes (`npm test` and manifest validation).
4. Add a screenshot or short screen recording for any visible UI change.
5. A maintainer will review. Please be patient and responsive to feedback.

Squash-merge is the default, so keep the PR title meaningful.

## Reporting bugs and requesting features

Use the issue templates. For a bug, include your Chrome version, the steps to
reproduce, what you expected, and what happened. For a security issue, do **not**
open a public issue; see [SECURITY.md](SECURITY.md).
