import { normalizeUrl, hostOf } from "./codec.js";

export const THEMES = ["github", "matrix", "dracula", "nord", "amber", "cyber"];
export const DENSITIES = ["comfortable", "compact"];
export const STATUSES = ["todo", "testing", "reported", "done"];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_SETTINGS = {
  user: "dev",
  theme: "github",
  density: "comfortable",
  newTab: false,
  rain: false,
  focusMin: 25,
  breakMin: 5,
};

const L = (name, url, pin) => ({ id: uid(), name, url, ...(pin ? { pin: true } : {}) });

export function defaultGroups() {
  return [
    { id: uid(), name: "daily", items: [
      L("GitHub", "https://github.com", true), L("Gmail", "https://mail.google.com", true),
      L("YouTube", "https://www.youtube.com"), L("Hacker News", "https://news.ycombinator.com"),
      L("X", "https://x.com"), L("Supabase", "https://supabase.com/dashboard"),
    ] },
    { id: uid(), name: "ai", items: [
      L("Claude", "https://claude.ai", true), L("ChatGPT", "https://chatgpt.com"), L("Gemini", "https://gemini.google.com"),
    ] },
    { id: uid(), name: "dev", items: [
      L("DevTab", "https://makitdev.github.io/DevTab/"),
      L("Stack Overflow", "https://stackoverflow.com"), L("MDN Web Docs", "https://developer.mozilla.org"),
      L("npm", "https://www.npmjs.com"), L("DevDocs", "https://devdocs.io"), L("Can I use", "https://caniuse.com"),
    ] },
    { id: uid(), name: "labs", items: [
      L("TryHackMe", "https://tryhackme.com"), L("Hack The Box", "https://app.hackthebox.com"),
      L("PortSwigger Academy", "https://portswigger.net/web-security"), L("picoCTF", "https://picoctf.org"),
      L("OverTheWire", "https://overthewire.org/wargames/"),
    ] },
    { id: uid(), name: "bug bounty", items: [
      L("HackerOne", "https://hackerone.com"), L("Bugcrowd", "https://bugcrowd.com"), L("Intigriti", "https://www.intigriti.com"),
    ] },
    { id: uid(), name: "recon & reference", items: [
      L("Shodan", "https://www.shodan.io"), L("Censys", "https://search.censys.io"), L("crt.sh", "https://crt.sh"),
      L("VirusTotal", "https://www.virustotal.com"), L("NVD", "https://nvd.nist.gov"), L("Exploit-DB", "https://www.exploit-db.com"),
      L("OWASP", "https://owasp.org"), L("GTFOBins", "https://gtfobins.github.io"),
    ] },
  ];
}

export const state = {
  groups: [],
  settings: { ...DEFAULT_SETTINGS },
  notes: "",
  snippets: [],
  targets: [],
  ports: [],
  timer: null,
};

const KEYS = Object.keys(state);

export function persist(...keys) {
  const out = {};
  for (const k of keys.length ? keys : KEYS) out[k] = state[k];
  return chrome.storage.local.set(out);
}

export async function loadState() {
  const saved = await chrome.storage.local.get(KEYS);
  const first = !Array.isArray(saved.groups);
  state.groups = first ? defaultGroups() : saved.groups;
  state.settings = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
  state.notes = typeof saved.notes === "string" ? saved.notes : "";
  state.snippets = Array.isArray(saved.snippets) ? saved.snippets : [];
  state.targets = Array.isArray(saved.targets) ? saved.targets : [];
  state.ports = Array.isArray(saved.ports) ? saved.ports : [];
  state.timer = saved.timer && typeof saved.timer.endsAt === "number" ? saved.timer : null;
  if (first) await persist("groups");
}

/* ---------- backup import: never trust the file ---------- */

export function sanitizeImport(raw) {
  const d = raw && raw.app === "devtab" && raw.data && typeof raw.data === "object" ? raw.data : null;
  if (!d) throw new Error("this is not a DevTab backup");
  const str = (v, max) => String(v ?? "").slice(0, max);
  const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  const num = (v, lo, hi, fb) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : fb);

  const groups = arr(d.groups, 100).map((g) => ({
    id: uid(),
    name: str(g?.name, 40).trim() || "group",
    collapsed: !!g?.collapsed,
    items: arr(g?.items, 2000).flatMap((it) => {
      try {
        const url = normalizeUrl(it?.url);
        const item = { id: uid(), name: str(it?.name, 60).trim() || hostOf(url), url };
        if (it?.pin) item.pin = true;
        return [item];
      } catch {
        return []; // drop links with unusable or non-http(s) URLs
      }
    }),
  }));

  const s = d.settings || {};
  const settings = {
    user: str(s.user, 20).replace(/[^\w.-]/g, "") || DEFAULT_SETTINGS.user,
    theme: THEMES.includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    density: DENSITIES.includes(s.density) ? s.density : DEFAULT_SETTINGS.density,
    newTab: !!s.newTab,
    rain: !!s.rain,
    focusMin: num(s.focusMin, 1, 180, 25),
    breakMin: num(s.breakMin, 1, 60, 5),
  };

  return {
    groups,
    settings,
    notes: str(d.notes, 200000),
    snippets: arr(d.snippets, 500).map((x) => ({ id: uid(), title: str(x?.title, 60), body: str(x?.body, 20000) })),
    targets: arr(d.targets, 500).map((x) => {
      let url = "";
      try { if (x?.url) url = normalizeUrl(x.url); } catch { /* keep name and notes, drop the bad URL */ }
      return {
        id: uid(), name: str(x?.name, 80), url,
        status: STATUSES.includes(x?.status) ? x.status : "todo", notes: str(x?.notes, 500),
      };
    }),
    ports: arr(d.ports, 100).flatMap((x) => {
      const n = Math.round(+x?.port);
      return n >= 1 && n <= 65535 ? [{ id: uid(), label: str(x?.label, 30), port: n }] : [];
    }),
  };
}
