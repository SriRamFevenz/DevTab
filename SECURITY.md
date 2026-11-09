# Security Policy

DevTab is a local-first tool, but it handles links, notes, and snippets, so we take
security reports seriously.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/makitdev/DevTab/security).
2. Click **Report a vulnerability**.
3. Describe the issue with enough detail to reproduce it.

If private reporting is unavailable, contact the maintainer directly through their
GitHub profile instead of filing a public issue.

Please include:

- The affected version (from `manifest.json`) and browser version.
- Steps to reproduce, or a proof-of-concept.
- The impact you think it has.
- Any suggested fix, if you have one.

## What to expect

- We aim to acknowledge a report within a few days.
- We will confirm the issue, agree on a disclosure timeline, and credit you in the
  fix and release notes unless you prefer to stay anonymous.
- Please give us a reasonable window to ship a fix before disclosing publicly.

## Scope

In scope:

- Cross-site scripting or injection through link names, URLs, notes, snippets,
  imported backups, or rendered tool output.
- Escaping the extension's permission model or reading data it should not access.
- Unexpected network requests; DevTab should make none of its own.
- Data loss or corruption caused by import/export handling.

Out of scope:

- Issues that require an already-compromised browser or profile.
- Findings in Chrome itself, or in third-party sites opened from DevTab.
- Social engineering, or physical access to an unlocked machine.
- The fact that `chrome.storage.local` is readable by someone with access to the
  browser profile; that is expected for a local-only extension.

## Data and permissions

DevTab stores everything in `chrome.storage.local` on the local machine. It does not
sync, transmit, or collect data. It requests three permissions:

- `storage` to save your links, notes, snippets, and settings.
- `favicon` to show site icons from Chrome's local cache.
- `topSites` only when you run the `top` command.

There are no analytics, remote scripts, or third-party services. Backups are
validated on import, and non-`http(s)` links are dropped.
