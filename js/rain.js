// Optional background effect. Off by default, paused when the tab is hidden,
// and never runs if the OS asks for reduced motion.

const GLYPHS = "01{}<>/\\|;:$#&*+=-_".split("");
const SIZE = 14;

let canvas = null;
let ctx = null;
let running = false;
let raf = 0;
let last = 0;
let drops = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drops = Array.from({ length: Math.ceil(canvas.width / SIZE) }, () => Math.floor(Math.random() * -40));
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (document.hidden || ts - last < 55) return;
  last = ts;
  const cs = getComputedStyle(document.documentElement);
  ctx.globalAlpha = 0.12; // translucent fill of the page colour leaves fading trails
  ctx.fillStyle = cs.getPropertyValue("--bg").trim() || "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = cs.getPropertyValue("--accent").trim() || "#0f0";
  ctx.font = `${SIZE}px monospace`;
  for (let i = 0; i < drops.length; i++) {
    ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * SIZE, drops[i] * SIZE);
    if (drops[i] * SIZE > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}

export function setRain(enabled) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const want = !!enabled && !reduced;
  if (want === running) return;
  canvas ||= document.getElementById("rain");
  if (!canvas) return;
  if (want) {
    ctx = canvas.getContext("2d");
    if (!ctx) return; // no 2D canvas available: leave the effect off
  }
  running = want;
  if (want) {
    canvas.hidden = false;
    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
  } else {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
  }
}
