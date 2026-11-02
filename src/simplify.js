// Makes a big mesh small enough to draw many times a second.
//
// Vertex clustering: space is cut into cubes ("cells"); every corner inside one cube
// becomes a single point at their average, and triangles that collapse to a line or a
// point disappear. It's fast and keeps the overall shape well, which is all a picture a
// hundred-odd pixels wide needs.

/**
 * @param {Float32Array} corners 9 numbers per triangle, as parseSTL returns
 * @param {{ cell?: number, triangles?: number }} [opts] a cell size in the file's units, or a target triangle count
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function simplify(corners, opts = {}) {
  const box = bounds(corners);
  const size = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) || 1;
  if (opts.cell) return cluster(corners, box, opts.cell);
  const target = opts.triangles ?? 8000;
  if (corners.length / 9 <= target) return cluster(corners, box, size / 1e6); // only merges shared corners
  // the cell size that lands closest to the target, by halving the range
  let lo = size / 4000, hi = size / 8, best = null;
  for (let k = 0; k < 14; k++) {
    const cell = Math.sqrt(lo * hi);
    const m = cluster(corners, box, cell);
    if (!best || Math.abs(m.indices.length / 3 - target) < Math.abs(best.indices.length / 3 - target)) best = m;
    if (m.indices.length / 3 > target) lo = cell;
    else hi = cell;
    if (hi / lo < 1.02) break;
  }
  return best;
}

export function bounds(p) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = p[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}

function cluster(corners, box, cell) {
  const n = corners.length / 3;
  const K = 1 << 17; // cells per axis that fit in a safe integer key
  cell = Math.max(cell, Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) / (K - 2));
  const ids = new Map();
  const sum = [];
  const corner = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const x = corners[i * 3], y = corners[i * 3 + 1], z = corners[i * 3 + 2];
    const key =
      Math.floor((x - box.min[0]) / cell) +
      Math.floor((y - box.min[1]) / cell) * K +
      Math.floor((z - box.min[2]) / cell) * K * K;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
      sum.push(0, 0, 0, 0);
    }
    sum[id * 4] += x;
    sum[id * 4 + 1] += y;
    sum[id * 4 + 2] += z;
    sum[id * 4 + 3]++;
    corner[i] = id;
  }
  const tris = [];
  const seen = new Set();
  for (let t = 0; t < n; t += 3) {
    const a = corner[t], b = corner[t + 1], c = corner[t + 2];
    if (a === b || b === c || a === c) continue;
    // the same three points twice (front and back of a thin wall collapse to one) are drawn once
    const s = [a, b, c].sort((u, v) => u - v);
    const key = s[0] + "," + s[1] + "," + s[2];
    if (seen.has(key)) continue;
    seen.add(key);
    tris.push(a, b, c);
  }
  // keep only the points still in use, numbered in order
  const remap = new Int32Array(ids.size).fill(-1);
  const pos = [];
  for (const id of tris) {
    if (remap[id] !== -1) continue;
    remap[id] = pos.length / 3;
    const k = sum[id * 4 + 3];
    pos.push(sum[id * 4] / k, sum[id * 4 + 1] / k, sum[id * 4 + 2] / k);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(tris, (id) => remap[id]) };
}
