export type CanvasPresetId = "ig-post" | "ig-story" | "square" | "custom";

export interface CanvasPreset {
  id: CanvasPresetId;
  label: string;
  sublabel: string;
  width: number;
  height: number;
}

export type FontOptionId =
  | "sans"
  | "serif"
  | "mono"
  | "display-black"
  | "elegant-serif"
  | "geometric"
  | "handwriting"
  | "condensed"
  | "script"
  | "soft-serif";

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

/** The concrete arrangements the poster's caption zone and photo zone can
 * be placed in relative to each other: 4 non-overlapping splits, plus 2
 * "overlay" layouts where the photo fills the whole canvas and the
 * caption sits as an opaque band across the middle. */
export type PosterLayoutId = "text-top" | "photo-top" | "split-left" | "split-right" | "overlay-h" | "overlay-v";

export interface LayoutOption {
  id: PosterLayoutId;
  label: string;
}

/** How many photos fill the photo zone, and which way they split it --
 * orthogonal to PosterLayoutId, which only controls where the *caption*
 * sits relative to the (single- or multi-photo) photo zone as a whole. */
export type CollageLayoutId = "single" | "duo-h" | "duo-v";

export interface CollageOption {
  id: CollageLayoutId;
  label: string;
}

/** How each cutout sticker is rendered onto the photo -- orthogonal to
 * ShapeId (the silhouette) and color (the fill). */
export type StickerStyleId = "die-cut" | "halftone" | "flat";

export interface StickerStyleOption {
  id: StickerStyleId;
  label: string;
  sublabel: string;
}

/** A complete, one-click look: every knob that otherwise has to be tuned
 * tab-by-tab (shape, bracket, font, layout, colors, type scale, duotone/
 * grain, cutout count) bundled into a single named combination, so the
 * poster can look genuinely different from one click instead of always
 * drifting back to the same default look. */
export type StylePresetId =
  | "film-dump"
  | "sticker-dump"
  | "cutout-block"
  | "journal-dots"
  | "airy-words"
  | "silhouette-frame";

export interface StylePreset {
  id: StylePresetId;
  label: string;
  sublabel: string;
  shapeId: ShapeId;
  bracketId: BracketStyleId;
  fontOptionId: FontOptionId;
  layout: PosterLayoutId;
  captionBgColor: string;
  textColor: string;
  scaleMultiplier: number;
  baseFontSizePx: number;
  lineHeightMultiplier: number;
  letterSpacingPx: number;
  grainEnabled: boolean;
  grainIntensity: number;
  cutoutCount: number;
  /** Sticker style for the cutout shapes (default: die-cut). */
  stickerStyleId?: StickerStyleId;
  /** Whether the cutout shapes show at all (default: true). */
  shapesEnabled?: boolean;
  /** Whether the caption shows at all (default: true). */
  captionEnabled?: boolean;
  /** Frame, caption mode, silhouette... (merged over DEFAULT_DECOR). */
  decor?: Partial<DecorState>;
  /** Free-placed small photos, solid dots and scattered word anchors, each
   * generated inside a region given in % of the poster. */
  tiles?: { count: number; region: { x0: number; y0: number; x1: number; y1: number }; aspects?: number[] };
  dots?: { count: number; region: { x0: number; y0: number; x1: number; y1: number }; palette: string[] };
  words?: { region: { x0: number; y0: number; x1: number; y1: number } };
  /** Cycling per-cutout color override (candy-sticker look). Omitted means
   * every cutout inherits the preset's captionBgColor as the shared sticker
   * color, as plain shapes cut from one sheet. */
  palette?: string[];
}

/** How the caption text is laid out: `flow` is the original centered
 * wrapping paragraph (with inline cutout thumbnails); `corner` stacks short
 * right-aligned lines in the top-right corner; `scatter` places every word
 * on its own, each marked with a small dot. The latter two are drawn in the
 * free-position overlay layer (see DecorState), not inside the caption zone. */
export type CaptionMode = "flow" | "corner" | "scatter";

/** A small photo placed freely on the poster (a crop of one of the
 * uploaded photos -- a contact-sheet / journal-page look). Position and
 * width are percentages of the poster's content area, so it survives any
 * canvas size; (u, v, s) pick which part of the source photo it shows, in
 * the photo's own natural coordinates, independent of the layout. */
export interface Tile {
  id: string;
  /** 0 = first photo, 1 = second (only meaningful with two photos). */
  photo: 0 | 1;
  /** Center of the crop within the source photo, 0-1. */
  u: number;
  v: number;
  /** Width of the crop as a fraction of the source photo's width. */
  s: number;
  xPct: number;
  yPct: number;
  wPct: number;
  /** width / height */
  aspect: number;
}

/** A solid decorative dot (the colored-sticker-dots look). */
export interface Dot {
  id: string;
  xPct: number;
  yPct: number;
  color: string;
}

/** Center of one scattered caption word, % of the poster's content area. */
export interface WordPos {
  xPct: number;
  yPct: number;
}

/** Everything the newer paper/journal/silhouette looks need beyond the
 * basic photo + caption-zone + cutout model. All of it has a neutral
 * default (see DEFAULT_DECOR) under which the poster renders exactly as it
 * did before these options existed. */
export interface DecorState {
  /** Border around the whole poster, as a % of its width (0 = none). */
  frameInsetPct: number;
  frameColor: string;
  /** Caption zone size as a fraction of the poster (null = the layout's
   * own default: 0.5 for splits, 0.34 for overlay bands). */
  captionFraction: number | null;
  /** Hides the words but keeps their layout space and the inline photo
   * windows, so a flat color block can carry shaped photo cut-outs only. */
  showCaptionText: boolean;
  captionMode: CaptionMode;
  tilesEnabled: boolean;
  tileNumbered: boolean;
  /** What dragging a small photo does: move it, or pan the part of the
   * source photo it shows. */
  tileDragMode: "move" | "crop";
  dotsEnabled: boolean;
  dotSizePx: number;
  /** Paints the detected subject of the first photo as a flat color shape. */
  silhouetteEnabled: boolean;
  silhouetteColor: string;
}

export const DEFAULT_DECOR: DecorState = {
  frameInsetPct: 0,
  frameColor: "#c8102e",
  captionFraction: null,
  showCaptionText: true,
  captionMode: "flow",
  tilesEnabled: false,
  tileNumbered: false,
  tileDragMode: "move",
  dotsEnabled: false,
  dotSizePx: 16,
  silhouetteEnabled: false,
  silhouetteColor: "#c8102e",
};
