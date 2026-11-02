"use client";

// React component. Works with React 18 and 19, including Next.js (client only).
//
//   import { DitherModel } from "dither-model/react";
//   <DitherModel src="/models/thing.json" width={240} height={120} label="A thing" />

import { createElement, useEffect, useRef } from "react";
import { createModel } from "./model.js";

const KEYS = ["src", "model", "width", "height", "pixelSize", "spin", "yaw", "pitch", "orient", "zoom", "ambient", "edges", "dark", "light", "draggable", "label", "triangles"];

export function DitherModel(props) {
  const { className, style, onLoad } = props;
  const box = useRef(null);
  const inst = useRef(null);
  const opts = {};
  for (const k of KEYS) if (props[k] !== undefined) opts[k] = props[k];
  const { model, ...plain } = opts;
  const key = JSON.stringify(plain);

  useEffect(() => {
    inst.current = createModel(box.current, { ...JSON.parse(key), model });
    inst.current.ready.then(() => onLoad?.());
    return () => {
      inst.current?.destroy();
      inst.current = null;
    };
    // created once; later changes go through update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    inst.current?.update({ ...JSON.parse(key), model });
  }, [key, model]);

  return createElement("div", { ref: box, className, style: { display: "inline-block", lineHeight: 0, ...style } });
}
