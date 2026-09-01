import { canvasShapePath } from "./shapes";
import type { SubjectMask } from "./subjectSegmentation";
import type { ShapeId } from "./types";

export interface HalftoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Params {
  /** Target grid spacing in canvas px. */
  cellPx: number;
  alpha: number;
  /** Dot size as a fraction of one grid cell, at the brightest and darkest
   * sampled cell respectively -- darker photo regions get bigger dots. */
  minScale: number;
  maxScale: number;
}

const DEFAULT_PARAMS: Params = {
  cellPx: 14,
  alpha: 0.6,
  minScale: 0.35,
  maxScale: 0.95,
};

/** Downscales the full photo onto a tiny cols x rows canvas and reads it
 * back 1:1 with grid cells, letting the browser's own image smoothing do
 * the per-cell brightness averaging. */
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
    out[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3 / 255;
  }
  return out;
}

/** Fraction of a handful of sample points within the given normalized
 * [u0,u1]x[v0,v1] cell that the mask marks as subject -- grid cells that
 * straddle the subject's silhouette edge get a partial value instead of an
 * all-or-nothing one, which is what gives the rendered edge a naturally
 * anti-aliased look instead of a jagged staircase. */
function maskCoverage(mask: SubjectMask, u0: number, v0: number, u1: number, v1: number): number {
  const SAMPLES = 3;
  let hit = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    const v = v0 + ((sy + 0.5) / SAMPLES) * (v1 - v0);
    const my = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)));
    for (let sx = 0; sx < SAMPLES; sx++) {
      const u = u0 + ((sx + 0.5) / SAMPLES) * (u1 - u0);
      const mx = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)));
      if (mask.data[my * mask.width + mx]) hit++;
    }
  }
  return hit / (SAMPLES * SAMPLES);
}

/** Paints a grid of shape-glyph "halftone" dots into `rect`, but only
 * where `mask` says the photo's detected subject actually is -- the dots
 * trace the subject's silhouette (a cat rendered as a field of dots
 * shaped like a cat, say) instead of tiling the whole rect uniformly.
 * Dot size still varies with the photo's own brightness within the
 * subject, same as a plain (unmasked) halftone would. `img` and `mask`
 * must refer to the same photo, `mask` covering its full extent regardless
 * of what portion of it `rect` ends up showing. */
export function drawSubjectHalftone(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  mask: SubjectMask,
  rect: HalftoneRect,
  shapeId: ShapeId,
  color: string,
  overrides: Partial<Params> = {},
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

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const coverage = maskCoverage(mask, col / cols, row / rows, (col + 1) / cols, (row + 1) / rows);
      if (coverage <= 0) continue;
      const t = 1 - brightness[row * cols + col];
      const dotSize = cellSize * coverage * (params.minScale + t * (params.maxScale - params.minScale));
      const cx = rect.x + (col + 0.5) * cellW;
      const cy = rect.y + (row + 0.5) * cellH;
      ctx.globalAlpha = params.alpha * coverage;
      ctx.fill(canvasShapePath(shapeId, cx - dotSize / 2, cy - dotSize / 2, dotSize));
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
