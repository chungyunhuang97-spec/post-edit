import { makeDots, makeTiles, makeWordPositions } from "./decorLayout";
import { zoneAspectOf } from "./zones";
import { ALL_FEATURES, DEFAULT_DECOR } from "./types";
import type {
  BracketStyleId,
  Cutout,
  DecorState,
  Dot,
  FontOptionId,
  PosterLayoutId,
  ShapeId,
  StickerStyleId,
  StylePreset,
  Tile,
  WordPos,
} from "./types";
import { randomizeCutouts, wordCountOf } from "./useCutoutLayout";

const NO_FEATURES = Object.fromEntries(Object.keys(ALL_FEATURES).map((k) => [k, false])) as unknown as typeof ALL_FEATURES;

const JOURNAL_DOTS = ["#f4b400", "#1a56db", "#d9381e", "#188038"];

// Six looks that differ in *composition*, not just color: each one is a
// different arrangement of the same few parts (photo, paper, shapes, small
// prints, dots, text). Applying one is a full reroll of everything it
// covers; every value can still be nudged afterwards in its own tab.
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "film-dump",
    label: "底片手感",
    sublabel: "暖白紙感 · 顆粒 · 手寫字",
    shapeId: "rounded",
    bracketId: "round-small",
    fontOptionId: "handwriting",
    layout: "photo-top",
    captionBgColor: "#f3e9da",
    textColor: "#3d2f22",
    scaleMultiplier: 1.1,
    baseFontSizePx: 20,
    lineHeightMultiplier: 1.6,
    letterSpacingPx: 0,
    grainEnabled: true,
    grainIntensity: 16,
    cutoutCount: 5,
    features: { ...NO_FEATURES, captionBlock: true, captionPosition: true, captionSize: true, captionBg: true, shapes: true, windows: true },
  },
  {
    id: "gallery-poster",
    label: "展覽海報",
    sublabel: "細黑框 · 窄文案欄 · 襯線角落小字 · 單一紅點",
    shapeId: "circle",
    bracketId: "none",
    fontOptionId: "elegant-serif",
    layout: "split-left",
    captionBgColor: "#efece4",
    textColor: "#1a1a1a",
    scaleMultiplier: 1,
    baseFontSizePx: 15,
    lineHeightMultiplier: 1.5,
    letterSpacingPx: 1,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 3,
    shapesEnabled: false,
    decor: {
      captionMode: "corner",
      captionFraction: 0.3,
      frameInsetPct: 4,
      frameColor: "#1a1a1a",
      dotsEnabled: true,
      dotSizePx: 34,
    },
    // One red dot low in the narrow paper column, as on a printed exhibition poster.
    dots: { count: 1, region: { x0: 30, y0: 78, x1: 40, y1: 88 }, palette: ["#d9381e"] },
    features: { ...NO_FEATURES, captionPosition: true, captionSize: true, captionBg: true, frame: true, dots: true },
  },
  {
    id: "cutout-block",
    label: "挖空色塊",
    sublabel: "單色色塊 · 形狀挖出照片",
    shapeId: "star",
    bracketId: "none",
    fontOptionId: "geometric",
    layout: "text-top",
    captionBgColor: "#d6232a",
    textColor: "#fff1ea",
    scaleMultiplier: 3,
    baseFontSizePx: 20,
    lineHeightMultiplier: 1.4,
    letterSpacingPx: 0,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 2,
    stickerStyleId: "flat",
    decor: { captionFraction: 0.3 },
    linkedColors: "sticker",
    features: { ...NO_FEATURES, captionSize: true, captionBg: true, shapes: true, windows: true },
  },
  {
    id: "journal-dots",
    label: "手帳彩點",
    sublabel: "米白紙 · 編號小照片 · 彩色圓點",
    shapeId: "circle",
    bracketId: "none",
    fontOptionId: "sans",
    layout: "split-right",
    captionBgColor: "#f4f3ee",
    textColor: "#1c1c1a",
    scaleMultiplier: 1,
    baseFontSizePx: 14,
    lineHeightMultiplier: 1.4,
    letterSpacingPx: 0,
    grainEnabled: true,
    grainIntensity: 10,
    cutoutCount: 3,
    shapesEnabled: false,
    decor: { captionMode: "corner", tilesEnabled: true, tileNumbered: true, dotsEnabled: true, dotSizePx: 16 },
    // Regions are % of the paper (the caption zone); the dots reach left
    // past its edge so some of them overlap the photo, as in a journal page.
    tiles: { count: 4, region: { x0: 8, y0: 15, x1: 94, y1: 90 } },
    dots: { count: 5, region: { x0: -28, y0: 3, x1: 96, y1: 97 }, palette: JOURNAL_DOTS },
    features: { ...NO_FEATURES, captionSize: true, captionBg: true, tiles: true, dots: true },
  },
  {
    id: "airy-words",
    label: "留白散字",
    sublabel: "淺灰紙 · 小照片 · 單字帶圓點",
    shapeId: "circle",
    bracketId: "none",
    fontOptionId: "sans",
    layout: "text-top",
    captionBgColor: "#f1f0ec",
    textColor: "#1a1a1a",
    scaleMultiplier: 1,
    baseFontSizePx: 17,
    lineHeightMultiplier: 1.4,
    letterSpacingPx: 0,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 3,
    shapesEnabled: false,
    decor: { captionMode: "scatter", captionFraction: 1, tilesEnabled: true },
    tiles: { count: 1, region: { x0: 18, y0: 18, x1: 82, y1: 56 }, aspects: [1.5] },
    words: { region: { x0: 14, y0: 62, x1: 86, y1: 92 } },
    features: { ...NO_FEATURES, captionMode: true, captionBg: true, tiles: true },
  },
  {
    id: "silhouette-frame",
    label: "剪影填色",
    sublabel: "色塊外框 · 主體填成純色剪影",
    shapeId: "square",
    bracketId: "none",
    fontOptionId: "sans",
    layout: "photo-top",
    captionBgColor: "#d3141b",
    textColor: "#fff5f0",
    scaleMultiplier: 1,
    baseFontSizePx: 18,
    lineHeightMultiplier: 1.5,
    letterSpacingPx: 0,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 3,
    shapesEnabled: false,
    decor: {
      frameInsetPct: 5,
      frameColor: "#d3141b",
      silhouetteEnabled: true,
      silhouetteColor: "#d3141b",
      subjectPaste: true,
      subjectPasteX: 56,
      subjectPasteY: 60,
      subjectPasteW: 36,
      captionFraction: 0.2,
    },
    linkedColors: "frame",
    features: { ...NO_FEATURES, captionSize: true, frame: true, silhouette: true },
  },
];

/** Every value a preset sets, resolved into concrete state. The live app
 * applies this to its state; the style carousel renders thumbnails from the
 * very same object, so a thumbnail can never disagree with what applying
 * the style actually produces. */
export interface StyleState {
  shapeId: ShapeId;
  bracketId: BracketStyleId;
  fontOptionId: FontOptionId;
  layout: PosterLayoutId;
  captionBgColor: string;
  textColor: string;
  stickerColor: string;
  scaleMultiplier: number;
  baseFontSizePx: number;
  lineHeightMultiplier: number;
  letterSpacingPx: number;
  grainEnabled: boolean;
  grainIntensity: number;
  stickerStyleId: StickerStyleId;
  shapesEnabled: boolean;
  captionEnabled: boolean;
  decor: DecorState;
  cutouts: Cutout[];
  tiles: Tile[];
  dots: Dot[];
  wordPositions: WordPos[];
}

export function buildStyleState(
  preset: StylePreset,
  opts: { caption: string; canvasAspect: number; photoCount: number },
): StyleState {
  const decor: DecorState = {
    ...DEFAULT_DECOR,
    ...preset.decor,
    // The sticker/silhouette color defaults follow the preset's own ground.
  };
  const zoneAspect = zoneAspectOf(preset.layout, decor.captionFraction, opts.canvasAspect, preset.captionEnabled ?? true);
  const cutouts = randomizeCutouts(preset.cutoutCount, wordCountOf(opts.caption)).map((c, i) => ({
    ...c,
    color: preset.palette ? preset.palette[i % preset.palette.length] : null,
  }));
  return {
    shapeId: preset.shapeId,
    bracketId: preset.bracketId,
    fontOptionId: preset.fontOptionId,
    layout: preset.layout,
    captionBgColor: preset.captionBgColor,
    textColor: preset.textColor,
    stickerColor: preset.captionBgColor,
    scaleMultiplier: preset.scaleMultiplier,
    baseFontSizePx: preset.baseFontSizePx,
    lineHeightMultiplier: preset.lineHeightMultiplier,
    letterSpacingPx: preset.letterSpacingPx,
    grainEnabled: preset.grainEnabled,
    grainIntensity: preset.grainIntensity,
    stickerStyleId: preset.stickerStyleId ?? "flat",
    shapesEnabled: preset.shapesEnabled ?? true,
    captionEnabled: preset.captionEnabled ?? true,
    decor,
    cutouts,
    // At least one tile per uploaded photo, so none of them goes missing
    // from looks (like 留白散字) that don't show the photo zone itself.
    tiles: preset.tiles
      ? makeTiles(
          Math.max(preset.tiles.count, opts.photoCount),
          preset.tiles.region,
          zoneAspect,
          opts.photoCount,
          preset.tiles.aspects,
        )
      : [],
    dots: preset.dots ? makeDots(preset.dots.count, preset.dots.region, preset.dots.palette) : [],
    wordPositions: preset.words ? makeWordPositions(wordCountOf(opts.caption), preset.words.region) : [],
  };
}
