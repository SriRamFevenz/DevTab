// Small DOM helpers. Everything user-supplied goes through textContent, never innerHTML.

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.flat(Infinity).filter((x) => x != null && x !== false));
  return el;
}

export const btn = (label, onclick, cls = "") => h("button", { type: "button", class: `btn ${cls}`.trim(), onclick }, label);
export const iconBtn = (glyph, label, onclick) =>
  h("button", { type: "button", class: "icon", title: label, "aria-label": label, onclick }, glyph);

export function toast(msg, opts = {}) {
  const box = document.getElementById("toasts");
  if (!box) return;
  const el = h("div", { class: "toast" }, h("span", { text: msg }));
  if (opts.action) {
    el.append(h("button", { type: "button", class: "linkbtn", onclick: () => { opts.onAction?.(); el.remove(); } }, opts.action));
  }
  box.append(el);
  setTimeout(() => el.remove(), opts.ms ?? 4500);
}

export async function copyText(text, what = "copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(what);
  } catch {
    toast("copy failed: clipboard access was blocked");
  }
}

// Site icon from Chrome's own favicon cache; falls back to the first letter.
export function favicon(url, name) {
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const wrap = h("span", { class: "fav", "aria-hidden": "true" });
  const img = h("img", { alt: "", width: 16, height: 16 });
  img.addEventListener("error", () => {
    wrap.classList.add("fallback");
    wrap.replaceChildren(letter);
  });
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", url);
  u.searchParams.set("size", "32");
  img.src = u.toString();
  wrap.append(img);
  return wrap;
}

export function openDialog(dlg) {
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  return dlg;
}

export function askText(title, value = "") {
  return new Promise((resolve) => {
    const input = h("input", { type: "text", value, maxLength: 40, required: true, autocomplete: "off", "aria-label": title });
    let result = null;
    const form = h("form", { method: "dialog", class: "stack" },
      h("h2", { text: title }), input,
      h("div", { class: "row end" }, btn("cancel", () => dlg.close()), h("button", { type: "submit", class: "btn primary" }, "ok")));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      result = input.value.trim() || null;
      dlg.close();
    });
    const dlg = h("dialog", { class: "dlg small" }, form);
    dlg.addEventListener("close", () => resolve(result));
    openDialog(dlg);
    input.focus();
    input.select();
  });
}
