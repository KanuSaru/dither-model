// The script-tag build: registers <dither-model> and exposes the API as window.DitherModel.
import * as api from "./index.js";

api.defineDitherModel();
globalThis.DitherModel = api;
