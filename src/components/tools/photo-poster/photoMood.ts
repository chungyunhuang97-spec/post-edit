export type PhotoMood = "bright-warm" | "bright-cool" | "dark" | "vibrant" | "neutral";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for mood analysis"));
    img.src = src;
  });
}

/** Client-side "mood" read of a photo -- no server call or API key, just a
 * downscaled canvas sample averaged into brightness/warmth/saturation to
 * steer which word bank a caption suggestion draws from. This is a cheap
 * pixel-stats heuristic, not real image understanding: it can't tell what's
 * *in* the photo, only its overall tone (dark vs. bright, warm vs. cool,
 * colorful vs. muted). */
export async function analyzePhotoMood(imageUrl: string): Promise<PhotoMood> {
  try {
    const img = await loadImage(imageUrl);
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "neutral";
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let r = 0;
    let g = 0;
    let b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r /= pixelCount;
    g /= pixelCount;
    b /= pixelCount;

    const brightness = (r + g + b) / 3; // 0-255
    const warmth = r - b; // positive = warm (red/orange-leaning), negative = cool (blue-leaning)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max; // 0-1

    if (brightness < 85) return "dark";
    if (saturation > 0.35) return "vibrant";
    if (warmth > 15) return "bright-warm";
    if (warmth < -15) return "bright-cool";
    return "neutral";
  } catch {
    return "neutral";
  }
}
