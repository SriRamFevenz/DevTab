# Changelog

All notable changes to DevTab are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Community files: contributing guide, code of conduct, security policy, changelog,
  and issue/pull request templates.
- GitHub Actions CI for tests and manifest validation, plus a tagged release
  workflow that builds and attaches the extension zip.

## [1.0.0] - 2026-11-09

### Added

- Terminal-style new tab page for Chrome (Manifest V3), no build step and no
  dependencies.
- Command prompt with fuzzy link search, Tab completion, and site shortcuts.
- Unlimited grouped links with drag-to-reorder, pinning, and right-click actions.
- Workspace tools: Base64/URL/hex/HTML-entity encoding, JWT decoding,
  MD5/SHA hashing, timestamp conversion, JSON formatting, regex testing, and
  random string generation.
- Notes, snippets, targets, localhost ports, and a focus timer.
- Six themes, JSON export/import, and Chrome top-sites import.
- Local-only storage in `chrome.storage.local`; no network requests or analytics.

[Unreleased]: https://github.com/SriRamFevenz/DevTab/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/SriRamFevenz/DevTab/releases/tag/v1.0.0
