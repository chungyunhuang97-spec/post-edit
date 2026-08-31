import { clipPathFor } from "./shapes";
import type { BracketOption, CanvasPreset, FontOption, LayoutOption, ShapeId, ShapeOption } from "./types";

// The caption/thumbnail zone is always exactly this fraction of the canvas
// height -- a fixed half-and-half split, regardless of how long the
// caption is or how many cutouts there are. A short caption is centered
// within its half rather than shrinking the zone to fit; an exceptionally
// long one is clipped rather than growing it (protecting the photo zone,
// which would otherwise be squeezable to zero by a fixed-px font size that
// takes up proportionally more of a narrow phone screen than desktop).
// Shared between the live preview (PosterPreview.tsx) and the canvas
// exporter (exportPoster.ts) so they can't disagree.
export const TOP_ZONE_FRACTION = 0.5;

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: "ig-post", label: "IG 貼文", sublabel: "1080 × 1350 · 4:5", width: 1080, height: 1350 },
  { id: "ig-story", label: "IG 限時動態 / Reels", sublabel: "1080 × 1920 · 9:16", width: 1080, height: 1920 },
  { id: "square", label: "正方形貼文", sublabel: "1080 × 1080 · 1:1", width: 1080, height: 1080 },
  { id: "custom", label: "自訂尺寸", sublabel: "輸入你要的寬高", width: 1080, height: 1350 },
];

// 10 fonts spanning 10 distinct type styles/categories -- each loaded as
// its own next/font/google variable in layout.tsx, so switching here is
// just swapping which CSS variable the caption zone's font-family reads.
export const FONT_OPTIONS: FontOption[] = [
  { id: "sans", label: "Sans（無襯線 · 預設）", cssVar: "var(--font-geist-sans)", fallback: "sans-serif" },
  { id: "serif", label: "Serif（詩意襯線）", cssVar: "var(--font-newsreader)", fallback: "serif" },
  { id: "mono", label: "Mono（打字機）", cssVar: "var(--font-geist-mono)", fallback: "monospace" },
  { id: "display-black", label: "Display Black（粗黑展示）", cssVar: "var(--font-archivo-black)", fallback: "sans-serif" },
  { id: "elegant-serif", label: "Elegant Serif（優雅襯線）", cssVar: "var(--font-playfair-display)", fallback: "serif" },
  { id: "geometric", label: "Geometric（幾何無襯線）", cssVar: "var(--font-space-grotesk)", fallback: "sans-serif" },
  { id: "handwriting", label: "Handwriting（手寫風）", cssVar: "var(--font-caveat)", fallback: "cursive" },
  { id: "condensed", label: "Condensed（窄體大寫）", cssVar: "var(--font-bebas-neue)", fallback: "sans-serif" },
  { id: "script", label: "Script（花體手寫）", cssVar: "var(--font-pacifico)", fallback: "cursive" },
  { id: "soft-serif", label: "Soft Serif（柔和襯線）", cssVar: "var(--font-fraunces)", fallback: "serif" },
];

export const LAYOUT_OPTIONS: LayoutOption[] = [
  { id: "text-top", label: "文字在上" },
  { id: "photo-top", label: "照片在上" },
  { id: "split-left", label: "左右：文字在左" },
  { id: "split-right", label: "左右：文字在右" },
];

// Every cutout "window" -- both the mask on the photo and its matching
// inline thumbnail -- is clipped with the same clip-path, so reshaping it
// never breaks the crop-matching math (clip-path only affects the visible
// silhouette, not the underlying background-position crop). clipPathFor
// shares its point data with the canvas Path2D used at export time
// (shapes.ts), so the preview and the exported PNG always agree.
const SHAPE_LABELS: Record<ShapeId, string> = {
  square: "方形",
  rounded: "圓角方形",
  circle: "圓形",
  diamond: "菱形",
  triangle: "三角形",
  pentagon: "五邊形",
  hexagon: "六邊形",
  star: "星形",
  sparkle: "閃亮星芒",
  cross: "十字形",
  parallelogram: "平行四邊形",
  heart: "愛心",
  flower: "花朵",
  blob: "液態泡泡",
  moon: "月牙",
  lightning: "閃電",
  cat: "貓咪",
  dog: "小狗",
};

export const SHAPE_OPTIONS: ShapeOption[] = (Object.keys(SHAPE_LABELS) as ShapeId[]).map((id) => ({
  id,
  label: SHAPE_LABELS[id],
  clipPath: clipPathFor(id),
}));

export const BRACKET_OPTIONS: BracketOption[] = [
  { id: "round-small", label: "（小圖）全形括號", open: "（", close: "）" },
  { id: "round-ascii", label: "(小圖) 半形括號", open: "(", close: ")" },
  { id: "square", label: "【小圖】方括號", open: "【", close: "】" },
  { id: "none", label: "無括號", open: "", close: "" },
];

// --- Local poetic-caption generator -----------------------------------
// Stand-in for the "Gemini AI 重新生成" button in the reference tool.
// This project doesn't wire up a live Gemini API key, so captions are
// assembled from a small template + word-bank pool instead. Swap the body
// of `generatePoeticCaption` for a real API call (e.g. a /api/caption
// route) later without touching any caller.

const SUBJECTS = ["Warm lanterns", "Quiet mornings", "Slow rivers", "City lights", "Autumn leaves", "Ocean waves"];
const VERBS = ["glow like", "drift like", "shimmer like", "settle like", "burn like", "fade like"];
const OBJECTS = [
  "luminous jewels",
  "scattered stars",
  "half-remembered dreams",
  "flickering candles",
  "distant fireflies",
  "melting gold",
];
const SETTINGS = [
  "against the deep indigo of a twilight sky",
  "beneath a sky still holding onto daylight",
  "over streets that never quite go quiet",
  "through the hush of an early winter morning",
  "along a horizon that keeps rewriting itself",
  "inside a moment too soft to name",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePoeticCaption(): string {
  return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)} ${pick(SETTINGS)}.`;
}
