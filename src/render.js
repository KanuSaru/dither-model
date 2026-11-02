// Draws a mesh as 1-bit pixel art: a tiny software renderer with a depth buffer, flat
// shading, dark lines where the surface folds, and the same 4×4 ordered dithering as
// dither-moon. No WebGL; a few thousand triangles at ~120×60 pixels take a few milliseconds.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const DEG = Math.PI / 180;

/**
 * Precomputes what every frame needs from a decoded model.
 * @param {{positions: Float32Array, indices: ArrayLike<number>, center: number[], extent: number}} model
 * @param {{ orient?: number[] }} [opts] degrees around x, y, z, applied once (to stand a Z-up file upright, say)
 */
export function prepare(model, opts = {}) {
  const src = model.positions;
  const pos = new Float32Array(src.length);
  const [ax, ay, az] = (opts.orient || [0, 0, 0]).map((d) => d * DEG);
  const m = rotation(ax, ay, az);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    pos[i] = m[0] * x + m[1] * y + m[2] * z;
    pos[i + 1] = m[3] * x + m[4] * y + m[5] * z;
    pos[i + 2] = m[6] * x + m[7] * y + m[8] * z;
  }
  const idx = model.indices;
  const normals = new Float32Array(idx.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[t] = nx / l; normals[t + 1] = ny / l; normals[t + 2] = nz / l;
  }
  // how far the model reaches from its turning axis, so it never leaves the frame as it turns
  let rx = 0, ry = 0;
  for (let i = 0; i < pos.length; i += 3) {
    rx = Math.max(rx, Math.hypot(pos[i], pos[i + 2]));
    ry = Math.max(ry, Math.hypot(pos[i + 1], pos[i + 2]));
  }
  return { pos, idx, normals, rx: rx || 1, ry: ry || 1, rot: m, center: model.center, extent: model.extent };
}

/**
 * Renders one frame into `out` (1 = ink, 0 = empty), w×h.
 * @param {ReturnType<typeof prepare>} p
 * @param {{ yaw: number, pitch: number }} view radians
 * @param {object} o w, h, zoom, light, ambient, edges, dark
 * @param {object} [buf] reusable buffers (pass the same object every frame)
 */
export function renderFrame(p, view, o, buf = {}) {
  const W = o.w, H = o.h, N = W * H;
  if (buf.n !== N) {
    buf.n = N;
    buf.z = new Float32Array(N); buf.tone = new Float32Array(N); buf.face = new Int32Array(N);
    buf.ox = new Float32Array(N); buf.oy = new Float32Array(N); buf.oz = new Float32Array(N);
    buf.out = new Uint8Array(N);
  }
  const { z, tone, face, ox, oy, oz, out } = buf;
  z.fill(-Infinity); face.fill(-1); out.fill(0);
  const { pos, idx, normals } = p;
  const nv = pos.length / 3;
  if (!buf.P || buf.P.length !== nv * 3) buf.P = new Float32Array(nv * 3);
  const P = buf.P;
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const scale = (o.zoom ?? 0.95) * Math.min(W / 2 / p.rx, H / 2 / p.ry);
  const L = o.light;

  // turn around the vertical axis (yaw), then tilt toward the viewer (pitch); +z faces the viewer
  for (let k = 0; k < nv; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], zz = pos[k * 3 + 2];
    const x1 = x * cy + zz * sy, z1 = -x * sy + zz * cy;
    P[k * 3] = W / 2 + x1 * scale;
    P[k * 3 + 1] = H / 2 - (y * cp - z1 * sp) * scale;
    P[k * 3 + 2] = y * sp + z1 * cp;
  }

  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], bx = P[b * 3], by = P[b * 3 + 1], cx = P[c * 3], cyy = P[c * 3 + 1];
    const area = (bx - ax) * (cyy - ay) - (by - ay) * (cx - ax);
    if (area === 0) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cyy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cyy)));
    if (x0 > x1 || y0 > y1) continue;
    // light comes from the viewer's side, so whatever faces you is lit, however it's turned
    const fx = normals[t], fy = normals[t + 1], fz = normals[t + 2];
    const fx1 = fx * cy + fz * sy, fz1 = -fx * sy + fz * cy;
    const lit = Math.abs(fx1 * L[0] + (fy * cp - fz1 * sp) * L[1] + (fy * sp + fz1 * cp) * L[2]);
    const az = P[a * 3 + 2], bz = P[b * 3 + 2], cz = P[c * 3 + 2];
    for (let py = y0; py <= y1; py++) {
      const Y = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const X = px + 0.5;
        const w0 = ((bx - X) * (cyy - Y) - (by - Y) * (cx - X)) / area;
        if (w0 < 0) continue;
        const w1 = ((cx - X) * (ay - Y) - (cyy - Y) * (ax - X)) / area;
        if (w1 < 0) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < 0) continue;
        const d = w0 * az + w1 * bz + w2 * cz, i = py * W + px;
        if (d <= z[i]) continue;
        z[i] = d; face[i] = t; tone[i] = lit;
        ox[i] = w0 * pos[a * 3] + w1 * pos[b * 3] + w2 * pos[c * 3];
        oy[i] = w0 * pos[a * 3 + 1] + w1 * pos[b * 3 + 1] + w2 * pos[c * 3 + 1];
        oz[i] = w0 * pos[a * 3 + 2] + w1 * pos[b * 3 + 2] + w2 * pos[c * 3 + 2];
      }
    }
  }

  const ambient = o.ambient ?? 0.08, edges = o.edges ?? 0.75, depthEdge = (o.depthEdge ?? 0.06), dark = o.dark || [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i, f = face[k];
      if (f < 0) continue;
      let v = ambient + (1 - ambient) * tone[k];
      // dark areas (a screen, a window…): boxes in the model's own space
      for (const b of dark) {
        if (ox[k] >= b[0] && ox[k] <= b[3] && oy[k] >= b[1] && oy[k] <= b[4] && oz[k] >= b[2] && oz[k] <= b[5]) { v = 0; break; }
      }
      // a line where the surface folds sharply, or where one part passes in front of another;
      // drawn on the nearer side only, so lines stay one pixel thin
      if (edges > -1 && v > 0) {
        const near = [i < W - 1 ? k + 1 : -1, j < H - 1 ? k + W : -1, i > 0 ? k - 1 : -1, j > 0 ? k - W : -1];
        for (let q = 0; q < 4; q++) {
          const n = near[q];
          if (n < 0) continue;
          const g = face[n];
          if (g < 0 || g === f) continue;
          // one part in front of another: the nearer one gets the line
          if (z[k] - z[n] > depthEdge) { v = 0; break; }
          if (z[n] - z[k] > depthEdge) continue;
          // a fold: only looking right and down, so the line is one pixel wide
          if (q > 1) continue;
          const dot = normals[f] * normals[g] + normals[f + 1] * normals[g + 1] + normals[f + 2] * normals[g + 2];
          if (Math.abs(dot) < edges) { v = 0; break; }
        }
      }
      if (v > BAYER[(j & 3) * 4 + (i & 3)]) out[k] = 1;
    }
  }
  return out;
}

/** Turns boxes in the STL's units into the renderer's space (centered, scaled, oriented). */
export function darkBoxes(boxes, p) {
  const m = p.rot, s = 1 / p.extent, c = p.center;
  return boxes.map((b) => {
    // all 8 corners, rotated; the box around them
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
      const X = (x - c[0]) * s, Y = (y - c[1]) * s, Z = (z - c[2]) * s;
      const r = [m[0] * X + m[1] * Y + m[2] * Z, m[3] * X + m[4] * Y + m[5] * Z, m[6] * X + m[7] * Y + m[8] * Z];
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], r[a]); hi[a] = Math.max(hi[a], r[a]); }
    }
    return [...lo, ...hi];
  });
}

/** Normalizes a light direction given as [x, y, z] (x right, y up, z toward the viewer). */
export function lightFrom(v = [-0.4, 0.55, 0.75]) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function rotation(ax, ay, az) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  // R = Rz · Ry · Rx
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
}
