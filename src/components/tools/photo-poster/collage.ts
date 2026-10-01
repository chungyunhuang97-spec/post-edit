import type { CollageLayoutId } from "./types";

export const MAX_PHOTOS = 4;

/** A pane as fractions (0-1) of the photo zone. */
export interface PaneFrac {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRACS: Record<CollageLayoutId, PaneFrac[]> = {
  single: [{ x: 0, y: 0, w: 1, h: 1 }],
  "duo-h": [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  "duo-v": [
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
  ],
  "trio-h": [0, 1, 2].map((i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 1 })),
  "trio-v": [0, 1, 2].map((i) => ({ x: 0, y: i / 3, w: 1, h: 1 / 3 })),
  "trio-main": [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  "quad-grid": [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  "quad-h": [0, 1, 2, 3].map((i) => ({ x: i / 4, y: 0, w: 0.25, h: 1 })),
  "quad-v": [0, 1, 2, 3].map((i) => ({ x: 0, y: i / 4, w: 1, h: 0.25 })),
};

export function paneFracs(id: CollageLayoutId): PaneFrac[] {
  return FRACS[id];
}

export function photoCountOf(id: CollageLayoutId): number {
  return FRACS[id].length;
}

/** The layout to switch to when the photo count changes. */
export function defaultLayoutForCount(n: number): CollageLayoutId {
  return n >= 4 ? "quad-grid" : n === 3 ? "trio-main" : n === 2 ? "duo-h" : "single";
}

export function layoutsForCount(n: number): CollageLayoutId[] {
  return (Object.keys(FRACS) as CollageLayoutId[]).filter((id) => photoCountOf(id) === n);
}

/** Pane index containing (cx, cy) in a zone of w x h px. */
export function paneIndexAt(id: CollageLayoutId, w: number, h: number, cx: number, cy: number): number {
  const fr = FRACS[id];
  const i = fr.findIndex((f) => cx >= f.x * w && cx < (f.x + f.w) * w && cy >= f.y * h && cy < (f.y + f.h) * h);
  return i >= 0 ? i : cx < 0 || cy < 0 ? 0 : fr.length - 1;
}
