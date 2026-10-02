/** Small colour helpers: hex <-> HSV/HSL, contrast, and a contrast-aware
 * palette generator. All hex values are "#rrggbb". */

export function normalizeHex(input: string): string | null {
  let h = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** h 0-360, s/v 0-1. */
export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function luminance(hex: string): number {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio, 1-21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `n` lively colours that all stand out against `bg`: hues spread evenly
 * from a random start (so every call is a new suggestion), then each one's
 * brightness is pushed away from the background until the contrast is
 * readable. */
export function recommendContrastColors(bg: string, n: number): string[] {
  const bgLight = luminance(bg) > 0.4;
  const start = Math.random() * 360;
  const out: string[] = [];
  const order = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let k = 0; k < n; k++) {
    const hue = (start + (order[k] / Math.max(1, n)) * 360 + Math.random() * 18) % 360;
    const sat = 0.62 + Math.random() * 0.3;
    let val = bgLight ? 0.62 + Math.random() * 0.2 : 0.85 + Math.random() * 0.15;
    let color = hsvToHex(hue, sat, val);
    for (let i = 0; i < 14 && contrastRatio(color, bg) < 3; i++) {
      val = bgLight ? Math.max(0.2, val - 0.05) : Math.min(1, val + 0.04);
      color = hsvToHex(hue, bgLight ? sat : Math.max(0.35, sat - 0.04), val);
    }
    out.push(color);
  }
  return out;
}
