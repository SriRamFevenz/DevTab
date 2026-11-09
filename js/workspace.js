// Full-screen workspace: mini tools, notes, snippets, target tracker, localhost ports, timer.
// Every tool runs locally in the page. Nothing here sends your input anywhere.

import { state, persist, uid, STATUSES } from "./store.js";
import { h, btn, toast, copyText } from "./ui.js";
import * as C from "./codec.js";

const TABS = ["tools", "notes", "snippets", "targets", "ports", "timer"];
let root = null;
let cleanup = null;

export const isWorkspaceOpen = () => root !== null;

export function openWorkspace(tab = "tools") {
  if (!TABS.includes(tab)) tab = "tools";
  if (!root) {
    root = h("div", { class: "ws", role: "dialog", "aria-modal": "true", "aria-label": "Workspace" });
    document.body.append(root);
    document.body.classList.add("noscroll");
  }
  show(tab);
}

export function closeWorkspace() {
  cleanup?.();
  cleanup = null;
  root?.remove();
  root = null;
  document.body.classList.remove("noscroll");
}

function show(tab) {
  cleanup?.();
  cleanup = null;
  const view = VIEWS[tab]();
  cleanup = view.cleanup || null;
  const tabs = h("nav", { class: "ws-tabs", role: "tablist" },
    TABS.map((id) => h("button", {
      type: "button", role: "tab", class: "tab" + (id === tab ? " on" : ""),
      "aria-selected": String(id === tab), onclick: () => show(id),
    }, id)),
    h("span", { class: "grow" }),
    h("button", { type: "button", class: "btn", onclick: closeWorkspace }, "close · esc"));
  root.replaceChildren(h("div", { class: "ws-panel" }, tabs, h("div", { class: "ws-body" }, view.el)));
}

/* ---------- small building blocks ---------- */

const card = (title, ...kids) => h("section", { class: "card" }, h("h3", { text: title }), ...kids);
const area = (placeholder, rows = 4) => h("textarea", { rows, placeholder, spellcheck: false, autocomplete: "off" });
const block = (label, text) => h("div", { class: "blk" }, h("span", { class: "lbl", text: label }), h("pre", { text }));
const copyBtn = (get, label = "copy") => btn(label, () => { const t = get(); if (t) copyText(t); });
const empty = (msg) => h("li", { class: "empty", text: msg });

/* ---------- tools ---------- */

function codecCard() {
  const method = h("select", { "aria-label": "method" }, ["Base64", "URL", "Hex", "HTML entities"].map((m) => h("option", { value: m, text: m })));
  const inp = area("input");
  const out = h("textarea", { rows: 4, readOnly: true, placeholder: "output", spellcheck: false });
  const err = h("p", { class: "err", role: "status" });
  const FN = { Base64: [C.b64encode, C.b64decode], URL: [C.urlEncode, C.urlDecode], Hex: [C.hexEncode, C.hexDecode], "HTML entities": [C.htmlEncode, C.htmlDecode] };
  const run = (dir) => {
    err.textContent = "";
    try {
      out.value = FN[method.value][dir](inp.value);
    } catch (e) {
      out.value = "";
      err.textContent = `${dir ? "decode" : "encode"} failed: ${e.message}`;
    }
  };
  return card("encode / decode",
    h("div", { class: "row" }, method, btn("encode", () => run(0)), btn("decode", () => run(1)),
      btn("output → input", () => { inp.value = out.value; out.value = ""; })),
    inp, out, err, copyBtn(() => out.value, "copy output"));
}

function jwtCard() {
  const inp = area("eyJhbGciOiJIUzI1NiIs…");
  const out = h("div", { class: "out" });
  inp.addEventListener("input", () => {
    out.replaceChildren();
    if (!inp.value.trim()) return;
    try {
      const j = C.jwtDecode(inp.value);
      out.append(block("header", JSON.stringify(j.header, null, 2)), block("payload", JSON.stringify(j.payload, null, 2)));
      const times = ["iat", "nbf", "exp"].filter((k) => typeof j.payload[k] === "number").map((k) => {
        const d = new Date(j.payload[k] * 1000);
        const note = k === "exp" ? (d < new Date() ? "   expired" : "   not expired") : "";
        return `${k}  ${d.toISOString()}${note}`;
      });
      if (times.length) out.append(block("times", times.join("\n")));
      out.append(h("p", { class: "note", text: "decoded only. The signature is not verified." }));
    } catch (e) {
      out.append(h("p", { class: "err", text: e.message }));
    }
  });
  return card("jwt decoder", inp, out);
}

function hashCard() {
  const inp = area("text to hash");
  const algos = [["MD5", null], ["SHA-1", "SHA-1"], ["SHA-256", "SHA-256"], ["SHA-512", "SHA-512"]];
  const cells = {};
  const rows = algos.map(([label]) => {
    cells[label] = h("code", { text: "·" });
    return h("div", { class: "hrow" }, h("span", { class: "lbl", text: label }), cells[label],
      copyBtn(() => (cells[label].textContent === "·" ? "" : cells[label].textContent)));
  });
  let seq = 0;
  inp.addEventListener("input", async () => {
    const mine = ++seq;
    const v = inp.value;
    cells.MD5.textContent = C.md5(v);
    for (const [label, algo] of algos.slice(1)) {
      const hex = await C.digest(algo, v);
      if (mine !== seq) return; // a newer keystroke superseded this run
      cells[label].textContent = hex;
    }
  });
  return card("hashes", inp, h("div", { class: "hashes" }, rows));
}

function timeCard() {
  const inp = h("input", { type: "text", placeholder: "1700000000  or  2024-05-01T12:00:00Z", spellcheck: false, autocomplete: "off" });
  const out = h("div", { class: "out" });
  const update = () => {
    out.replaceChildren();
    if (!inp.value.trim()) return;
    try {
      const t = C.describeTime(inp.value);
      out.append(...[["unix (s)", String(t.unix)], ["unix (ms)", String(t.unixMs)], ["ISO 8601", t.iso], ["UTC", t.utc], ["local", t.local]].map(
        ([k, v]) => h("div", { class: "hrow" }, h("span", { class: "lbl", text: k }), h("code", { text: v }), copyBtn(() => v))));
    } catch (e) {
      out.append(h("p", { class: "err", text: e.message }));
    }
  };
  inp.addEventListener("input", update);
  return card("timestamp", h("div", { class: "row" }, inp, btn("now", () => { inp.value = String(Math.floor(Date.now() / 1000)); update(); })), out);
}

function jsonCard() {
  const inp = area('{"paste":"json"}', 6);
  const msg = h("p", { class: "note", role: "status" });
  const apply = (fn, ok) => {
    try {
      inp.value = fn(inp.value);
      msg.className = "note";
      msg.textContent = ok;
    } catch (e) {
      msg.className = "err";
      msg.textContent = e.message;
    }
  };
  return card("json", inp,
    h("div", { class: "row" }, btn("format", () => apply((s) => C.formatJson(s), "formatted")),
      btn("minify", () => apply(C.minifyJson, "minified")), btn("validate", () => apply((s) => { JSON.parse(s); return s; }, "valid JSON")),
      copyBtn(() => inp.value)), msg);
}

function regexCard() {
  const pat = h("input", { type: "text", placeholder: "pattern, e.g. (\\d+)-(\\w+)", spellcheck: false, autocomplete: "off" });
  const flags = h("input", { type: "text", value: "g", size: 5, maxLength: 8, spellcheck: false, "aria-label": "flags" });
  const text = area("test text", 4);
  const out = h("div", { class: "out" });
  const update = () => {
    out.replaceChildren();
    const { matches, error } = C.runRegex(pat.value, flags.value, text.value);
    if (error) return out.append(h("p", { class: "err", text: error }));
    if (!pat.value) return;
    out.append(h("p", { class: "note", text: `${matches.length}${matches.length >= 500 ? "+" : ""} match${matches.length === 1 ? "" : "es"}` }));
    for (const m of matches.slice(0, 50)) {
      const g = m.groups.length ? "   groups: " + m.groups.map((x) => JSON.stringify(x ?? null)).join(", ") : "";
      out.append(h("pre", { class: "match", text: `@${m.index}  ${JSON.stringify(m.text)}${g}` }));
    }
  };
  [pat, flags, text].forEach((el) => el.addEventListener("input", update));
  return card("regex", h("div", { class: "row" }, pat, flags), text, out);
}

function randomCard() {
  const SETS = { "a-z": "abcdefghijklmnopqrstuvwxyz", "A-Z": "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0-9": "0123456789", "symbols": "!@#$%^&*()-_=+[]{};:,.?/" };
  const len = h("input", { type: "number", min: 4, max: 256, value: 24, "aria-label": "length" });
  const boxes = Object.keys(SETS).map((k) => {
    const cb = h("input", { type: "checkbox", checked: k !== "symbols", "aria-label": k });
    return { k, cb, el: h("label", { class: "chk" }, cb, k) };
  });
  const out = h("code", { class: "bigout", text: "" });
  const gen = () => {
    try {
      const charset = boxes.filter((b) => b.cb.checked).map((b) => SETS[b.k]).join("");
      out.textContent = C.randomString(Math.min(256, Math.max(4, +len.value || 24)), charset);
    } catch (e) {
      out.textContent = e.message;
    }
  };
  gen();
  return card("random string",
    h("div", { class: "row" }, len, boxes.map((b) => b.el), btn("generate", gen), copyBtn(() => out.textContent)), out);
}

function toolsView() {
  return { el: h("div", { class: "tools-grid" }, codecCard(), jwtCard(), hashCard(), timeCard(), jsonCard(), regexCard(), randomCard()) };
}

/* ---------- notes ---------- */

function notesView() {
  const ta = h("textarea", { class: "notes", spellcheck: false, placeholder: "scratchpad. Saved automatically in this browser." });
  ta.value = state.notes;
  const st = h("span", { class: "muted", text: "saved" });
  let t = 0;
  let dirty = false;
  const flush = () => { clearTimeout(t); if (dirty) { dirty = false; state.notes = ta.value; persist("notes"); st.textContent = "saved"; } };
  ta.addEventListener("input", () => { dirty = true; st.textContent = "saving…"; clearTimeout(t); t = setTimeout(flush, 400); });
  return { el: h("div", { class: "stack" }, ta, st), cleanup: flush };
}

/* ---------- snippets ---------- */

function snippetsView() {
  const title = h("input", { type: "text", placeholder: "title", maxLength: 60, autocomplete: "off" });
  const body = area("command, snippet or payload template", 4);
  const list = h("ul", { class: "list" });
  let editing = null;
  const saveBtn = btn("save", () => {
    const t = title.value.trim();
    if (!t || !body.value.trim()) return toast("a title and some content are required");
    if (editing) Object.assign(state.snippets.find((s) => s.id === editing), { title: t, body: body.value });
    else state.snippets.unshift({ id: uid(), title: t, body: body.value });
    editing = null; title.value = ""; body.value = ""; saveBtn.textContent = "save";
    persist("snippets"); draw();
  }, "primary");
  function draw() {
    list.replaceChildren(...state.snippets.map((s) => h("li", { class: "item" },
      h("div", { class: "item-h" }, h("strong", { text: s.title }), h("span", { class: "grow" }),
        btn("copy", () => copyText(s.body)),
        btn("edit", () => { editing = s.id; title.value = s.title; body.value = s.body; saveBtn.textContent = "update"; title.focus(); }),
        btn("delete", () => { state.snippets = state.snippets.filter((x) => x.id !== s.id); persist("snippets"); draw(); })),
      h("pre", { text: s.body }))));
    if (!state.snippets.length) list.append(empty("nothing saved yet"));
  }
  draw();
  return { el: h("div", { class: "stack" }, h("div", { class: "form" }, title, body, h("div", { class: "row" }, saveBtn)), list) };
}

/* ---------- target tracker ---------- */

function targetsView() {
  const name = h("input", { type: "text", placeholder: "program / target", maxLength: 80, autocomplete: "off" });
  const url = h("input", { type: "text", placeholder: "url (optional)", autocomplete: "off", spellcheck: false });
  const list = h("ul", { class: "list" });
  const add = btn("add", () => {
    if (!name.value.trim()) return toast("give it a name");
    let u = "";
    try { if (url.value.trim()) u = C.normalizeUrl(url.value); } catch (e) { return toast(e.message); }
    state.targets.unshift({ id: uid(), name: name.value.trim(), url: u, status: "todo", notes: "" });
    name.value = ""; url.value = "";
    persist("targets"); draw();
  }, "primary");
  function draw() {
    list.replaceChildren(...state.targets.map((t) => {
      const status = h("select", { "aria-label": "status" }, STATUSES.map((s) => h("option", { value: s, text: s })));
      status.value = t.status;
      status.addEventListener("change", () => { t.status = status.value; persist("targets"); });
      const notes = h("input", { type: "text", value: t.notes, placeholder: "notes", maxLength: 500, autocomplete: "off", "aria-label": "notes" });
      notes.addEventListener("change", () => { t.notes = notes.value; persist("targets"); });
      return h("li", { class: "item" },
        h("div", { class: "item-h" },
          t.url ? h("a", { href: t.url, target: "_blank", rel: "noopener noreferrer", text: t.name }) : h("strong", { text: t.name }),
          h("span", { class: "grow" }), status,
          btn("delete", () => { state.targets = state.targets.filter((x) => x.id !== t.id); persist("targets"); draw(); })),
        notes);
    }));
    if (!state.targets.length) list.append(empty("no targets yet"));
  }
  draw();
  return { el: h("div", { class: "stack" },
    h("p", { class: "note", text: "Only track programs and systems you are authorized to test." }),
    h("div", { class: "row" }, name, url, add), list) };
}

/* ---------- localhost ports ---------- */

async function ping(port) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 1200);
  try {
    await fetch(`http://localhost:${port}/`, { mode: "no-cors", cache: "no-store", signal: ctl.signal });
    return "up";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

function portsView() {
  const label = h("input", { type: "text", placeholder: "label (api, vite…)", maxLength: 30, autocomplete: "off" });
  const port = h("input", { type: "number", min: 1, max: 65535, placeholder: "port" });
  const list = h("ul", { class: "list" });
  const status = new Map();
  let alive = true;
  function draw() {
    list.replaceChildren(...state.ports.map((p) => {
      const s = status.get(p.id) || "unknown";
      return h("li", { class: "item port" },
        h("span", { class: `dot ${s}`, title: s, role: "img", "aria-label": s }),
        h("a", { href: `http://localhost:${p.port}`, target: "_blank", rel: "noopener", text: `localhost:${p.port}` }),
        h("span", { class: "muted", text: p.label }), h("span", { class: "grow" }),
        btn("delete", () => { state.ports = state.ports.filter((x) => x.id !== p.id); persist("ports"); draw(); }));
    }));
    if (!state.ports.length) list.append(empty("no ports saved. Add the dev servers you run often."));
  }
  async function check() {
    for (const p of state.ports) status.set(p.id, "checking");
    draw();
    await Promise.all(state.ports.map(async (p) => {
      const r = await ping(p.port);
      if (!alive) return;
      status.set(p.id, r);
      draw();
    }));
  }
  const add = btn("add", () => {
    const n = Math.round(+port.value);
    if (!(n >= 1 && n <= 65535)) return toast("port must be between 1 and 65535");
    state.ports.push({ id: uid(), label: label.value.trim(), port: n });
    label.value = ""; port.value = "";
    persist("ports"); check();
  }, "primary");
  draw();
  check();
  return { el: h("div", { class: "stack" }, h("div", { class: "row" }, label, port, add, btn("recheck", check)), list), cleanup: () => { alive = false; } };
}

/* ---------- timer ---------- */

function timerView() {
  const disp = h("div", { class: "bigtime", role: "timer" });
  const mode = h("div", { class: "muted" });
  const mins = (key, lab, max) => {
    const i = h("input", { type: "number", min: 1, max, value: state.settings[key], "aria-label": lab });
    i.addEventListener("change", () => {
      state.settings[key] = Math.min(max, Math.max(1, Math.round(+i.value) || state.settings[key]));
      i.value = state.settings[key];
      persist("settings");
      draw();
    });
    return h("label", { class: "chk" }, lab, i);
  };
  const start = (m) => {
    state.timer = { mode: m, endsAt: Date.now() + state.settings[m === "focus" ? "focusMin" : "breakMin"] * 60000 };
    persist("timer");
    draw();
  };
  const stop = () => { state.timer = null; persist("timer"); draw(); };
  function draw() {
    disp.textContent = C.fmtMs(state.timer ? state.timer.endsAt - Date.now() : state.settings.focusMin * 60000);
    mode.textContent = state.timer ? `${state.timer.mode} running` : "idle";
  }
  draw();
  const id = setInterval(draw, 1000);
  return {
    el: h("div", { class: "stack center" }, disp, mode,
      h("div", { class: "row" }, btn("start focus", () => start("focus"), "primary"), btn("start break", () => start("break")), btn("stop", stop)),
      h("div", { class: "row" }, mins("focusMin", "focus (min)", 180), mins("breakMin", "break (min)", 60)),
      h("p", { class: "note", text: "The timer only alerts you while a new tab is open." })),
    cleanup: () => clearInterval(id),
  };
}

const VIEWS = { tools: toolsView, notes: notesView, snippets: snippetsView, targets: targetsView, ports: portsView, timer: timerView };
