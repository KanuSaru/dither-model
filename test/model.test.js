import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSTL, simplify, encodeModel, decodeModel, prepare, renderFrame } from "../src/index.js";
import { darkBoxes, lightFrom } from "../src/render.js";

// a 2×2×2 cube around the origin: 12 triangles
const Q = [[0, 1, 2, 0, 2, 3]];
const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]];
const tris = F.flatMap((f) => Q[0].map((i) => f[i])).map((i) => V[i]);

function binarySTL(points) {
  const n = points.length / 3;
  const buf = Buffer.alloc(84 + n * 50);
  buf.writeUInt32LE(n, 80);
  points.forEach((p, k) => {
    const t = Math.floor(k / 3), c = k % 3;
    p.forEach((v, a) => buf.writeFloatLE(v, 84 + t * 50 + 12 + c * 12 + a * 4));
  });
  return buf;
}
function asciiSTL(points) {
  let s = "solid cube\n";
  for (let t = 0; t < points.length; t += 3) {
    s += " facet normal 0 0 0\n  outer loop\n";
    for (let c = 0; c < 3; c++) s += `   vertex ${points[t + c].join(" ")}\n`;
    s += "  endloop\n endfacet\n";
  }
  return Buffer.from(s + "endsolid cube\n");
}

test("reads binary and ASCII STL the same", () => {
  const a = parseSTL(binarySTL(tris)), b = parseSTL(asciiSTL(tris));
  assert.equal(a.length, 12 * 9);
  assert.deepEqual([...a], [...b]);
});

test("binary STL whose header starts with 'solid' is still binary", () => {
  const buf = binarySTL(tris);
  buf.write("solid made by some CAD tool", 0);
  assert.equal(parseSTL(buf).length, 12 * 9);
});

test("simplify merges shared corners and keeps a small mesh whole", () => {
  const m = simplify(parseSTL(binarySTL(tris)));
  assert.equal(m.positions.length / 3, 8);
  assert.equal(m.indices.length / 3, 12);
});

test("simplify brings a dense mesh near the target", () => {
  // a finely cut sphere
  const pts = [];
  const S = 60;
  const at = (i, j) => {
    const th = (i / S) * Math.PI, ph = (j / S) * 2 * Math.PI;
    return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  };
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) pts.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  const corners = Float32Array.from(pts.flat());
  const m = simplify(corners, { triangles: 1500 });
  const n = m.indices.length / 3;
  assert.ok(n < corners.length / 9 / 3, `still ${n} triangles`);
  assert.ok(n > 600 && n < 3000, `${n} triangles`);
});

test("packing keeps positions within a hair and keeps credit", () => {
  const m = simplify(parseSTL(binarySTL(tris)));
  const json = JSON.parse(JSON.stringify(encodeModel(m, { credit: "Cube by me", license: "CC0" })));
  const d = decodeModel(json);
  assert.equal(d.credit, "Cube by me");
  assert.equal(d.license, "CC0");
  assert.deepEqual(d.center, [0, 0, 0]);
  assert.equal(d.extent, 1);
  for (let i = 0; i < m.positions.length; i++) assert.ok(Math.abs(d.positions[i] - m.positions[i]) < 1e-4);
  assert.deepEqual([...d.indices], [...m.indices]);
  assert.throws(() => decodeModel({ format: "something-else" }));
});

test("renders ink inside the frame, and dark boxes stay empty", () => {
  const d = decodeModel(encodeModel(simplify(parseSTL(binarySTL(tris)))));
  const p = prepare(d);
  const o = { w: 40, h: 40, zoom: 0.9, light: lightFrom([0, 0, 1]), ambient: 0.08, edges: -2 };
  const bits = renderFrame(p, { yaw: 0, pitch: 0 }, o);
  const ink = bits.reduce((a, b) => a + b, 0);
  assert.ok(ink > 300, `only ${ink} pixels`);
  assert.equal(bits[0], 0); // a corner of the frame stays empty
  // the whole front face dark: nothing left facing the viewer
  const dark = darkBoxes([[-2, -2, 0.9, 2, 2, 1.1]], p);
  const none = renderFrame(p, { yaw: 0, pitch: 0 }, { ...o, dark });
  assert.equal(none.reduce((a, b) => a + b, 0), 0);
});

test("orient turns the model before drawing", () => {
  const d = decodeModel(encodeModel(simplify(parseSTL(binarySTL(tris)))));
  const p = prepare(d, { orient: [90, 0, 0] });
  // a vertex at (x, y, z) goes to (x, -z, y) after 90° around x
  const i = [...d.positions].findIndex((_, k) => k % 3 === 0 && d.positions[k] === -1 && d.positions[k + 1] === -1 && d.positions[k + 2] === 1);
  assert.ok(Math.abs(p.pos[i + 1] - -1) < 1e-6 && Math.abs(p.pos[i + 2] - -1) < 1e-6);
});
