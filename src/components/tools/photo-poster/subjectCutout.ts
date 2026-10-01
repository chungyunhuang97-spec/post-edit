import type { SubjectMask } from "./subjectSegmentation";

export interface SubjectCutout {
  /** The cut-out subject with a white sticker border all round. */
  canvas: HTMLCanvasElement;
  /** width / height of `canvas`. */
  aspect: number;
}

/** Alpha mask (white where the subject is) for the (u0..u1, v0..v1) window
 * of `mask`, rendered at w x h. Each pixel samples the 0/1 mask bilinearly
 * and thresholds it softly, which turns the model's low-resolution mask
 * into a smooth outline instead of a blocky one. */
function maskAlphaCanvas(
  mask: SubjectMask,
  win: { u0: number; v0: number; u1: number; v1: number },
  w: number,
  h: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(w, h);
  const { data: m, width: mw, height: mh } = mask;
  for (let py = 0; py < h; py++) {
    const v = (win.v0 + ((py + 0.5) / h) * (win.v1 - win.v0)) * mh - 0.5;
    const y0 = Math.floor(v);
    const fy = v - y0;
    const ya = Math.min(mh - 1, Math.max(0, y0));
    const yb = Math.min(mh - 1, Math.max(0, y0 + 1));
    for (let px = 0; px < w; px++) {
      const u = (win.u0 + ((px + 0.5) / w) * (win.u1 - win.u0)) * mw - 0.5;
      const x0 = Math.floor(u);
      const fx = u - x0;
      const xa = Math.min(mw - 1, Math.max(0, x0));
      const xb = Math.min(mw - 1, Math.max(0, x0 + 1));
      const top = m[ya * mw + xa] * (1 - fx) + m[ya * mw + xb] * fx;
      const bottom = m[yb * mw + xa] * (1 - fx) + m[yb * mw + xb] * fx;
      const val = top * (1 - fy) + bottom * fy;
      const t = Math.min(1, Math.max(0, (val - 0.35) / 0.3));
      const a = t * t * (3 - 2 * t);
      const i = (py * w + px) * 4;
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

const cache = new WeakMap<SubjectMask, WeakMap<object, SubjectCutout | null>>();

/** Cuts the detected subject out of the photo and gives it a thick white
 * border, like a die-cut sticker. The border also hides how rough the
 * model's outline is. Returns null when the mask found nothing. Cached per
 * (mask, source), so the preview re-rendering costs nothing. */
export function buildSubjectCutout(
  source: HTMLImageElement,
  mask: SubjectMask,
  maxSide = 720,
): SubjectCutout | null {
  let perSource = cache.get(mask);
  if (!perSource) {
    perSource = new WeakMap();
    cache.set(mask, perSource);
  }
  if (perSource.has(source)) return perSource.get(source) ?? null;

  const { data, width: mw, height: mh } = mask;
  let minX = mw;
  let minY = mh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (data[y * mw + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    perSource.set(source, null);
    return null;
  }

  const win = { u0: minX / mw, v0: minY / mh, u1: (maxX + 1) / mw, v1: (maxY + 1) / mh };
  const natW = source.naturalWidth;
  const natH = source.naturalHeight;
  const sw = (win.u1 - win.u0) * natW;
  const sh = (win.v1 - win.v0) * natH;
  const scale = maxSide / Math.max(sw, sh);
  const ow = Math.max(8, Math.round(sw * scale));
  const oh = Math.max(8, Math.round(sh * scale));
  const border = Math.round(Math.max(ow, oh) * 0.04);

  // The subject's own pixels, cut out by the smoothed mask.
  const subject = document.createElement("canvas");
  subject.width = ow;
  subject.height = oh;
  const sctx = subject.getContext("2d")!;
  sctx.drawImage(source, win.u0 * natW, win.v0 * natH, sw, sh, 0, 0, ow, oh);
  const alpha = maskAlphaCanvas(mask, win, ow, oh);
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(alpha, 0, 0);

  // The same shape in solid white, stamped around in a ring to fatten it
  // into the sticker border.
  const out = document.createElement("canvas");
  out.width = ow + border * 2;
  out.height = oh + border * 2;
  const octx = out.getContext("2d")!;
  const steps = 28;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    octx.drawImage(alpha, border + Math.cos(a) * border, border + Math.sin(a) * border);
  }
  octx.drawImage(alpha, border, border);
  octx.drawImage(subject, border, border);

  const result = { canvas: out, aspect: out.width / out.height };
  perSource.set(source, result);
  return result;
}
