import { state, loadState, persist, uid, THEMES, DENSITIES, sanitizeImport } from "./store.js";
import { h, $, btn, iconBtn, toast, copyText, favicon, askText, openDialog } from "./ui.js";
import { normalizeUrl, fuzzyScore, hostOf, fmtMs } from "./codec.js";
import { openWorkspace, closeWorkspace, isWorkspaceOpen } from "./workspace.js";
import { setRain } from "./rain.js";

/* ================= data helpers ================= */

const allItems = () => state.groups.flatMap((group) => group.items.map((item) => ({ group, item })));
const pinned = () => allItems().filter((x) => x.item.pin);

function ensureGroup(name) {
  let g = state.groups.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!g) {
    g = { id: uid(), name, items: [] };
    state.groups.push(g);
  }
  return g;
}

// Change groups, save, redraw, and (optionally) offer an undo.
function mutate(fn, msg) {
  const before = structuredClone(state.groups);
  fn();
  persist("groups");
  render();
  if (msg) {
    toast(msg, { action: "undo", ms: 7000, onAction: () => { state.groups = before; persist("groups"); render(); } });
  }
}

function go(url, newTab = state.settings.newTab) {
  if (newTab) window.open(url, "_blank", "noopener");
  else window.location.assign(url);
}

/* ================= settings, clock, timer ================= */

function applySettings() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme;
  document.body.classList.toggle("compact", s.density === "compact");
  $("#ps1").replaceChildren(h("span", { class: "u", text: s.user }), h("span", { class: "at", text: "@newtab" }), h("span", { class: "p", text: ":~$ " }));
  setRain(s.rain);
}

function setSetting(key, value) {
  state.settings[key] = value;
  persist("settings");
  applySettings();
  render();
}

function tick() {
  const now = new Date();
  $("#clock").textContent =
    now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) + "  " +
    now.toLocaleTimeString("en-GB", { hour12: false });
  const el = $("#timer");
  const t = state.timer;
  if (!t) { el.hidden = true; return; }
  const left = t.endsAt - Date.now();
  if (left <= 0) {
    toast(`${t.mode} session finished`, { ms: 10000 });
    state.timer = null;
    persist("timer");
    el.hidden = true;
  } else {
    el.hidden = false;
    el.textContent = `${t.mode} ${fmtMs(left)}`;
  }
}

/* ================= rendering ================= */

let drag = null;

function render() {
  renderPinned();
  renderGroups();
}

function linkAnchor(item, cls = "link") {
  const a = h("a", { class: cls, href: item.url, rel: "noopener noreferrer", title: item.url });
  if (state.settings.newTab) a.target = "_blank";
  a.draggable = false; // the <li> is the drag handle, not the anchor
  a.append(favicon(item.url, item.name), h("span", { class: "name", text: item.name }));
  if (cls === "link") a.append(h("span", { class: "host", text: hostOf(item.url) }));
  return a;
}

function renderPinned() {
  const box = $("#pinned");
  const pins = pinned();
  box.hidden = pins.length === 0;
  box.replaceChildren(...pins.map(({ item }, i) => {
    const a = linkAnchor(item, "pin");
    if (i < 9) a.prepend(h("kbd", { text: String(i + 1) }));
    return a;
  }));
}

function renderGroups() {
  $("#groups").replaceChildren(...state.groups.map(groupEl), h("button", { type: "button", class: "btn addgroup", onclick: addGroup }, "+ group"));
}

function groupEl(g) {
  const ul = h("ul", { class: "links" }, g.items.map((item) => itemEl(g, item)));
  const head = h("header", { class: "ghead" },
    h("button", {
      type: "button", class: "gname", "aria-expanded": String(!g.collapsed),
      onclick: () => { g.collapsed = !g.collapsed; persist("groups"); render(); },
    }, h("span", { class: "caret", text: g.collapsed ? "▸" : "▾" }), g.name),
    h("span", { class: "count", text: String(g.items.length) }),
    h("span", { class: "rule" }),
    h("span", { class: "gtools" },
      iconBtn("+", "add link", () => openEdit(null, g.id)),
      iconBtn("✎", "rename group", () => renameGroup(g)),
      iconBtn("✕", "delete group", () => deleteGroup(g))));
  const sec = h("section", { class: "group" + (g.collapsed ? " collapsed" : "") }, head, ul);
  sec.addEventListener("dragover", (e) => { if (drag) e.preventDefault(); });
  sec.addEventListener("drop", (e) => { if (drag) { e.preventDefault(); moveItem(drag.id, g.id, null); } });
  return sec;
}

function itemEl(g, item) {
  const li = h("li", { draggable: true, dataset: { id: item.id } }, linkAnchor(item));
  li.addEventListener("dragstart", (e) => {
    drag = { id: item.id };
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.name);
  });
  li.addEventListener("dragend", () => {
    drag = null;
    li.classList.remove("dragging");
    document.querySelectorAll(".drop-before").forEach((x) => x.classList.remove("drop-before"));
  });
  li.addEventListener("dragover", (e) => {
    if (!drag || drag.id === item.id) return;
    e.preventDefault();
    e.stopPropagation();
    li.classList.add("drop-before");
  });
  li.addEventListener("dragleave", () => li.classList.remove("drop-before"));
  li.addEventListener("drop", (e) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    moveItem(drag.id, g.id, item.id);
  });
  li.addEventListener("contextmenu", (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, g, item); });
  return li;
}

function moveItem(id, toGid, beforeId) {
  const dest = state.groups.find((g) => g.id === toGid);
  if (!dest || id === beforeId) return;
  mutate(() => {
    let moved = null;
    for (const g of state.groups) {
      const i = g.items.findIndex((x) => x.id === id);
      if (i >= 0) { [moved] = g.items.splice(i, 1); break; }
    }
    if (!moved) return;
    const at = beforeId ? dest.items.findIndex((x) => x.id === beforeId) : -1;
    if (at >= 0) dest.items.splice(at, 0, moved);
    else dest.items.push(moved);
  });
}

/* ================= context menu ================= */

function hideMenu() {
  document.getElementById("ctx")?.remove();
}

function showMenu(x, y, g, item) {
  hideMenu();
  const mi = (label, fn, cls = "") =>
    h("button", { type: "button", role: "menuitem", class: cls, onclick: () => { hideMenu(); fn(); } }, label);
  const m = h("div", { class: "ctx", id: "ctx", role: "menu" },
    mi("open in new tab", () => go(item.url, true)),
    mi("edit…", () => openEdit(item.id)),
    mi(item.pin ? "unpin" : "pin to top row", () => { item.pin = item.pin ? undefined : true; persist("groups"); render(); }),
    mi("copy url", () => copyText(item.url)),
    mi("delete", () => mutate(() => { g.items = g.items.filter((i) => i.id !== item.id); }, `deleted ${item.name}`), "danger"));
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + "px";
  m.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + "px";
  m.querySelector("button")?.focus();
}

/* ================= add / edit / groups ================= */

function openEdit(itemId, defaultGid) {
  const found = itemId ? allItems().find((x) => x.item.id === itemId) : null;
  const name = h("input", { type: "text", value: found?.item.name ?? "", maxLength: 60, autocomplete: "off" });
  const url = h("input", { type: "text", value: found?.item.url ?? "", required: true, placeholder: "https://…  or  localhost:3000", autocomplete: "off", spellcheck: false });
  const sel = h("select", { "aria-label": "group" }, state.groups.map((g) => h("option", { value: g.id, text: g.name })), h("option", { value: "__new", text: "+ new group…" }));
  sel.value = found?.group.id ?? defaultGid ?? state.groups[0]?.id ?? "__new";
  const newName = h("input", { type: "text", placeholder: "new group name", maxLength: 40, hidden: true, autocomplete: "off" });
  const pin = h("input", { type: "checkbox", checked: !!found?.item.pin });
  const err = h("p", { class: "err", role: "alert" });
  const syncNew = () => { newName.hidden = sel.value !== "__new"; };
  sel.addEventListener("change", () => { syncNew(); if (!newName.hidden) newName.focus(); });
  syncNew();

  const form = h("form", { method: "dialog", class: "stack" },
    h("h2", { text: found ? "edit link" : "add link" }),
    h("label", { class: "field" }, "name", name),
    h("label", { class: "field" }, "url", url),
    h("label", { class: "field" }, "group", sel, newName),
    h("label", { class: "chk" }, pin, "pin to top row"),
    err,
    h("div", { class: "row end" }, btn("cancel", () => dlg.close()), h("button", { type: "submit", class: "btn primary" }, "save")));
  const dlg = h("dialog", { class: "dlg" }, form);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let u;
    try { u = normalizeUrl(url.value); } catch (ex) { err.textContent = ex.message; url.focus(); return; }
    mutate(() => {
      const dest = sel.value === "__new" ? ensureGroup(newName.value.trim() || "inbox") : state.groups.find((g) => g.id === sel.value) ?? ensureGroup("inbox");
      const label = name.value.trim() || hostOf(u);
      if (found) {
        if (found.group !== dest) {
          found.group.items = found.group.items.filter((i) => i.id !== found.item.id);
          dest.items.push(found.item);
        }
        Object.assign(found.item, { name: label, url: u });
        if (pin.checked) found.item.pin = true;
        else delete found.item.pin;
      } else {
        dest.items.push({ id: uid(), name: label, url: u, ...(pin.checked ? { pin: true } : {}) });
      }
    });
    dlg.close();
  });
  openDialog(dlg);
  (found ? name : url).focus();
}

async function addGroup() {
  const n = await askText("new group");
  if (n) mutate(() => ensureGroup(n));
}

async function renameGroup(g) {
  const n = await askText("rename group", g.name);
  if (n && n !== g.name) mutate(() => { g.name = n; });
}

function deleteGroup(g) {
  mutate(() => { state.groups = state.groups.filter((x) => x.id !== g.id); }, `deleted group “${g.name}” (${g.items.length} links)`);
}

/* ================= settings dialog, help, backup ================= */

function exportData() {
  const { groups, settings, notes, snippets, targets, ports } = state;
  const blob = new Blob([JSON.stringify({ app: "devtab", version: 1, data: { groups, settings, notes, snippets, targets, ports } }, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `devtab-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importFile(e) {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const data = sanitizeImport(JSON.parse(await f.text()));
    if (!window.confirm("Replace everything in DevTab with this backup?")) return;
    Object.assign(state, data);
    await persist();
    applySettings();
    render();
    toast("backup imported");
  } catch (err) {
    toast("import failed: " + err.message, { ms: 7000 });
  }
}

async function resetAll() {
  if (!window.confirm("Delete all DevTab data and restore defaults?")) return;
  await chrome.storage.local.clear();
  window.location.reload();
}

async function importTop() {
  if (!chrome?.topSites?.get) {
    toast("top sites not available in this browser");
    return;
  }
  const sites = await chrome.topSites.get();
  const have = new Set(allItems().map((x) => x.item.url.replace(/\/$/, "")));
  let added = 0;
  mutate(() => {
    const g = ensureGroup("most visited");
    for (const s of sites) {
      let u;
      try { u = normalizeUrl(s.url); } catch { continue; }
      if (have.has(u.replace(/\/$/, ""))) continue;
      g.items.push({ id: uid(), name: (s.title || hostOf(u)).slice(0, 60), url: u });
      added++;
    }
  });
  toast(added ? `added ${added} most-visited sites` : "nothing new to add");
}

function openSettings() {
  const select = (opts, current, onchange) => {
    const s = h("select", {}, opts.map((o) => h("option", { value: o, text: o })));
    s.value = current;
    s.addEventListener("change", () => onchange(s.value));
    return s;
  };
  const check = (key, current) => {
    const c = h("input", { type: "checkbox", checked: !!current });
    c.addEventListener("change", () => setSetting(key, c.checked));
    return c;
  };
  const user = h("input", { type: "text", value: state.settings.user, maxLength: 20, autocomplete: "off", spellcheck: false });
  user.addEventListener("change", () => {
    const v = user.value.replace(/[^\w.-]/g, "").slice(0, 20) || "dev";
    user.value = v;
    setSetting("user", v);
  });
  const file = h("input", { type: "file", accept: "application/json", hidden: true, onchange: importFile });
  const dlg = h("dialog", { class: "dlg" }, h("div", { class: "stack" },
    h("h2", { text: "settings" }),
    h("label", { class: "field" }, "prompt name", user),
    h("label", { class: "field" }, "theme", select(THEMES, state.settings.theme, (v) => setSetting("theme", v))),
    h("label", { class: "field" }, "density", select(DENSITIES, state.settings.density, (v) => setSetting("density", v))),
    h("label", { class: "chk" }, check("newTab", state.settings.newTab), "open links in a new tab"),
    h("label", { class: "chk" }, check("rain", state.settings.rain), "background rain effect"),
    h("div", { class: "row" }, btn("export backup", exportData), btn("import backup", () => file.click()), btn("reset all", resetAll, "danger")),
    file,
    h("div", { class: "row end" }, btn("close", () => dlg.close()))));
  openDialog(dlg);
}

function openHelp() {
  const rows = (pairs) => h("dl", { class: "kv" }, pairs.flatMap(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })]));
  const dlg = h("dialog", { class: "dlg wide" }, h("div", { class: "stack" },
    h("h2", { text: "keys" }),
    rows([["/  or  ctrl+k", "focus the prompt"], ["t", "open the workspace (tools)"], ["1–9", "open pinned link"], ["?", "this help"], ["esc", "close / clear"], ["right-click a link", "edit, pin, copy, delete"], ["drag a link", "reorder or move between groups"]]),
    h("h2", { text: "prompt commands" }),
    rows([
      ["<text>", "fuzzy-find a shortcut"], ["g gh so yt mdn npm shodan edb <q>", "search that site"], ["cve 2024-3094", "open the NVD page"],
      ["add <url> [name]", "add to the “inbox” group"], ["rm <name>", "delete best match (undo available)"],
      ["theme <name>", THEMES.join(" · ")], ["tools notes snippets targets ports timer", "open a workspace tab"],
      ["top", "import most-visited sites"], ["rain", "toggle background rain"], ["settings export help", ""],
    ]),
    h("div", { class: "row end" }, btn("close", () => dlg.close()))));
  openDialog(dlg);
}

/* ================= prompt ================= */

const ENGINES = {
  g: ["Google", "https://www.google.com/search?q="],
  gh: ["GitHub", "https://github.com/search?q="],
  so: ["Stack Overflow", "https://stackoverflow.com/search?q="],
  yt: ["YouTube", "https://www.youtube.com/results?search_query="],
  mdn: ["MDN", "https://developer.mozilla.org/en-US/search?q="],
  npm: ["npm", "https://www.npmjs.com/search?q="],
  shodan: ["Shodan", "https://www.shodan.io/search?query="],
  edb: ["Exploit-DB", "https://www.exploit-db.com/search?q="],
};

const LOOKS_LIKE_URL = /^(https?:\/\/\S+|localhost(:\d+)?(\/\S*)?|[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?)$/i;

const tab = (name) => ({ desc: `open ${name}`, run: () => openWorkspace(name) });
const COMMANDS = {
  help: { desc: "keys and commands", run: openHelp },
  settings: { desc: "preferences and backup", run: openSettings },
  export: { desc: "download a backup", run: exportData },
  top: { desc: "import most-visited sites", run: importTop },
  rain: { desc: "toggle background rain", run: () => setSetting("rain", !state.settings.rain) },
  tools: { usage: "[tab]", desc: "open the workspace", run: (a) => openWorkspace(a.trim().toLowerCase() || "tools") },
  notes: tab("notes"), snippets: tab("snippets"), targets: tab("targets"), ports: tab("ports"), timer: tab("timer"),
  theme: {
    usage: `[${THEMES.join("|")}]`, desc: "switch theme",
    run: (a) => {
      const t = a.trim().toLowerCase();
      if (THEMES.includes(t)) setSetting("theme", t);
      else toast("themes: " + THEMES.join(", "));
    },
  },
  add: {
    usage: "<url> [name…]", desc: "add a link to “inbox”",
    run: (a) => {
      const tokens = a.split(/\s+/).filter(Boolean);
      const urlTok = tokens.find((t) => LOOKS_LIKE_URL.test(t));
      if (!urlTok) return toast("usage: add <url> [name]");
      let u;
      try { u = normalizeUrl(urlTok); } catch (e) { return toast(e.message); }
      const label = tokens.filter((t) => t !== urlTok).join(" ") || hostOf(u);
      mutate(() => ensureGroup("inbox").items.push({ id: uid(), name: label.slice(0, 60), url: u }));
      toast(`added ${label} to inbox`);
    },
  },
  rm: {
    usage: "<name>", desc: "delete best match",
    run: (a) => {
      const best = rank(a)[0];
      if (!best) return toast(`no shortcut matches “${a}”`);
      mutate(() => { best.group.items = best.group.items.filter((i) => i.id !== best.item.id); }, `deleted ${best.item.name}`);
    },
  },
};

function rank(q, limit = 8) {
  if (!q.trim()) return [];
  return allItems()
    .map((x) => ({ ...x, score: Math.max(fuzzyScore(q, x.item.name), fuzzyScore(q, hostOf(x.item.url)) * 0.8) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function suggestions(raw) {
  const v = raw.trim();
  if (!v) return [];
  const [head, ...rest] = v.split(/\s+/);
  const key = head.toLowerCase();
  const arg = v.slice(head.length).trim();

  if (ENGINES[key] && arg) {
    const [label, base] = ENGINES[key];
    return [{ label: `${label} › ${arg}`, sub: "↵ search", run: () => go(base + encodeURIComponent(arg)) }];
  }
  if (key === "cve" && arg) {
    const m = /^(?:cve-)?(\d{4})-(\d{4,})$/i.exec(arg);
    const target = m
      ? `https://nvd.nist.gov/vuln/detail/CVE-${m[1]}-${m[2]}`
      : `https://nvd.nist.gov/vuln/search/results?form_type=Basic&results_type=overview&search_type=all&query=${encodeURIComponent(arg)}`;
    return [{ label: m ? `CVE-${m[1]}-${m[2]}` : `NVD › ${arg}`, sub: "↵ open NVD", run: () => go(target) }];
  }

  const out = [];
  const c = COMMANDS[key];
  if (c) out.push({ label: `${key} ${c.usage ?? ""}`.trim(), sub: c.desc, run: () => c.run(arg) });
  if (c && c.usage) return out; // a command with arguments owns the line

  const q = key === "open" ? arg : v;
  for (const { item, group } of rank(q)) {
    out.push({ label: item.name, sub: `${hostOf(item.url)} · ${group.name}`, fav: item, fill: item.name, run: () => go(item.url) });
  }
  if (LOOKS_LIKE_URL.test(v)) {
    out.unshift({ label: `open ${v}`, sub: "↵ go", run: () => { try { go(normalizeUrl(v)); } catch (e) { toast(e.message); } } });
  }
  out.push({ label: `search Google for “${v}”`, sub: "↵", run: () => go(ENGINES.g[1] + encodeURIComponent(v)) });
  return out;
}

function initPrompt() {
  const cmd = $("#cmd");
  const sug = $("#suggest");
  let sugs = [];
  let sel = 0;

  const draw = () => {
    sug.replaceChildren(...sugs.map((s, i) => h("li", {
      role: "option", "aria-selected": String(i === sel), class: i === sel ? "on" : "",
      onmousemove: () => { if (sel !== i) { sel = i; draw(); } },
      onmousedown: (e) => { e.preventDefault(); run(i); },
    }, s.fav ? favicon(s.fav.url, s.fav.name) : h("span", { class: "fav sym", text: "›" }), h("span", { class: "lbl", text: s.label }), h("span", { class: "sub", text: s.sub || "" }))));
    sug.hidden = sugs.length === 0;
  };
  const refresh = () => { sugs = suggestions(cmd.value); sel = 0; draw(); };
  const run = (i) => {
    const s = sugs[i];
    if (!s) return;
    cmd.value = "";
    sugs = [];
    draw();
    cmd.blur();
    s.run();
  };

  cmd.addEventListener("input", refresh);
  cmd.addEventListener("focus", refresh);
  cmd.addEventListener("blur", () => { sugs = []; draw(); });
  cmd.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (sugs.length) { sel = (sel + (e.key === "ArrowDown" ? 1 : sugs.length - 1)) % sugs.length; draw(); }
    } else if (e.key === "Tab" && sugs[sel]?.fill) {
      e.preventDefault();
      cmd.value = sugs[sel].fill;
      refresh();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      cmd.value = "";
      cmd.blur();
    }
  });
  $("#prompt").addEventListener("submit", (e) => { e.preventDefault(); run(sel); });
}

/* ================= global keys ================= */

function initKeys() {
  const cmd = $("#cmd");
  document.addEventListener("click", hideMenu);
  window.addEventListener("scroll", hideMenu, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.getElementById("ctx")) hideMenu();
      else if (isWorkspaceOpen() && !document.querySelector("dialog[open]")) closeWorkspace();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !isWorkspaceOpen()) {
      e.preventDefault();
      cmd.focus();
      return;
    }
    const t = e.target;
    const typing = t instanceof window.HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing || e.ctrlKey || e.metaKey || e.altKey || isWorkspaceOpen() || document.querySelector("dialog[open]")) return;
    if (e.key === "/") { e.preventDefault(); cmd.focus(); }
    else if (e.key === "t") openWorkspace("tools");
    else if (e.key === "?") openHelp();
    else if (/^[1-9]$/.test(e.key)) {
      const p = pinned()[Number(e.key) - 1];
      if (p) go(p.item.url);
    }
  });
}

/* ================= boot ================= */

async function init() {
  await loadState();
  applySettings();
  render();
  initPrompt();
  initKeys();
  $("#btnTools").addEventListener("click", () => openWorkspace("tools"));
  $("#btnSettings").addEventListener("click", openSettings);
  tick();
  setInterval(tick, 1000);
}

init();
