#!/usr/bin/env node
// Turns an STL into a small dither-model file.
//
//   npx dither-model thing.stl                       → thing.json, about 9,000 triangles
//   npx dither-model thing.stl -o public/thing.json --triangles 6000 \
//       --credit "Thing by Someone" --license "CC BY 4.0"

import fs from "node:fs";
import path from "node:path";
import { parseSTL } from "../src/stl.js";
import { simplify } from "../src/simplify.js";
import { encodeModel } from "../src/format.js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(`Usage: dither-model <file.stl> [-o out.json] [--triangles 9000 | --cell <size>] [--credit "…"] [--license "…"]`);
  process.exit(args.length ? 0 : 1);
}
const out = flag("-o") ?? flag("--out");
const triangles = flag("--triangles");
const cell = flag("--cell");
const credit = flag("--credit");
const license = flag("--license");
const input = args[0];

const corners = parseSTL(fs.readFileSync(input));
const before = corners.length / 9;
const mesh = simplify(corners, cell ? { cell: +cell } : { triangles: triangles ? +triangles : 9000 });
const meta = {};
if (credit) meta.credit = credit;
if (license) meta.license = license;
const json = JSON.stringify(encodeModel(mesh, meta));
const file = out ?? input.replace(/\.stl$/i, "") + ".json";
fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
fs.writeFileSync(file, json);
console.log(`${input}: ${before.toLocaleString("en")} triangles → ${(mesh.indices.length / 3).toLocaleString("en")} in ${file} (${Math.round(json.length / 1024)} KB)`);
