import type { SubjectMask } from "./subjectSegmentation";

/** Which part of the photo gets dots. */
export type DotArtArea = "all" | "subject" | "background";

export interface DotArtOptions {
  /** Grid cell size in px (output space). */
  cellPx: number;
  /** 0-1: cells darker than this (or brighter, when inverted) get a dot. */
  threshold: number;
  invert: boolean;
  area: DotArtArea;
  color: string;
  /** The dots show the photo shifted by this much (px): the print is off-register. */
  offsetX?: number;
  offsetY?: number;
}

/** Turns the visible part of a cover-fit photo into a dot-matrix drawing
 * (like a dot-art generator): the pane is cut into a grid, each cell's
 * brightness is compared with a threshold, and cells that pass get a round
 * dot. The result is drawn straight onto `ctx` over the photo, so only the
 * dots cover it. `pixelRatio` scales the pane for hi-dpi canvases. */
export function drawDotArt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  mask: SubjectMask | null,
  pane: { x: number; y: number; w: number; h: number },
  geom: { offsetX: number; offsetY: number; renderedW: number; renderedH: number },
  opts: DotArtOptions,
): void {
  if (!geom.renderedW || !img.naturalWidth || pane.w <= 0 || pane.h <= 0) return;
  const cols = Math.max(4, Math.round(pane.w / opts.cellPx));
  const rows = Math.max(4, Math.round(pane.h / opts.cellPx));
  const cw = pane.w / cols;
  const ch = pane.h / rows;
  // The part of the source photo that this pane shows.
  const sx = ((-geom.offsetX - (opts.offsetX ?? 0)) / geom.renderedW) * img.naturalWidth;
  const sy = ((-geom.offsetY - (opts.offsetY ?? 0)) / geom.renderedH) * img.naturalHeight;
  const sw = (pane.w / geom.renderedW) * img.naturalWidth;
  const sh = (pane.h / geom.renderedH) * img.naturalHeight;
  const tmp = document.createElement("canvas");
  tmp.width = cols;
  tmp.height = rows;
  const t = tmp.getContext("2d", { willReadFrequently: true });
  if (!t) return;
  t.imageSmoothingQuality = "high";
  t.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  const { data } = t.getImageData(0, 0, cols, rows);
  const lums = new Float32Array(cols * rows);
  for (let k = 0; k < cols * rows; k++) {
    lums[k] = (0.299 * data[k * 4] + 0.587 * data[k * 4 + 1] + 0.114 * data[k * 4 + 2]) / 255;
  }
  // Auto-level so the threshold means the same on a dark or a bright photo.
  const sorted = Float32Array.from(lums).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const range = Math.max(0.1, hi - lo);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.w, pane.h);
  ctx.clip();
  ctx.fillStyle = opts.color;
  const radius = Math.min(cw, ch) * 0.3;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const norm = Math.min(1, Math.max(0, (lums[j * cols + i] - lo) / range));
      const on = opts.invert ? norm > opts.threshold : norm < opts.threshold;
      if (!on) continue;
      if (opts.area !== "all" && mask) {
        const u = (((i + 0.5) * cw - geom.offsetX) / geom.renderedW) * mask.width;
        const v = (((j + 0.5) * ch - geom.offsetY) / geom.renderedH) * mask.height;
        const mx = Math.min(mask.width - 1, Math.max(0, Math.floor(u)));
        const my = Math.min(mask.height - 1, Math.max(0, Math.floor(v)));
        const inSubject = mask.data[my * mask.width + mx] > 0;
        if ((opts.area === "subject") !== inSubject) continue;
      }
      ctx.beginPath();
      ctx.arc(pane.x + (i + 0.5) * cw, pane.y + (j + 0.5) * ch, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
