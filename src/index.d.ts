export type Box = [number, number, number, number, number, number];

export interface Model {
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  center: number[];
  extent: number;
  credit?: string;
  license?: string;
}

export interface ModelOptions {
  /** A .json model made with the CLI, or a raw .stl (simplified in the browser) */
  src?: string;
  /** An already decoded model, instead of src */
  model?: Model;
  /** Size in CSS pixels. Default 240×120 */
  width?: number;
  height?: number;
  /** CSS pixels per model pixel. Default 2 */
  pixelSize?: number;
  /** Seconds per turn; 0 stays still. Default 24 */
  spin?: number;
  /** Starting angles in degrees. Default -25 and 18 */
  yaw?: number;
  pitch?: number;
  /** Degrees around x, y, z applied to the file first, e.g. [-90, 0, 0] for a Z-up file */
  orient?: [number, number, number];
  /** How much of the frame it fills. Default 0.95 */
  zoom?: number;
  /** Light on surfaces facing away from the light, 0–1. Default 0.08 */
  ambient?: number;
  /** Dark lines where the surface folds. Default true */
  edges?: boolean;
  /** Boxes, in the file's units, drawn dark (a screen, a window) */
  dark?: Box[];
  /** Light direction: x right, y up, z toward the viewer. Default [-0.4, 0.55, 0.75] */
  light?: [number, number, number];
  /** Drag or arrow keys to turn it. Default true */
  draggable?: boolean;
  /** What it shows, for screen readers */
  label?: string;
  /** For a raw STL: about how many triangles to keep. Default 9000 */
  triangles?: number;
}

export interface ModelHandle {
  ready: Promise<void>;
  canvas: HTMLCanvasElement;
  readonly state: { yaw: number; pitch: number; loaded: boolean };
  update(options: ModelOptions): Promise<void>;
  destroy(): void;
}

export function parseSTL(data: ArrayBuffer | ArrayBufferView): Float32Array;
export function simplify(corners: Float32Array, opts?: { cell?: number; triangles?: number }): { positions: Float32Array; indices: Uint32Array };
export function encodeModel(mesh: { positions: Float32Array; indices: ArrayLike<number> }, meta?: { credit?: string; license?: string; [k: string]: unknown }): object;
export function decodeModel(json: object): Model;
export function prepare(model: Model, opts?: { orient?: number[] }): object;
export function renderFrame(prepared: object, view: { yaw: number; pitch: number }, opts: object, buffers?: object): Uint8Array;
export function createModel(container: HTMLElement, options?: ModelOptions): ModelHandle;
export function loadModel(src: string, opts?: { triangles?: number }): Promise<Model>;
export class DitherModelElement extends HTMLElement {
  readonly model: ModelHandle | null;
}
export function defineDitherModel(name?: string): void;
