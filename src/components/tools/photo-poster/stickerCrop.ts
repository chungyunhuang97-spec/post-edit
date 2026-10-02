import { paneFracs, paneIndexAt } from "./collage";
import type { CollageLayoutId } from "./types";

/** The cover-fit placement of one photo inside its pane (see
 * computeCoverGeometry / coverGeometry). */
export interface CropGeom {
  offsetX: number;
  offsetY: number;
  renderedW: number;
  renderedH: number;
}

export interface SourceRect {
  sx: number;
  sy: number;
  sSize: number;
}

/** Which photo pane a sticker's center sits over, and its top-left corner
 * relative to that pane. In single mode there is one pane (the whole zone),
 * so this is the identity. Lets stickers and caption thumbnails in a
 * two-photo layout show the photo they actually sit on, instead of a flat
 * color chip. */
export function locateInPane(
  layout: CollageLayoutId,
  zoneW: number,
  zoneH: number,
  xPx: number,
  yPx: number,
  sizePx: number,
): { index: number; x: number; y: number } {
  const index = paneIndexAt(layout, zoneW, zoneH, xPx + sizePx / 2, yPx + sizePx / 2);
  const f = paneFracs(layout)[index];
  return { index, x: xPx - f.x * zoneW, y: yPx - f.y * zoneH };
}

/** The square region of the source image (in source px) that a sticker of
 * `sizePx` shows, centered on the sticker and magnified by `magnify`
 * (1 = exactly what's under it). `sourceW` is the width of the actual
 * bitmap being sampled, which may differ from the photo's natural width
 * (e.g. a downscaled duotone copy). Returns null before geometry is known. */
export function stickerSourceRect(
  geom: CropGeom,
  sourceW: number,
  x: number,
  y: number,
  sizePx: number,
  magnify: number,
): SourceRect | null {
  if (!geom.renderedW || !sourceW) return null;
  const scale = geom.renderedW / sourceW;
  const s = sizePx / scale / magnify;
  const cx = (-geom.offsetX + x + sizePx / 2) / scale;
  const cy = (-geom.offsetY + y + sizePx / 2) / scale;
  return { sx: cx - s / 2, sy: cy - s / 2, sSize: s };
}

/** Draws a riso-style halftone of the sampled photo region into the square
 * at (x, y): no paper behind it (whatever is under shows through), a grid of `color` dots whose size follows
 * how dark that part of the photo is -- so the sticker actually carries the
 * picture, as a printed dot screen, rather than a generic dot texture. */
export function drawHalftoneTile(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  r: SourceRect,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const cell = Math.max(3, size * 0.12);
  const n = Math.max(3, Math.round(size / cell));
  const tmp = document.createElement("canvas");
  tmp.width = n;
  tmp.height = n;
  const t = tmp.getContext("2d", { willReadFrequently: true });
  if (!t) return;
  t.drawImage(source, r.sx, r.sy, r.sSize, r.sSize, 0, 0, n, n);
  const { data } = t.getImageData(0, 0, n, n);
  const c = size / n;
  // Stretch each tile's own brightness range to 0-1: a small crop of a
  // uniformly dark or bright area would otherwise print as a flat grid of
  // same-size dots, with no visible picture in it.
  const lums = new Float32Array(n * n);
  let lo = 1;
  let hi = 0;
  for (let k = 0; k < n * n; k++) {
    const l = (0.299 * data[k * 4] + 0.587 * data[k * 4 + 1] + 0.114 * data[k * 4 + 2]) / 255;
    lums[k] = l;
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
  }
  const range = Math.max(0.15, hi - lo);
  ctx.fillStyle = color;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const lum = Math.min(1, Math.max(0, (lums[j * n + i] - lo) / range));
      const radius = c * 0.5 * Math.sqrt(1 - lum) * 1.15;
      if (radius < 0.4) continue;
      ctx.beginPath();
      ctx.arc(x + (i + 0.5) * c, y + (j + 0.5) * c, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
