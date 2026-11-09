// Pure helpers. No DOM, no chrome.* APIs, so everything here is unit-testable in Node.

const enc = new TextEncoder();

/* ---------- bytes <-> text ---------- */

function bytesToText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Not valid UTF-8 (binary data): fall back to a Latin-1 view so something readable comes back.
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
}

/* ---------- Base64 ---------- */

export function b64encode(str) {
  let bin = "";
  for (const b of enc.encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64decode(str) {
  // Accepts standard and URL-safe alphabets, with or without padding.
  let s = str.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("not valid Base64");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return bytesToText(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/* ---------- URL / hex / HTML entities ---------- */

export const urlEncode = (s) => encodeURIComponent(s);
export const urlDecode = (s) => decodeURIComponent(s.replace(/\+/g, " "));

export function hexEncode(str) {
  return [...enc.encode(str)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexDecode(str) {
  const s = str.replace(/0x|\\x|[\s,:-]/gi, "");
  if (!/^[0-9a-f]*$/i.test(s)) throw new Error("not valid hex");
  if (s.length % 2) throw new Error("hex has an odd number of digits");
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return bytesToText(bytes);
}

const HTML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const htmlEncode = (s) => s.replace(/[&<>"']/g, (c) => HTML_ESC[c]);

const HTML_NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function htmlDecode(s) {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
    if (name) return HTML_NAMED[name.toLowerCase()] ?? m;
    const cp = hex ? parseInt(hex, 16) : parseInt(dec, 10);
    try {
      return String.fromCodePoint(cp);
    } catch {
      return m;
    }
  });
}

/* ---------- JWT (decode only, never verifies) ---------- */

export function jwtDecode(token) {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length < 2 || parts.length > 3) throw new Error("a JWT has 2 or 3 dot-separated parts");
  const parse = (p, what) => {
    try {
      return JSON.parse(b64decode(p));
    } catch {
      throw new Error(`${what} is not valid Base64URL JSON`);
    }
  };
  return { header: parse(parts[0], "header"), payload: parse(parts[1], "payload"), signature: parts[2] ?? "" };
}

/* ---------- hashing ---------- */

export async function digest(algo, str) {
  const buf = await crypto.subtle.digest(algo, enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// MD5 is not available in WebCrypto. Compact RFC 1321 implementation.
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K = Int32Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);

export function md5(str) {
  const bytes = enc.encode(str);
  const len = bytes.length;
  const total = (((len + 8) >>> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (len * 8) >>> 0, true);
  dv.setUint32(total - 4, Math.floor((len * 8) / 4294967296), true);

  let a0 = 0x67452301 | 0, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476 | 0;
  for (let off = 0; off < total; off += 64) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + MD5_K[i] + dv.getInt32(off + g * 4, true)) | 0;
      A = D; D = C; C = B;
      B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => out.setInt32(i * 4, v, true));
  return [...new Uint8Array(out.buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- time ---------- */

export function describeTime(input) {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("empty input");
  let d;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    d = new Date(Math.abs(n) >= 1e11 ? n : n * 1000); // 13-digit values are milliseconds
  } else {
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) throw new Error("unrecognised date or timestamp");
  const ms = d.getTime();
  return { unix: Math.floor(ms / 1000), unixMs: ms, iso: d.toISOString(), utc: d.toUTCString(), local: d.toString() };
}

export function fmtMs(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* ---------- JSON / regex / random ---------- */

export const formatJson = (s, indent = 2) => JSON.stringify(JSON.parse(s), null, indent);
export const minifyJson = (s) => JSON.stringify(JSON.parse(s));

export function runRegex(pattern, flags, text, cap = 500) {
  if (!pattern) return { matches: [], error: null };
  let re;
  const f = String(flags ?? "");
  try {
    re = new RegExp(pattern, f.includes("g") ? f : f + "g");
  } catch (e) {
    return { matches: [], error: e.message };
  }
  const matches = [];
  for (const m of text.matchAll(re)) {
    matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });
    if (matches.length >= cap) break;
  }
  return { matches, error: null };
}

export function randomString(len, charset) {
  const n = charset.length;
  if (!n) throw new Error("pick at least one character set");
  const limit = Math.floor(0x100000000 / n) * n; // rejection sampling avoids modulo bias
  const buf = new Uint32Array(1);
  let out = "";
  while (out.length < len) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) out += charset[buf[0] % n];
  }
  return out;
}

/* ---------- search / URLs ---------- */

// Returns a score > 0 for a match (higher is better), or -1 for no match.
export function fuzzyScore(query, text) {
  const q = String(query ?? "").toLowerCase();
  const t = String(text ?? "").toLowerCase();
  if (!q) return 0.01;
  const at = t.indexOf(q);
  if (at >= 0) return 1000 - at * 5 - (t.length - q.length);
  let ti = 0, score = 0, prev = -2;
  for (const ch of q) {
    const f = t.indexOf(ch, ti);
    if (f < 0) return -1;
    score += f === prev + 1 ? 8 : 2;
    if (f === 0 || /[\s\-_./]/.test(t[f - 1])) score += 6;
    prev = f;
    ti = f + 1;
  }
  return Math.max(0.01, score - t.length * 0.1);
}

export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Turns what a person types into a safe http(s) URL, or throws.
export function normalizeUrl(input) {
  let u = String(input).trim();
  if (!u) throw new Error("enter a URL");
  if (/^(localhost|127(\.\d+){3}|0\.0\.0\.0|\[::1\])(:\d+)?([/?#]|$)/i.test(u)) u = "http://" + u;
  else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) {
    if (/^(javascript|data|vbscript|file|blob):/i.test(u)) throw new Error("only http(s) links are allowed");
    u = "https://" + u;
  }
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error("that does not look like a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("only http(s) links are allowed");
  return parsed.href;
}
