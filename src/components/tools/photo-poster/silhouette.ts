import type { SubjectMask } from "./subjectSegmentation";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Paints the detected subject as a flat-color shape onto `ctx`, aligned
 * with a cover-fit photo placed at (x + offsetX, y + offsetY) with the
 * given rendered size, and clipped to the (x, y, w, h) pane. Each output
 * pixel samples the (0/1) mask bilinearly and thresholds it softly, so the
 * low-resolution model mask still gets a smooth, crisp outline instead of
 * a blocky or blurry one. */
export function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  mask: SubjectMask,
  color: string,
  pane: { x: number; y: number; w: number; h: number },
  geom: { offsetX: number; offsetY: number; renderedW: number; renderedH: number },
  pixelRatio = 1,
): void {
  const w = Math.max(1, Math.round(pane.w * pixelRatio));
  const h = Math.max(1, Math.round(pane.h * pixelRatio));
  if (!geom.renderedW || !geom.renderedH) return;
  const [r, g, b] = hexToRgb(color);
  const out = ctx.createImageData(w, h);
  const { data: m, width: mw, height: mh } = mask;
  for (let py = 0; py < h; py++) {
    const v = ((py / pixelRatio - geom.offsetY) / geom.renderedH) * mh - 0.5;
    if (v < -1 || v > mh) continue;
    const y0 = Math.floor(v);
    const fy = v - y0;
    const ya = Math.min(mh - 1, Math.max(0, y0));
    const yb = Math.min(mh - 1, Math.max(0, y0 + 1));
    for (let px = 0; px < w; px++) {
      const u = ((px / pixelRatio - geom.offsetX) / geom.renderedW) * mw - 0.5;
      if (u < -1 || u > mw) continue;
      const x0 = Math.floor(u);
      const fx = u - x0;
      const xa = Math.min(mw - 1, Math.max(0, x0));
      const xb = Math.min(mw - 1, Math.max(0, x0 + 1));
      const top = m[ya * mw + xa] * (1 - fx) + m[ya * mw + xb] * fx;
      const bottom = m[yb * mw + xa] * (1 - fx) + m[yb * mw + xb] * fx;
      const val = top * (1 - fy) + bottom * fy;
      // smoothstep 0.35 -> 0.65
      const t = Math.min(1, Math.max(0, (val - 0.35) / 0.3));
      const a = t * t * (3 - 2 * t);
      if (a <= 0) continue;
      const i = (py * w + px) * 4;
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = Math.round(a * 255);
    }
  }
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  tmp.getContext("2d")?.putImageData(out, 0, 0);
  ctx.drawImage(tmp, pane.x, pane.y, pane.w, pane.h);
}
