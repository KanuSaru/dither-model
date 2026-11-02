import type { CSSProperties } from "react";
import type { ModelOptions } from "./index";

export interface DitherModelProps extends ModelOptions {
  className?: string;
  style?: CSSProperties;
  onLoad?: () => void;
}

export function DitherModel(props: DitherModelProps): JSX.Element;
