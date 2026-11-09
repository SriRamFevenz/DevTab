<div align="center">

# DevTab

A terminal-style new tab for Chrome, built for developers and security learners.<br>
A command prompt, unlimited grouped links, and a set of offline tools. No logo, no search box, no network calls.

[![Version](https://img.shields.io/badge/version-1.0.0-3fb950?style=flat-square)](https://github.com/makitdev/DevTab/releases/tag/v1.0.0)
[![Manifest](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?style=flat-square)](manifest.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-lightgrey?style=flat-square)](package.json)
[![Build](https://img.shields.io/badge/build%20step-none-lightgrey?style=flat-square)](package.json)

[Website & Live Demo](https://makitdev.github.io/DevTab/) · [Install](#installation) · [Commands](#prompt-commands) · [Privacy](#privacy) · [Contributing](#contributing)

</div>

---

## Overview

DevTab replaces Chrome's new tab page with a keyboard-first command prompt. Type to find a saved link, jump to a site-specific search, look up a CVE, or open a workspace of small utilities that run entirely inside the page.

It is written in vanilla JavaScript (ES modules) for Manifest V3, with no build step, no dependencies, and no network requests of its own.

### Highlights

- **Prompt-driven navigation:** Fuzzy-find links, complete with <kbd>Tab</kbd>, open with <kbd>Enter</kbd>.
- **Site search shortcuts:** `gh`, `so`, `mdn`, `npm`, `shodan`, `edb` and more, followed by a query.
- **Unlimited grouped links:** Drag to reorder or move between groups, pin with <kbd>1</kbd>–<kbd>9</kbd> hotkeys, right-click to edit, copy or delete.
- **Built-in workspace:** Encoders, hashes, a JWT decoder, a JSON formatter, a regex tester, notes, snippets, a target tracker, a port checker and a focus timer.
- **Six themes:** `github`, `matrix`, `dracula`, `nord`, `amber`, `cyber`.
- **Local-only data:** Stored in `chrome.storage.local`. Nothing is synced or transmitted.

---

## Installation

DevTab is installed as an unpacked extension:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the DevTab repository folder.
3. Open a new tab. Chrome may ask you to confirm keeping the extension's new tab page.

---

## Usage

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` or `Ctrl+K` | Focus the prompt |
| `t` | Open the workspace |
| `1`–`9` | Open the numbered pinned link |
| `?` | Show help |
| `Esc` | Close / clear |

Right-click a link to edit, pin, copy or delete it. Drag links to reorder them or move them between groups.

### Prompt commands

| Input | Action |
| --- | --- |
| `<text>` | Fuzzy-find a shortcut (<kbd>Tab</kbd> completes, <kbd>Enter</kbd> opens) |
| `g` `gh` `so` `yt` `mdn` `npm` `shodan` `edb` `<query>` | Search the matching site |
| `cve 2024-3094` | Open the NVD entry (any other input searches NVD) |
| `add <url> [name]` | Add a link to the `inbox` group |
| `rm <name>` | Delete the best match (with undo) |
| `theme <name>` | Switch theme: `github`, `matrix`, `dracula`, `nord`, `amber`, `cyber` |
| `tools` `notes` `snippets` `targets` `ports` `timer` | Open a workspace tab |
| `top` | Import Chrome's most-visited sites |
| `rain` `settings` `export` `help` `docs` | Toggle rain effect, open preferences, back up data, show help, open the website |

### Workspace

| Tab | Contents |
| --- | --- |
| **tools** | Base64 / URL / hex / HTML-entity encode and decode, JWT decoder (decode only, never verifies), MD5 / SHA-1 / SHA-256 / SHA-512, timestamp converter, JSON formatter, regex tester, random string generator |
| **notes** | Autosaved scratchpad |
| **snippets** | Saved commands and templates with one-click copy |
| **targets** | Status tracker (todo / testing / reported / done) |
| **ports** | Saved localhost ports with an up/down indicator |
| **timer** | Focus/break timer; alerts only while a new tab is open |

> [!NOTE]
> Only record programs you are authorized to test in targets.

---

## Privacy

DevTab makes no network requests of its own and collects no analytics. All data lives in `chrome.storage.local` on your machine. Nothing is synced or sent anywhere.

Settings provides JSON export and import for backups. Imports are validated, and any non-http(s) link is dropped.

| Permission | Purpose |
| --- | --- |
| `storage` | Save your links, notes and settings |
| `favicon` | Show site icons from Chrome's cache |
| `topSites` | Used only by the `top` command |

---

## Development

Requires Node 18+ for the test tooling. The extension itself needs no build step.

```bash
npm test          # unit tests for the pure logic in js/codec.js
npm run validate  # check manifest.json (version, icons, referenced files)
```

After editing, reload the extension at `chrome://extensions` and open a new tab.

### Project structure

```
newtab.html      page shell
css/style.css    themes and layout
js/main.js       links, prompt, keys, settings
js/workspace.js  tools, notes, snippets, targets, ports, timer
js/codec.js      pure functions (encoding, hashing, URL safety, fuzzy search), unit tested
js/store.js      state, defaults, backup validation
js/ui.js         DOM helpers (text-only rendering, no innerHTML)
js/rain.js       optional background effect
test/            node:test suite
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for how to run and test the project and how to open a pull request, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

- **Bugs and feature requests:** use the issue templates.
- **Security issues:** report privately as described in [SECURITY.md](SECURITY.md).
- **Release history:** see [CHANGELOG.md](CHANGELOG.md).

CI runs `npm test` and `npm run validate` on every push and pull request. Pushing a `vX.Y.Z` tag builds the extension zip and publishes a GitHub Release.

---

## License

See [LICENSE](LICENSE).
