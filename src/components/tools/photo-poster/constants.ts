import type { PhotoMood } from "./photoMood";
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

// For the two "overlay" layouts (photo fills the whole canvas, caption
// sits as an opaque band across the middle) -- how much of the canvas the
// band covers, centered on the middle third.
export const OVERLAY_BAND_FRACTION = 0.34;

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
  { id: "overlay-h", label: "文字橫跨中間" },
  { id: "overlay-v", label: "文字直跨中間" },
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

// --- Local social-caption generator -------------------------------------
// Stand-in for a real "analyze the photo" AI caption suggestion -- that
// needs a vision-capable model called from a server route with an API key,
// which this project doesn't have credentials for. Instead, photoMood.ts
// reads the uploaded photo's overall brightness/warmth/saturation on the
// client (no server, no key) and this picks a matching pool of casual,
// social-caption-style lines -- short and a little glib, not literary.
// Swap the body of `generateSocialCaption` for a real API call later
// (e.g. a /api/caption route) without touching any caller.

const SOCIAL_CAPTIONS: Record<PhotoMood, string[]> = {
  "bright-warm": [
    "golden hour never disappoints honestly",
    "sunshine and main character energy",
    "warm days good company only",
    "living for this golden light",
    "soft light big feelings today",
    "this is your sign to touch grass",
  ],
  "bright-cool": [
    "fresh air clear mind today",
    "cool tones calm nervous system",
    "blue skies quiet kind of day",
    "clean and crisp just like that",
    "breathing room finally found it",
    "no thoughts just this view",
  ],
  dark: [
    "night mode fully activated tonight",
    "moody lighting no notes honestly",
    "late nights hit different lately",
    "dim lights loud thoughts tonight",
    "this is just the vibe now",
    "low light high standards only",
  ],
  vibrant: [
    "too many colors not enough time",
    "loud colors louder personality today",
    "main character in full color",
    "vibrant chaos exactly my speed",
    "color overload absolutely no regrets",
    "not the colors doing the most",
  ],
  neutral: [
    "just a normal day surprisingly good",
    "little moments hit different lately",
    "not much just vibing today",
    "this is the whole mood",
    "casual post no big deal",
    "posting this because I can",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSocialCaption(mood: PhotoMood): string {
  return pick(SOCIAL_CAPTIONS[mood] ?? SOCIAL_CAPTIONS.neutral);
}
