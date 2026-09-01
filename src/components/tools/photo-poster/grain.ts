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

  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = w;
  noiseCanvas.height = h;
  const nctx = noiseCanvas.getContext("2d");
  if (!nctx) return;

  const imageData = nctx.createImageData(w, h);
  const data = imageData.data;
  const alpha = Math.round(Math.min(1, intensity) * 255 * 0.8);
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
  ctx.drawImage(noiseCanvas, 0, 0, w, h, 0, 0, width, height);
  ctx.restore();
}
