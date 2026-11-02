// <dither-model src="model.json"></dither-model>, for any web page.

import { createModel } from "./model.js";

const ATTRS = ["src", "width", "height", "pixel-size", "spin", "yaw", "pitch", "orient", "zoom", "ambient", "edges", "dark", "light", "draggable", "label", "triangles"];
const Base = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

export class DitherModelElement extends Base {
  static get observedAttributes() {
    return ATTRS;
  }

  connectedCallback() {
    if (this._model) return;
    this.style.display ||= "inline-block";
    this._model = createModel(this, this.options());
  }

  disconnectedCallback() {
    this._model?.destroy();
    this._model = null;
  }

  attributeChangedCallback() {
    this._model?.update(this.options());
  }

  /** The live model: `.ready`, `.state`, `.update()`. */
  get model() {
    return this._model;
  }

  options() {
    const num = (name) => {
      if (!this.hasAttribute(name)) return undefined;
      const v = Number(this.getAttribute(name));
      return Number.isFinite(v) ? v : undefined;
    };
    const list = (name) => {
      const v = this.getAttribute(name);
      if (!v) return undefined;
      const n = v.trim().split(/[\s,]+/).map(Number);
      return n.every(Number.isFinite) ? n : undefined;
    };
    const flag = (name) => (this.hasAttribute(name) ? this.getAttribute(name) !== "false" : undefined);
    // dark="x0 y0 z0 x1 y1 z1; …"
    const dark = (this.getAttribute("dark") || "")
      .split(";")
      .map((s) => s.trim().split(/[\s,]+/).map(Number))
      .filter((b) => b.length === 6 && b.every(Number.isFinite));
    return {
      src: this.getAttribute("src") || "",
      width: num("width"),
      height: num("height"),
      pixelSize: num("pixel-size"),
      spin: num("spin"),
      yaw: num("yaw"),
      pitch: num("pitch"),
      orient: list("orient"),
      zoom: num("zoom"),
      ambient: num("ambient"),
      edges: flag("edges"),
      dark,
      light: list("light"),
      draggable: flag("draggable"),
      label: this.getAttribute("label") || undefined,
      triangles: num("triangles"),
    };
  }
}

export function defineDitherModel(name = "dither-model") {
  if (typeof customElements !== "undefined" && !customElements.get(name)) customElements.define(name, DitherModelElement);
}
