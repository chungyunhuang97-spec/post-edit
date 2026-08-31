export type CanvasPresetId = "ig-post" | "ig-story" | "square" | "custom";

export interface CanvasPreset {
  id: CanvasPresetId;
  label: string;
  sublabel: string;
  width: number;
  height: number;
}

export type FontOptionId = "sans" | "display" | "serif" | "mono";

export interface FontOption {
  id: FontOptionId;
  label: string;
  cssVar: string;
  fallback: string;
}

export type BracketStyleId = "round-small" | "round-ascii" | "square" | "none";

export interface BracketOption {
  id: BracketStyleId;
  label: string;
  open: string;
  close: string;
}

export type ShapeId =
  | "square"
  | "rounded"
  | "circle"
  | "diamond"
  | "triangle"
  | "pentagon"
  | "hexagon"
  | "star"
  | "cross"
  | "parallelogram"
  | "heart"
  | "flower"
  | "blob"
  | "sparkle"
  | "moon"
  | "lightning"
  | "cat"
  | "dog";

export interface ShapeOption {
  id: ShapeId;
  label: string;
  /** CSS clip-path value applied to both the photo-side mask and the
   * matching inline thumbnail, so the "hole" and its crop always agree. */
  clipPath: string;
}

/** A single draggable "cutout window" — position is stored as a percentage
 * of the photo's rendered box so it stays correct across canvas sizes. */
export interface Cutout {
  id: string;
  /** top-left corner, 0-100, percentage of the photo box */
  xPct: number;
  yPct: number;
  /** index into the caption's word list this cutout's thumbnail is
   * inserted after; clamped at render time if the caption gets shorter. */
  wordIndex: number;
  /** Per-cutout fill color override; null means "inherit the global
   * top-background color" (the original, still-default behavior). */
  color: string | null;
}

/** One token in the flowed caption: either a plain word or a cutout marker
 * referencing a Cutout by id. */
export type CaptionToken = { kind: "word"; text: string } | { kind: "cutout"; cutoutId: string };
