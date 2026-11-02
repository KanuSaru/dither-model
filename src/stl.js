// Reads STL files, both kinds: binary (most CAD exports) and ASCII.
// Returns the triangles as a flat list of corner positions: [x, y, z, x, y, z, …], 9 numbers per triangle.

/** @param {ArrayBuffer | ArrayBufferView} data */
export function parseSTL(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (isBinary(bytes)) return parseBinary(bytes);
  return parseASCII(new TextDecoder().decode(bytes));
}

function isBinary(bytes) {
  if (bytes.length < 84) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  // a binary STL is exactly 84 bytes plus 50 per triangle; some ASCII files start with "solid" too,
  // and some binary ones do as well, so the size is the reliable test
  if (84 + count * 50 === bytes.length) return true;
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(512, bytes.length)));
  return !/^\s*solid[\s\S]*facet/.test(head);
}

function parseBinary(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.min(view.getUint32(80, true), Math.floor((bytes.length - 84) / 50));
  const out = new Float32Array(count * 9);
  for (let t = 0; t < count; t++) {
    const o = 84 + t * 50 + 12; // skip the stored normal; it's often missing, so it's computed later
    for (let k = 0; k < 9; k++) out[t * 9 + k] = view.getFloat32(o + k * 4, true);
  }
  return out;
}

function parseASCII(text) {
  const nums = [];
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  let m;
  while ((m = re.exec(text))) nums.push(+m[1], +m[2], +m[3]);
  const usable = nums.length - (nums.length % 9);
  if (!usable) throw new Error("dither-model: no triangles found in this STL");
  return Float32Array.from(nums.slice(0, usable));
}
