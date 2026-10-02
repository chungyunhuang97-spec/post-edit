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
export type CollageLayoutId =
  | "single"
  | "duo-h"
  | "duo-v"
  | "trio-h"
  | "trio-v"
  | "trio-main"
  | "quad-grid"
  | "quad-h"
  | "quad-v";

export interface CollageOption {
  id: CollageLayoutId;
  label: string;
}

/** How each cutout sticker is rendered onto the photo -- orthogonal to
 * ShapeId (the silhouette) and color (the fill). */
export type StickerStyleId = "halftone" | "flat";

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
  | "dot-art"
  | "cutout-block"
  | "journal-dots"
  | "airy-words"
  | "vertical-dots";

/** Which groups of controls a style actually uses. Anything a style leaves
 * out is hidden while that style is active, so the panels only list what
 * can change the result. */
export interface StyleFeatures {
  /** Where the caption sits relative to the photo (the six arrangements). */
  captionPosition: boolean;
  /** How much of the poster the caption block covers. */
  captionSize: boolean;
  /** Border around the poster. */
  frame: boolean;
  /** Flow / corner / scatter text arrangement. */
  captionMode: boolean;
  /** Whether the caption block can be switched off altogether (looks built
   * around it -- the paper, the colour block -- keep it). */
  captionBlock: boolean;
  captionBg: boolean;
  /** Cutout shapes: shape, size, count, style, colors. */
  shapes: boolean;
  /** The inline photo windows next to the words. */
  windows: boolean;
  tiles: boolean;
  dots: boolean;
  silhouette: boolean;
  /** Dot-matrix drawing of the photo laid over it. */
  dotArt: boolean;
}

export const ALL_FEATURES: StyleFeatures = {
  captionPosition: true,
  captionSize: true,
  frame: true,
  captionMode: true,
  captionBlock: true,
  captionBg: true,
  shapes: true,
  windows: true,
  tiles: true,
  dots: true,
  silhouette: true,
  dotArt: true,
};

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
  /** Sticker style for the cutout shapes (default: flat). */
  stickerStyleId?: StickerStyleId;
  /** Whether the cutout shapes show at all (default: true). */
  shapesEnabled?: boolean;
  /** Whether the caption shows at all (default: true). */
  captionEnabled?: boolean;
  /** The controls this style uses; the rest are hidden while it is active. */
  features: StyleFeatures;
  /** Colours that must move together while this style is active: `frame`
   * (frame, silhouette and caption block) or `sticker` (shapes follow the
   * caption block's colour). */
  linkedColors?: "frame" | "sticker";
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
  photo: number;
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
  /** Shows the cutout shapes as small photo windows inline with the caption
   * text (the original "挖空" look). Off keeps them only as stickers. */
  inlineWindows: boolean;
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
  dotArtEnabled: boolean;
  dotArtColor: string;
  /** Dot spacing as a % of the poster's content width. */
  dotArtCellPct: number;
  dotArtThreshold: number;
  dotArtInvert: boolean;
  dotArtArea: "all" | "subject" | "background";
  /** The dots show the photo shifted by this much (% of the poster width), like a misprint. */
  dotArtOffsetX: number;
  dotArtOffsetY: number;
  /** Scattered words are turned 90 degrees, dot first. */
  scatterVertical: boolean;
  /** Overlay layouts only: the text band has no fill, so text sits straight on the photo. */
  captionBgTransparent: boolean;
  /** Also cuts the subject out and pastes it (with a white sticker border)
   * elsewhere on the poster, leaving the flat silhouette where it was. */
  subjectPaste: boolean;
  /** Top-left of the pasted subject and its width, in % of the poster's
   * content area. */
  subjectPasteX: number;
  subjectPasteY: number;
  subjectPasteW: number;
  /** Which photo the pasted subject is cut from. */
  subjectPastePhoto: number;
}

export const DEFAULT_DECOR: DecorState = {
  frameInsetPct: 0,
  frameColor: "#c8102e",
  captionFraction: null,
  showCaptionText: true,
  captionMode: "flow",
  inlineWindows: true,
  tilesEnabled: false,
  tileNumbered: false,
  tileDragMode: "move",
  dotsEnabled: false,
  dotSizePx: 16,
  silhouetteEnabled: false,
  silhouetteColor: "#c8102e",
  dotArtEnabled: false,
  dotArtColor: "#ffffff",
  dotArtCellPct: 1.3,
  dotArtThreshold: 0.3,
  dotArtInvert: false,
  dotArtArea: "all",
  dotArtOffsetX: 0,
  dotArtOffsetY: 0,
  scatterVertical: false,
  captionBgTransparent: false,
  subjectPaste: false,
  subjectPasteX: 54,
  subjectPasteY: 58,
  subjectPasteW: 38,
  subjectPastePhoto: 0,
};
