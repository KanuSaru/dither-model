// Puts a model on a page: a canvas that turns slowly, can be dragged (or turned with the
// arrow keys), pauses when it's off screen, and stays still for people who ask for less motion.

import { parseSTL } from "./stl.js";
import { simplify } from "./simplify.js";
import { decodeModel, meshFromPositions } from "./format.js";
import { prepare, renderFrame, darkBoxes, lightFrom } from "./render.js";

const DEG = Math.PI / 180;
const DEFAULTS = {
  src: "",
  width: 240, // CSS pixels
  height: 120,
  pixelSize: 2, // CSS pixels per model pixel
  spin: 24, // seconds per turn; 0 stays still
  yaw: -25, // degrees, where it starts
  pitch: 18,
  orient: [0, 0, 0], // degrees around x, y, z, applied to the file first
  zoom: 0.95,
  ambient: 0.08,
  edges: true,
  dark: [], // boxes in the file's units: [x0, y0, z0, x1, y1, z1]
  light: [-0.4, 0.55, 0.75],
  draggable: true,
  label: "",
  triangles: 9000, // for a raw STL, simplified in the browser to about this many
};

const cache = new Map(); // src → Promise of a decoded model, shared by every copy on the page

/** Loads a .json model (from the CLI) or a raw .stl. */
export function loadModel(src, opts = {}) {
  const key = `${src}|${opts.triangles ?? DEFAULTS.triangles}`;
  if (!cache.has(key)) {
    const p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`dither-model: ${src} answered ${r.status}`);
        return /\.json(\?|#|$)/i.test(src) || (r.headers.get("content-type") || "").includes("json") ? r.json() : r.arrayBuffer();
      })
      .then((data) =>
        data instanceof ArrayBuffer ? meshFromPositions(simplify(parseSTL(data), { triangles: opts.triangles ?? DEFAULTS.triangles })) : decodeModel(data),
      );
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}

/**
 * @param {HTMLElement} container
 * @param {Partial<typeof DEFAULTS> & { model?: object }} options `model` takes an already decoded model instead of `src`
 */
export function createModel(container, options = {}) {
  let o = { ...DEFAULTS, ...clean(options) };
  const canvas = document.createElement("canvas");
  canvas.className = "dither-model";
  canvas.style.imageRendering = "pixelated";
  canvas.style.display = "block";
  canvas.style.touchAction = "pan-y";
  container.appendChild(canvas);

  const state = { yaw: o.yaw * DEG, pitch: o.pitch * DEG, drag: null, prep: null, model: null, buf: {}, visible: true, last: 0, raf: 0, err: null };
  const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let tmp = null, inkCache = null;

  function size() {
    const W = Math.max(8, Math.round(o.width / o.pixelSize)), H = Math.max(8, Math.round(o.height / o.pixelSize));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; inkCache = null; }
    canvas.style.width = `${o.width}px`;
    canvas.style.height = `${o.height}px`;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", o.label || "3D model");
    if (o.draggable) {
      canvas.tabIndex = 0;
      canvas.style.cursor = "grab";
    } else {
      canvas.removeAttribute("tabindex");
      canvas.style.cursor = "";
    }
    return [W, H];
  }

  function ink() {
    // the ink is the text color where the model sits, or --dm-ink
    const cs = getComputedStyle(canvas);
    const c = (cs.getPropertyValue("--dm-ink") || "").trim() || cs.color;
    if (inkCache && inkCache.css === c) return inkCache.rgb;
    const ctx = (tmp ||= document.createElement("canvas")).getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    const hex = ctx.fillStyle; // the browser normalizes it to #rrggbb or rgba()
    let rgb = [0, 0, 0, 255];
    if (hex[0] === "#") rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
    else { const m = hex.match(/[\d.]+/g); if (m) rgb = [+m[0], +m[1], +m[2], Math.round((m[3] === undefined ? 1 : +m[3]) * 255)]; }
    inkCache = { css: c, rgb };
    return rgb;
  }

  function draw() {
    if (!state.prep) return;
    const [W, H] = size();
    const bits = renderFrame(
      state.prep,
      state,
      { w: W, h: H, zoom: o.zoom, light: state.light, ambient: o.ambient, edges: o.edges ? 0.75 : -2, dark: state.dark },
      state.buf,
    );
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H);
    const [r, g, b, a] = ink();
    for (let k = 0; k < bits.length; k++) {
      if (!bits[k]) continue;
      img.data[k * 4] = r; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
  }

  function still() {
    return !o.spin || (reduced && reduced.matches);
  }

  function loop(t) {
    state.raf = 0;
    if (!state.visible || !state.prep) return;
    const dt = state.last ? Math.min(0.1, (t - state.last) / 1000) : 0;
    if (t - state.last < 38) { state.raf = requestAnimationFrame(loop); return; } // ~25 frames a second is plenty for 1-bit
    state.last = t;
    if (!state.drag) {
      if (!still()) state.yaw += (dt * 2 * Math.PI) / o.spin;
      state.pitch += (o.pitch * DEG - state.pitch) * Math.min(1, dt * 2.5); // drifts back to its tilt
    }
    draw();
    if (!still() || state.drag || Math.abs(o.pitch * DEG - state.pitch) > 0.002) state.raf = requestAnimationFrame(loop);
  }
  const wake = () => { if (!state.raf && state.visible) { state.last = 0; state.raf = requestAnimationFrame(loop); } };

  // dragging and keys
  const down = (e) => {
    if (!o.draggable || e.button > 0) return;
    state.drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch, id: e.pointerId };
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
    wake();
  };
  const move = (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    state.yaw = d.yaw + ((e.clientX - d.x) / o.width) * Math.PI * 1.6;
    state.pitch = Math.max(-1.3, Math.min(1.3, d.pitch + ((e.clientY - d.y) / o.height) * Math.PI * 0.8));
  };
  const up = (e) => {
    if (!state.drag || state.drag.id !== e.pointerId) return;
    state.drag = null;
    canvas.style.cursor = o.draggable ? "grab" : "";
    wake();
  };
  const key = (e) => {
    if (!o.draggable) return;
    const step = 15 * DEG;
    if (e.key === "ArrowLeft") state.yaw -= step;
    else if (e.key === "ArrowRight") state.yaw += step;
    else if (e.key === "ArrowUp") state.pitch = Math.max(-1.3, state.pitch - step);
    else if (e.key === "ArrowDown") state.pitch = Math.min(1.3, state.pitch + step);
    else return;
    e.preventDefault();
    draw();
    wake();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("keydown", key);

  // only animate while it's on screen and the tab is visible
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(([en]) => { state.visible = en.isIntersecting && !document.hidden; if (state.visible) wake(); })
    : null;
  io?.observe(canvas);
  const vis = () => { state.visible = !document.hidden; if (state.visible) wake(); };
  document.addEventListener("visibilitychange", vis);
  reduced?.addEventListener?.("change", wake);

  let loading = 0;
  function load() {
    const ticket = ++loading;
    const got = o.model ? Promise.resolve(o.model) : o.src ? loadModel(o.src, o) : Promise.resolve(null);
    return got.then(
      (model) => {
        if (ticket !== loading || !model) return;
        state.model = model;
        setup();
        canvas.dispatchEvent(new CustomEvent("dither-model:load", { bubbles: true, detail: { credit: model.credit, license: model.license } }));
      },
      (err) => {
        if (ticket !== loading) return;
        state.err = err;
        console.warn(err);
        canvas.dispatchEvent(new CustomEvent("dither-model:error", { bubbles: true, detail: err }));
      },
    );
  }
  function setup() {
    state.prep = prepare(state.model, { orient: o.orient });
    state.dark = darkBoxes(o.dark || [], state.prep);
    state.light = lightFrom(o.light);
    draw();
    wake();
  }

  size();
  const ready = load();

  return {
    ready,
    canvas,
    get state() { return { yaw: state.yaw / DEG, pitch: state.pitch / DEG, loaded: !!state.prep }; },
    update(next = {}) {
      const before = o;
      o = { ...o, ...clean(next) };
      if (next.yaw !== undefined && next.yaw !== before.yaw) state.yaw = o.yaw * DEG;
      if (next.pitch !== undefined && next.pitch !== before.pitch) state.pitch = o.pitch * DEG;
      if (o.src !== before.src || o.model !== before.model || o.triangles !== before.triangles) return load();
      if (state.model && (JSON.stringify(o.orient) !== JSON.stringify(before.orient) || JSON.stringify(o.dark) !== JSON.stringify(before.dark) || JSON.stringify(o.light) !== JSON.stringify(before.light))) setup();
      else { draw(); wake(); }
      return ready;
    },
    destroy() {
      loading++;
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
      io?.disconnect();
      document.removeEventListener("visibilitychange", vis);
      reduced?.removeEventListener?.("change", wake);
      canvas.remove();
    },
  };
}

function clean(obj) {
  const out = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  return out;
}
