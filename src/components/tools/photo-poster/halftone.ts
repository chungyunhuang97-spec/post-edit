import { canvasShapePath } from "./shapes";
import type { ShapeId } from "./types";

export interface HalftoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface HalftoneParams {
  /** Target grid spacing in canvas px -- scales the dot count with the
   * zone's own rendered size instead of a fixed cols/rows count, so the
   * pattern reads at roughly the same density in the live preview and the
   * (much larger) exported canvas. */
  cellPx: number;
  alpha: number;
  /** Dot size as a fraction of one grid cell, at the brightest and darkest
   * sampled cell respectively -- darker photo regions get bigger dots,
   * classic newsprint-halftone style. */
  minScale: number;
  maxScale: number;
}

const DEFAULT_PARAMS: HalftoneParams = {
  cellPx: 16,
  alpha: 0.4,
  minScale: 0.2,
  maxScale: 0.85,
};

/** Downscales the full source photo onto a tiny cols x rows canvas and
 * reads it back 1:1 with grid cells -- letting the browser's own image
 * smoothing do the per-cell brightness averaging instead of hand-rolled
 * box filtering. Not real image segmentation or subject tracking, just a
 * coarse tone map of the whole photo. */
function sampleBrightnessGrid(img: CanvasImageSource, cols: number, rows: number): Float32Array {
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  const out = new Float32Array(cols * rows).fill(0.5);
  if (!sctx) return out;
  sctx.drawImage(img, 0, 0, cols, rows);
  const { data } = sctx.getImageData(0, 0, cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = (r + g + b) / 3 / 255;
  }
  return out;
}

/** Paints a grid of shape-glyph "halftone" dots into `rect`, reusing the
 * currently-selected cutout shape as the dot glyph instead of a plain
 * circle, sized in inverse proportion to the source photo's per-cell
 * brightness (darker regions of the photo -> bigger dots). Meant as a
 * decorative background texture behind the caption text, derived from the
 * photo's overall tone map rather than any real subject detection. */
export function drawHalftone(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  rect: HalftoneRect,
  shapeId: ShapeId,
  color: string,
  overrides: Partial<HalftoneParams> = {},
): void {
  if (rect.w <= 0 || rect.h <= 0) return;
  const params = { ...DEFAULT_PARAMS, ...overrides };
  const cols = Math.max(1, Math.round(rect.w / params.cellPx));
  const rows = Math.max(1, Math.round(rect.h / params.cellPx));
  const brightness = sampleBrightnessGrid(img, cols, rows);
  const cellW = rect.w / cols;
  const cellH = rect.h / rows;
  const cellSize = Math.min(cellW, cellH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.globalAlpha = params.alpha;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const t = 1 - brightness[row * cols + col];
      const dotSize = cellSize * (params.minScale + t * (params.maxScale - params.minScale));
      const cx = rect.x + (col + 0.5) * cellW;
      const cy = rect.y + (row + 0.5) * cellH;
      ctx.fill(canvasShapePath(shapeId, cx - dotSize / 2, cy - dotSize / 2, dotSize));
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
