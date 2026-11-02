// The small model format: a JSON file with the mesh packed as base64.
//
//   { "format": "dither-model", "version": 1,
//     "center": [x, y, z], "extent": e,          // in the STL's own units
//     "vertices": n, "triangles": m,
//     "positions": "<base64 Int16, x y z per point, scaled to ±32767 = ±extent>",
//     "indices": "<base64 Uint16 or Uint32, 3 per triangle>",
//     "credit": "…", "license": "…" }           // optional, kept with the model
//
// A 9,000-triangle model is about 110 KB, and less over the wire (servers gzip JSON).

const Q = 32767;

/** @param {{positions: Float32Array, indices: Uint32Array}} mesh */
export function encodeModel(mesh, meta = {}) {
  const { positions: p, indices } = mesh;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[i + a]); max[a] = Math.max(max[a], p[i + a]); }
  const center = min.map((v, a) => (v + max[a]) / 2);
  const extent = Math.max(...max.map((v, a) => (v - min[a]) / 2)) || 1;
  const q = new Int16Array(p.length);
  for (let i = 0; i < p.length; i++) q[i] = Math.round(((p[i] - center[i % 3]) / extent) * Q);
  const vertices = p.length / 3;
  const idx = vertices <= 65536 ? Uint16Array.from(indices) : Uint32Array.from(indices);
  return {
    format: "dither-model",
    version: 1,
    center: center.map((v) => +v.toFixed(5)),
    extent: +extent.toFixed(5),
    vertices,
    triangles: indices.length / 3,
    positions: toBase64(new Uint8Array(q.buffer)),
    indices: toBase64(new Uint8Array(idx.buffer)),
    ...meta,
  };
}

/**
 * Unpacks a model into what the renderer uses: positions scaled to about -1…1 around the center.
 * @returns {{ positions: Float32Array, indices: Uint16Array | Uint32Array, center: number[], extent: number, credit?: string, license?: string }}
 */
export function decodeModel(json) {
  if (!json || json.format !== "dither-model") throw new Error("dither-model: not a dither-model file");
  if (json.version !== 1) throw new Error(`dither-model: unknown version ${json.version}`);
  const q = new Int16Array(fromBase64(json.positions).buffer);
  const positions = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) positions[i] = q[i] / Q;
  const raw = fromBase64(json.indices).buffer;
  const indices = json.vertices <= 65536 ? new Uint16Array(raw) : new Uint32Array(raw);
  return { positions, indices, center: json.center, extent: json.extent, credit: json.credit, license: json.license };
}

/** Same shape as decodeModel, straight from simplified STL data (no packing). */
export function meshFromPositions(mesh) {
  return decodeModel(encodeModel(mesh));
}

function toBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(s) {
  if (typeof Buffer !== "undefined") {
    const b = Buffer.from(s, "base64");
    // copy into a fresh, aligned buffer so typed arrays can view it
    return new Uint8Array(b);
  }
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
