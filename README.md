# dither-model

Any STL as 1-bit pixel art, turning slowly on your page. Drag it (or use the arrow keys) to turn it yourself.

- **A tag for any web page**: `<dither-model>`, one script, no build step. Works on Neocities, Nekoweb, GitHub Pages or anywhere else.
- **A React component**: `<DitherModel />`, client-only, works in Next.js.
- **A CLI** that makes a big CAD file small: 132,000 triangles down to 9,000 and about 100 KB, still recognizable at the sizes this draws.

It uses the same 4×4 ordered dithering as [dither-moon](https://github.com/KanuSaru/dither-moon) and [dither-player](https://github.com/KanuSaru/dither-player), so the three sit well together. No WebGL: a tiny software renderer draws a frame in a few milliseconds.

## 1. Make the model small

```bash
npx dither-model thing.stl -o thing.json
```

| Flag | |
| --- | --- |
| `-o` | Where to write it. Default: next to the STL, as `.json` |
| `--triangles` | About how many to keep. Default 9000; 3000–6000 is plenty for small sizes |
| `--cell` | Instead: merge everything closer than this, in the file's units |
| `--credit`, `--license` | Kept inside the file, so the credit travels with the model |

Binary and ASCII STL both work. A raw `.stl` also works as `src` directly (it's simplified in the visitor's browser), but a converted file loads far faster.

## 2. Put it on a page

```html
<script src="https://cdn.jsdelivr.net/npm/dither-model@1/dist/dither-model.js"></script>

<dither-model src="thing.json" width="240" height="120" label="My thing"></dither-model>
```

| Attribute | Default | |
| --- | --- | --- |
| `src` | | A converted `.json` or a raw `.stl` |
| `width`, `height` | `240`, `120` | Size in CSS pixels |
| `pixel-size` | `2` | CSS pixels per model pixel; bigger is chunkier |
| `spin` | `24` | Seconds per turn. `0` stays still |
| `yaw`, `pitch` | `-25`, `18` | Starting angles, in degrees |
| `orient` | `0 0 0` | Degrees around x, y, z applied to the file first. Many STLs are Z-up: try `-90 0 0` |
| `zoom` | `0.95` | How much of the frame it fills; it never leaves the frame while turning |
| `dark` | | Boxes drawn dark, like a screen: `x0 y0 z0 x1 y1 z1`, in the file's units, `;` between boxes |
| `edges` | `true` | Dark lines where the surface folds; `false` for a softer look |
| `ambient` | `0.08` | Light on surfaces facing away, 0–1 |
| `light` | `-0.4 0.55 0.75` | Light direction: x right, y up, z toward you |
| `draggable` | `true` | Drag and arrow keys |
| `label` | | What it shows, for screen readers |
| `triangles` | `9000` | For a raw `.stl` only |

In the file's own axes, **y is up and +z faces you**. If yours comes out lying down or backwards, fix it with `orient`.

## React

```bash
npm install dither-model
```

```jsx
import { DitherModel } from "dither-model/react";

<DitherModel src="/models/thing.json" width={240} height={120} spin={20} label="My thing" />
```

## Without a framework

```js
import { createModel } from "dither-model";

const m = createModel(document.querySelector("#thing"), { src: "thing.json", width: 320, height: 160 });
await m.ready;
m.update({ spin: 0, yaw: 0 });
m.state; // { yaw, pitch, loaded }
m.destroy();
```

Also exported: `parseSTL`, `simplify`, `encodeModel`, `decodeModel`, `prepare` and `renderFrame` (pure; returns a `Uint8Array` of on/off pixels), if you want to draw it somewhere else.

## Looks

The ink is the text color where the model sits, so it follows your theme. Set it apart with a CSS variable:

```css
dither-model { --dm-ink: #e7e2d6; }
```

The background stays transparent.

## Good to know

- It only animates while it's on screen and the tab is visible.
- It respects `prefers-reduced-motion`: it stays still, and can still be dragged.
- Each model file loads once per page, however many copies show it.
- The light follows the viewer, so whatever side faces you is lit, including the back.
- **Check the license of any model you use.** Many CAD files allow sharing only with credit, or only for non-commercial use.

## Example: the Steam Deck

`examples/steam-deck/` has Valve's official Steam Deck shell, simplified. That model has its own license, **CC BY-NC-SA 4.0**, not MIT; see its README. It's in the repository for the demo and isn't published to npm.

```html
<dither-model src="steam-deck.json" dark="-88 -49.4 -1 88 50.6 1" label="Steam Deck"></dither-model>
```

## Try it

Open `demo/index.html` through any local server (`npx serve .`, then `/demo/`). You can drop your own STL on it; it stays in your browser.

## License

The code is MIT, Erick Donado. Models in `examples/` keep their own licenses.
