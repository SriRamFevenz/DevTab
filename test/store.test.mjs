import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/store.js";

test("defaultGroups returns expected initial structure", () => {
  const groups = S.defaultGroups();
  assert.ok(Array.isArray(groups));
  assert.ok(groups.length >= 5);
  for (const g of groups) {
    assert.ok(g.id);
    assert.ok(g.name);
    assert.ok(Array.isArray(g.items));
    for (const item of g.items) {
      assert.ok(item.id);
      assert.ok(item.name);
      assert.match(item.url, /^https?:\/\//);
    }
  }
});

test("sanitizeImport validates and accepts well-formed backup", () => {
  const backup = {
    app: "devtab",
    version: 1,
    data: {
      groups: [
        {
          name: "work",
          collapsed: false,
          items: [{ name: "gh", url: "https://github.com", pin: true }]
        }
      ],
      settings: {
        user: "developer",
        theme: "dracula",
        density: "compact",
        newTab: true,
        rain: true,
        focusMin: 30,
        breakMin: 10
      },
      notes: "important notes",
      snippets: [{ title: "grep", body: "grep -rn 'pattern' ." }],
      targets: [{ name: "target1", url: "https://example.com", status: "testing", notes: "in scope" }],
      ports: [{ label: "api", port: 8080 }]
    }
  };

  const result = S.sanitizeImport(backup);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].name, "work");
  assert.equal(result.groups[0].items.length, 1);
  assert.equal(result.groups[0].items[0].name, "gh");
  assert.equal(result.groups[0].items[0].url, "https://github.com/");
  assert.equal(result.groups[0].items[0].pin, true);

  assert.equal(result.settings.user, "developer");
  assert.equal(result.settings.theme, "dracula");
  assert.equal(result.settings.density, "compact");
  assert.equal(result.settings.newTab, true);
  assert.equal(result.settings.rain, true);
  assert.equal(result.settings.focusMin, 30);
  assert.equal(result.settings.breakMin, 10);

  assert.equal(result.notes, "important notes");
  assert.equal(result.snippets.length, 1);
  assert.equal(result.targets.length, 1);
  assert.equal(result.ports.length, 1);
  assert.equal(result.ports[0].port, 8080);
});

test("sanitizeImport rejects invalid backup objects", () => {
  assert.throws(() => S.sanitizeImport(null), /this is not a DevTab backup/);
  assert.throws(() => S.sanitizeImport({}), /this is not a DevTab backup/);
  assert.throws(() => S.sanitizeImport({ app: "other", data: {} }), /this is not a DevTab backup/);
  assert.throws(() => S.sanitizeImport({ app: "devtab" }), /this is not a DevTab backup/);
});

test("sanitizeImport drops malicious and non-http(s) links", () => {
  const badBackup = {
    app: "devtab",
    data: {
      groups: [
        {
          name: "untrusted",
          items: [
            { name: "xss", url: "javascript:alert(1)" },
            { name: "data", url: "data:text/html,<h1>attack</h1>" },
            { name: "file", url: "file:///etc/passwd" },
            { name: "good", url: "https://safe.example.com" }
          ]
        }
      ]
    }
  };

  const result = S.sanitizeImport(badBackup);
  assert.equal(result.groups[0].items.length, 1);
  assert.equal(result.groups[0].items[0].name, "good");
  assert.equal(result.groups[0].items[0].url, "https://safe.example.com/");
});

test("sanitizeImport falls back to safe settings on invalid values", () => {
  const backup = {
    app: "devtab",
    data: {
      settings: {
        user: "!@#$%^&*",
        theme: "non-existent-theme",
        density: "super-wide",
        focusMin: -999,
        breakMin: 9999
      }
    }
  };

  const result = S.sanitizeImport(backup);
  assert.equal(result.settings.user, S.DEFAULT_SETTINGS.user);
  assert.equal(result.settings.theme, S.DEFAULT_SETTINGS.theme);
  assert.equal(result.settings.density, S.DEFAULT_SETTINGS.density);
  assert.equal(result.settings.focusMin, 1); // clamped to min 1
  assert.equal(result.settings.breakMin, 60); // clamped to max 60
});

test("sanitizeImport handles targets and ports validation", () => {
  const backup = {
    app: "devtab",
    data: {
      targets: [
        { name: "good", url: "https://example.com", status: "invalid-status" },
        { name: "bad url", url: "javascript:evil()", status: "done" }
      ],
      ports: [
        { label: "valid", port: 3000 },
        { label: "zero", port: 0 },
        { label: "too high", port: 70000 },
        { label: "negative", port: -1 }
      ]
    }
  };

  const result = S.sanitizeImport(backup);
  assert.equal(result.targets.length, 2);
  assert.equal(result.targets[0].status, "todo"); // fallback for invalid-status
  assert.equal(result.targets[1].url, ""); // dropped bad url
  assert.equal(result.targets[1].status, "done");

  // Only valid port should remain
  assert.equal(result.ports.length, 1);
  assert.equal(result.ports[0].port, 3000);
});
