# DevTab

A terminal-style new tab page for Chrome, built for developers and security learners.
No logo, no search box: a command prompt, unlimited grouped links, and a set of mini tools
that run entirely in the page.

Vanilla JS (ES modules), Manifest V3, no build step, no dependencies, no network calls of its own.

## Install (unpacked)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open a new tab. Chrome may ask you to confirm keeping the extension's new tab page.

## Using it

| Key | Action |
| --- | --- |
| `/` or `Ctrl+K` | focus the prompt |
| `t` | open the workspace (tools) |
| `1`-`9` | open the numbered pinned link |
| `?` | help |
| `Esc` | close / clear |

Right-click a link to edit, pin, copy or delete it. Drag links to reorder them or move them between groups.

### Prompt commands

| Input | Does |
| --- | --- |
| `<text>` | fuzzy-find a shortcut (`Tab` completes, `Enter` opens) |
| `g` `gh` `so` `yt` `mdn` `npm` `shodan` `edb` `<query>` | search that site |
| `cve 2024-3094` | open the NVD entry (anything else searches NVD) |
| `add <url> [name]` | add a link to the `inbox` group |
| `rm <name>` | delete the best match (undo toast) |
| `theme <name>` | `github` `matrix` `dracula` `nord` `amber` `cyber` |
| `tools` `notes` `snippets` `targets` `ports` `timer` | open a workspace tab |
| `top` | import Chrome's most-visited sites |
| `rain` `settings` `export` `help` | toggle rain, preferences, backup, help |

### Workspace

- **tools:** Base64 / URL / hex / HTML-entity encode and decode, JWT decoder (decode only, never verifies), MD5 / SHA-1 / SHA-256 / SHA-512, timestamp converter, JSON formatter, regex tester, random string generator.
- **notes:** autosaved scratchpad.
- **snippets:** saved commands and templates with one-click copy.
- **targets:** a simple status tracker (todo / testing / reported / done). Only record programs you are authorized to test.
- **ports:** saved localhost ports with an up/down indicator.
- **timer:** focus/break timer. It only alerts while a new tab is open.

## Data and privacy

Everything is stored in `chrome.storage.local` on this machine. Nothing is synced or sent anywhere.
Settings has JSON export/import for backups; imports are validated and any non-http(s) link is dropped.

Permissions: `storage` (save your data), `favicon` (site icons from Chrome's cache), `topSites` (only for the `top` command).

## Development

```
npm test        # unit tests for the pure logic in js/codec.js (Node 18+)
```

```
newtab.html     page shell
css/style.css   themes and layout
js/main.js      links, prompt, keys, settings
js/workspace.js tools, notes, snippets, targets, ports, timer
js/codec.js     pure functions (encoding, hashing, URL safety, fuzzy search), unit tested
js/store.js     state, defaults, backup validation
js/ui.js        DOM helpers (text-only rendering, no innerHTML)
js/rain.js      optional background effect
test/           node:test suite
```

After editing, reload the extension at `chrome://extensions` and open a new tab.
