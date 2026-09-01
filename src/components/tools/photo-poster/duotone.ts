function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Renders a two-color duotone version of `source` onto a new canvas: each
 * pixel's luminance selects a point between darkColor (shadows) and
 * lightColor (highlights), replacing the photo's own colors entirely -- a
 * classic risograph/poster duotone treatment. `maxDimension` caps the
 * working resolution (the live preview passes a small cap to stay snappy;
 * export passes a much larger one since quality matters more there than
 * speed). */
export function applyDuotone(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  darkColor: string,
  lightColor: string,
  maxDimension: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
  const w = Math.max(1, Math.round(naturalWidth * scale));
  const h = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0, w, h);

  const [dr, dg, db] = hexToRgb(darkColor);
  const [lr, lg, lb] = hexToRgb(lightColor);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    data[i] = dr + (lr - dr) * luminance;
    data[i + 1] = dg + (lg - dg) * luminance;
    data[i + 2] = db + (lb - db) * luminance;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
