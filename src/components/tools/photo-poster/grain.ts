/** Renders a random per-pixel monochrome noise layer onto an offscreen
 * canvas, then composites it onto `ctx` with "overlay" blend mode -- overlay
 * (rather than a flat alpha wash) lets the grain darken shadows and lighten
 * highlights instead of just muddying every pixel toward gray, which is
 * what a real film-grain layer looks like sitting on top of a print.
 * `intensity` is 0-1; putImageData can't respect globalCompositeOperation,
 * hence the intermediate canvas + drawImage step. */
export function drawFilmGrain(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number): void {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (intensity <= 0 || w <= 0 || h <= 0) return;

  // Noise is generated at 2x the destination resolution, then drawImage
  // downsamples it back down with bilinear filtering -- averaging each 2x2
  // block into one destination pixel softens the per-pixel random extremes
  // into a fine photographic grain instead of hard, chunky single-pixel
  // static (which read as "too big" at any perceptible intensity).
  const superSample = 2;
  const nw = w * superSample;
  const nh = h * superSample;
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = nw;
  noiseCanvas.height = nh;
  const nctx = noiseCanvas.getContext("2d");
  if (!nctx) return;

  const imageData = nctx.createImageData(nw, nh);
  const data = imageData.data;
  const alpha = Math.round(Math.min(1, intensity) * 255 * 0.5);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = alpha;
  }
  nctx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(noiseCanvas, 0, 0, nw, nh, 0, 0, width, height);
  ctx.restore();
}
