import type { PhotoMood } from "./photoMood";
import { clipPathFor } from "./shapes";
import type {
  BracketOption,
  CanvasPreset,
  CollageOption,
  FontOption,
  LayoutOption,
  ShapeId,
  ShapeOption,
  StickerStyleOption,
  StylePreset,
} from "./types";

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

export const COLLAGE_OPTIONS: CollageOption[] = [
  { id: "single", label: "單張照片" },
  { id: "duo-h", label: "雙張照片・左右並排" },
  { id: "duo-v", label: "雙張照片・上下並排" },
];

export const STICKER_STYLE_OPTIONS: StickerStyleOption[] = [
  { id: "die-cut", label: "切割貼紙", sublabel: "白色切邊 + 陰影" },
  { id: "halftone", label: "網點填色", sublabel: "riso 印刷網點質感" },
  { id: "polaroid", label: "拍立得", sublabel: "白框、微傾斜" },
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

// Six complete looks grounded in the 2026 "photo dump" moodboard (raw-grain
// authenticity, sticker/"gumball memories" ephemera, cinematic flash
// contrast, analog paper diaries, magazine-collage editorial cutting, plus
// the tool's own original default) -- each bundles every tab's worth of
// settings into one click so switching styles actually looks like a
// different poster, not just a different color. Applying one is a full
// reroll (like the existing 重新隨機排列 button), not a locked mode: every value
// it sets can still be nudged afterwards in its own tab.
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "classic",
    label: "經典手記",
    sublabel: "工具原始預設 · 俐落無襯線",
    shapeId: "square",
    bracketId: "round-small",
    fontOptionId: "sans",
    layout: "text-top",
    captionBgColor: "#15111f",
    textColor: "#f5f3ff",
    scaleMultiplier: 0.5,
    baseFontSizePx: 16,
    lineHeightMultiplier: 1.5,
    letterSpacingPx: 0,
    duotoneEnabled: false,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 6,
  },
  {
    id: "film-dump",
    label: "底片手感",
    sublabel: "顆粒 · 暖白紙感 · 手寫字",
    shapeId: "rounded",
    bracketId: "round-small",
    fontOptionId: "handwriting",
    layout: "photo-top",
    captionBgColor: "#f3e9da",
    textColor: "#3d2f22",
    scaleMultiplier: 0.9,
    baseFontSizePx: 20,
    lineHeightMultiplier: 1.6,
    letterSpacingPx: 0,
    duotoneEnabled: false,
    grainEnabled: true,
    grainIntensity: 16,
    cutoutCount: 5,
  },
  {
    id: "sticker-dump",
    label: "貼紙萬花筒",
    sublabel: "繽紛多色 · 花朵貼紙 · 花體字",
    shapeId: "flower",
    bracketId: "square",
    fontOptionId: "script",
    layout: "overlay-h",
    captionBgColor: "#ff5fa2",
    textColor: "#fffbe8",
    scaleMultiplier: 1.3,
    baseFontSizePx: 18,
    lineHeightMultiplier: 1.5,
    letterSpacingPx: 0,
    duotoneEnabled: false,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 7,
    palette: ["#ff5fa2", "#ffd23f", "#3ddc97", "#5b7fff", "#ff8a3d", "#c86bff", "#2fe0d0"],
  },
  {
    id: "cinematic-flash",
    label: "底片沖印",
    sublabel: "雙色調 · 高反差 · 閃光電影感",
    shapeId: "square",
    bracketId: "none",
    fontOptionId: "display-black",
    layout: "overlay-v",
    captionBgColor: "#120f10",
    textColor: "#f4fff0",
    scaleMultiplier: 0.7,
    baseFontSizePx: 22,
    lineHeightMultiplier: 1.3,
    letterSpacingPx: 1,
    duotoneEnabled: true,
    grainEnabled: true,
    grainIntensity: 20,
    cutoutCount: 4,
  },
  {
    id: "analog-diary",
    label: "手寫日記",
    sublabel: "留白 · 大地色 · 靜謐紙感",
    shapeId: "circle",
    bracketId: "none",
    fontOptionId: "soft-serif",
    layout: "text-top",
    captionBgColor: "#efe7da",
    textColor: "#54483a",
    scaleMultiplier: 0.8,
    baseFontSizePx: 16,
    lineHeightMultiplier: 1.8,
    letterSpacingPx: 0,
    duotoneEnabled: false,
    grainEnabled: true,
    grainIntensity: 8,
    cutoutCount: 3,
  },
  {
    id: "editorial-cutout",
    label: "雜誌剪貼",
    sublabel: "黑白 · 幾何圖形 · 襯線大標",
    shapeId: "triangle",
    bracketId: "square",
    fontOptionId: "elegant-serif",
    layout: "split-left",
    captionBgColor: "#111111",
    textColor: "#f5f2ea",
    scaleMultiplier: 1.0,
    baseFontSizePx: 18,
    lineHeightMultiplier: 1.4,
    letterSpacingPx: 1,
    duotoneEnabled: false,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 4,
  },
  {
    id: "subject-print",
    label: "主體網版",
    sublabel: "網點輪廓 · 大膽色塊 · 粗體大寫",
    shapeId: "hexagon",
    bracketId: "square",
    fontOptionId: "condensed",
    layout: "split-right",
    captionBgColor: "#ff5a1f",
    textColor: "#151005",
    scaleMultiplier: 1.1,
    baseFontSizePx: 24,
    lineHeightMultiplier: 1.2,
    letterSpacingPx: 2,
    duotoneEnabled: false,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 5,
    // The only preset built around subject segmentation -- silkscreen/
    // riso-print poster energy, where the detected subject prints as a dot
    // matrix instead of the usual flat background.
    subjectHalftoneEnabled: true,
  },
  {
    id: "acid-blocks",
    label: "迷幻色塊",
    sublabel: "撞色雙色調 · 閃電貼紙 · 幾何字",
    shapeId: "lightning",
    bracketId: "none",
    fontOptionId: "geometric",
    layout: "overlay-h",
    captionBgColor: "#ff2f7e",
    textColor: "#0d2b1f",
    scaleMultiplier: 1.1,
    baseFontSizePx: 20,
    lineHeightMultiplier: 1.4,
    letterSpacingPx: 0,
    duotoneEnabled: true,
    grainEnabled: false,
    grainIntensity: 30,
    cutoutCount: 5,
    palette: ["#39ff9e", "#ffe94d", "#00d4ff", "#ff2f7e", "#b06bff"],
  },
];

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
