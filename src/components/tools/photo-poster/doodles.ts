import type { SubjectMask } from "./subjectSegmentation";
import type { Doodle, DoodleKind } from "./types";

/** Hand-drawn marker doodles, as SVG path data in a 0-100 box. Every shape
 * is generated from its own seed, so the live preview (an <svg>) and the
 * export (Path2D) draw the exact same wobbly lines. */
export const DOODLE_KINDS: DoodleKind[] = [
  "star",
  "note",
  "heart",
  "sparkle",
  "loop",
  "arrow",
  "flower",
  "lightning",
  "smile",
  "cloud",
  "sun",
  "cross",
  "wave",
  "crown",
];

/** Stroke width in the 0-100 box. */
export const DOODLE_STROKE = 4.6;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = [number, number];

function poly(points: P[]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

export function doodlePath(kind: DoodleKind, seed: number): string {
  const r = rng(seed);
  const j = (amt: number) => (r() - 0.5) * 2 * amt;
  const parts: string[] = [];

  if (kind === "star") {
    // A scribbled starburst: traced twice, plus a few chords through the middle.
    const spikes = 7 + Math.floor(r() * 3);
    for (let pass = 0; pass < 2; pass++) {
      const pts: P[] = [];
      for (let i = 0; i <= spikes * 2 + 1; i++) {
        const ang = (i * Math.PI) / spikes + pass * 0.12 + j(0.08);
        const rad = (i % 2 ? 14 + r() * 8 : 40 + r() * 8) + j(2);
        pts.push([50 + Math.cos(ang) * rad, 50 + Math.sin(ang) * rad]);
      }
      parts.push(poly(pts));
    }
    for (let k = 0; k < 3; k++) {
      const ang = r() * Math.PI;
      parts.push(poly([[50 - Math.cos(ang) * 36 + j(3), 50 - Math.sin(ang) * 36 + j(3)], [50 + Math.cos(ang) * 36 + j(3), 50 + Math.sin(ang) * 36 + j(3)]]));
    }
  } else if (kind === "note") {
    const x = 52 + j(4);
    parts.push(poly([[x, 10 + j(2)], [x + j(2), 40], [x + j(2), 74 + j(2)]]));
    parts.push(`M${x.toFixed(1)} 10 Q${(x + 26).toFixed(1)} 20 ${(x + 18).toFixed(1)} 46`);
    for (let pass = 0; pass < 3; pass++) {
      const pts: P[] = [];
      for (let t = 0; t <= 14; t++) {
        const a = (t / 12) * Math.PI * 2 + pass * 0.7;
        pts.push([x - 14 + Math.cos(a) * (13 + j(1.5)), 76 + Math.sin(a) * (9 + j(1.5)) - pass * 0.5]);
      }
      parts.push(poly(pts));
    }
  } else if (kind === "heart") {
    for (let pass = 0; pass < 2; pass++) {
      const pts: P[] = [];
      for (let t = 0; t <= 30; t++) {
        const a = (t / 28) * Math.PI * 2 + pass * 0.15;
        const hx = 16 * Math.sin(a) ** 3;
        const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        pts.push([50 + hx * 2.7 + j(1.6), 46 + hy * 2.7 + j(1.6)]);
      }
      parts.push(poly(pts));
    }
  } else if (kind === "sparkle") {
    for (let pass = 0; pass < 2; pass++) {
      const o = pass * 2.5;
      parts.push(
        `M${(50 + j(2)).toFixed(1)} ${(8 + o).toFixed(1)} Q${(54 + j(2)).toFixed(1)} 46 ${(92 - o).toFixed(1)} ${(50 + j(2)).toFixed(1)} Q54 54 ${(50 + j(2)).toFixed(1)} ${(92 - o).toFixed(1)} Q46 54 ${(8 + o).toFixed(1)} ${(50 + j(2)).toFixed(1)} Q46 46 ${(50 + j(2)).toFixed(1)} ${(8 + o).toFixed(1)}`,
      );
    }
  } else if (kind === "loop") {
    const pts: P[] = [];
    const turns = 2.4 + r() * 0.8;
    const steps = 46;
    for (let t = 0; t <= steps; t++) {
      const f = t / steps;
      const a = f * turns * Math.PI * 2;
      const rad = 4 + f * 42 + j(1.5);
      pts.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad]);
    }
    parts.push(poly(pts));
  } else if (kind === "flower") {
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2 + j(0.1);
      const pts: P[] = [];
      for (let t = 0; t <= 14; t++) {
        const a = (t / 12) * Math.PI * 2;
        const ex = Math.cos(a) * (15 + j(1.2));
        const ey = Math.sin(a) * (10 + j(1.2));
        const cx = Math.cos(ang) * 26;
        const cy = Math.sin(ang) * 26;
        pts.push([50 + cx + ex * Math.cos(ang) - ey * Math.sin(ang), 50 + cy + ex * Math.sin(ang) + ey * Math.cos(ang)]);
      }
      parts.push(poly(pts));
    }
    const c: P[] = [];
    for (let t = 0; t <= 12; t++) c.push([50 + Math.cos((t / 10) * Math.PI * 2) * (8 + j(1)), 50 + Math.sin((t / 10) * Math.PI * 2) * (8 + j(1))]);
    parts.push(poly(c));
  } else if (kind === "lightning") {
    for (let pass = 0; pass < 2; pass++) {
      const o = pass * 2.2;
      parts.push(poly([[58 + j(2), 6 + o], [28 + j(2), 54 + j(2)], [50 + j(2), 52 + j(2)], [38 + j(2), 94 - o], [76 + j(2), 38 + j(2)], [54 + j(2), 40 + j(2)], [58 + j(2), 6 + o]]));
    }
  } else if (kind === "smile") {
    for (let pass = 0; pass < 2; pass++) {
      const pts: P[] = [];
      for (let t = 0; t <= 36; t++) {
        const a = (t / 34) * Math.PI * 2 + pass * 0.3;
        pts.push([50 + Math.cos(a) * (40 + j(1.6)), 50 + Math.sin(a) * (40 + j(1.6))]);
      }
      parts.push(poly(pts));
    }
    parts.push(poly([[36 + j(1), 38], [36 + j(1), 50 + j(1)]]));
    parts.push(poly([[64 + j(1), 38], [64 + j(1), 50 + j(1)]]));
    parts.push(`M30 62 Q50 ${(82 + j(3)).toFixed(1)} 70 62`);
  } else if (kind === "cloud") {
    for (let pass = 0; pass < 2; pass++) {
      const o = pass * 2;
      parts.push(
        `M${24 + o} 72 Q8 72 12 56 Q14 42 30 44 Q34 24 52 26 Q70 24 74 44 Q92 44 90 60 Q90 72 76 72 Z`.replace(/\d+(\.\d+)?/g, (m) => (Math.abs(parseFloat(m)) > 3 ? (parseFloat(m) + j(1.4)).toFixed(1) : m)),
      );
    }
  } else if (kind === "sun") {
    const c: P[] = [];
    for (let t = 0; t <= 20; t++) c.push([50 + Math.cos((t / 18) * Math.PI * 2) * (17 + j(1.2)), 50 + Math.sin((t / 18) * Math.PI * 2) * (17 + j(1.2))]);
    parts.push(poly(c));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + j(0.12);
      const r0 = 28 + j(2);
      const r1 = 44 + j(4);
      parts.push(poly([[50 + Math.cos(a) * r0, 50 + Math.sin(a) * r0], [50 + Math.cos(a) * r1, 50 + Math.sin(a) * r1]]));
    }
  } else if (kind === "cross") {
    for (let pass = 0; pass < 2; pass++) {
      parts.push(poly([[16 + j(3), 16 + j(3)], [84 + j(3), 84 + j(3)]]));
      parts.push(poly([[84 + j(3), 16 + j(3)], [16 + j(3), 84 + j(3)]]));
    }
  } else if (kind === "wave") {
    for (let pass = 0; pass < 2; pass++) {
      const pts: P[] = [];
      for (let t = 0; t <= 30; t++) {
        const f = t / 30;
        pts.push([8 + f * 84, 50 + Math.sin(f * Math.PI * 6 + pass * 0.4) * (14 + j(1.5)) + pass * 4]);
      }
      parts.push(poly(pts));
    }
  } else if (kind === "crown") {
    for (let pass = 0; pass < 2; pass++) {
      const o = pass * 2;
      parts.push(poly([[10 + j(2), 78 - o], [10 + j(2), 34 + j(2)], [30 + j(2), 56 + j(2)], [50 + j(2), 22 + o], [70 + j(2), 56 + j(2)], [90 + j(2), 34 + j(2)], [90 + j(2), 78 - o], [10, 78 - o]]));
    }
  } else {
    // arrow
    parts.push(`M${(10 + j(3)).toFixed(1)} ${(78 + j(3)).toFixed(1)} Q${(38 + j(6)).toFixed(1)} ${(8 + j(6)).toFixed(1)} ${(86 + j(3)).toFixed(1)} ${(28 + j(3)).toFixed(1)}`);
    parts.push(poly([[68 + j(2), 12 + j(2)], [87, 28], [66 + j(2), 42 + j(2)]]));
  }
  return parts.join(" ");
}

let doodleCounter = 0;

/** The upper/side arc doodles hug around a subject (the lower arc is
 * skipped: that is where the subject meets the bottom of the frame). */
const RING_START = (130 * Math.PI) / 180;
const RING_SPAN = (280 * Math.PI) / 180;

/** Makes `count` doodles, every one a different kind (so never more than
 * DOODLE_KINDS.length). Kinds already in `keep` are avoided first. With
 * `ring`, each also gets an angle around the subject (see ringTopLeft);
 * `region` (% of the anchor zone) is the fallback scatter when there is
 * no subject to follow. */
export function makeDoodles(
  count: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  sizePctOfZoneW: number,
  zoneAspect: number,
  opts: { ring?: boolean; keep?: DoodleKind[] } = {},
): Doodle[] {
  const n = Math.min(count, DOODLE_KINDS.length);
  if (n <= 0) return [];
  const taken = new Set(opts.keep ?? []);
  const fresh = DOODLE_KINDS.filter((k) => !taken.has(k)).sort(() => Math.random() - 0.5);
  const used = DOODLE_KINDS.filter((k) => taken.has(k)).sort(() => Math.random() - 0.5);
  const kinds = [...fresh, ...used].slice(0, n);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.2)));
  const rows = Math.ceil(n / cols);
  const cellW = (region.x1 - region.x0) / cols;
  const cellH = (region.y1 - region.y0) / rows;
  const order = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
  const hPct = sizePctOfZoneW * zoneAspect;
  const phase = Math.random() * 0.4;
  return kinds.map((kind, i) => {
    const cell = order[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    return {
      id: `doodle-${Date.now().toString(36)}-${doodleCounter++}`,
      kind,
      seed: Math.floor(Math.random() * 1e9),
      xPct: region.x0 + col * cellW + Math.random() * Math.max(0, cellW - sizePctOfZoneW),
      yPct: region.y0 + row * cellH + Math.random() * Math.max(0, cellH - hPct),
      rot: (Math.random() - 0.5) * 50,
      ring: opts.ring ? RING_START + ((i + phase) / n) * RING_SPAN : undefined,
    };
  });
}

/** Gives every doodle an angle around the subject (or takes it away). */
export function setRings(doodles: Doodle[], on: boolean): Doodle[] {
  const phase = Math.random() * 0.4;
  return doodles.map((d, i) => ({ ...d, ring: on ? RING_START + ((i + phase) / doodles.length) * RING_SPAN : undefined }));
}

// --- Following the subject's outline -----------------------------------

interface Envelope {
  /** Outer edge of the subject per angle, in mask pixels. */
  pts: { x: number; y: number }[];
}

const ENVELOPE_STEPS = 96;
const envelopeCache = new WeakMap<SubjectMask, Envelope | null>();

/** The subject's outer edge as seen from its centre, sampled at evenly
 * spaced angles (so concave bits like the gap between legs are bridged,
 * which is what a marker line drawn around a person does too). */
function subjectEnvelope(mask: SubjectMask): Envelope | null {
  if (envelopeCache.has(mask)) return envelopeCache.get(mask) ?? null;
  const { data, width: w, height: h } = mask;
  // Keep only the biggest connected blob of subject, so stray bits of
  // detection noise don't drag the outline away.
  const label = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (data[i] <= 0.5 || label[i]) continue;
    next++;
    let size = 0;
    stack.push(i);
    label[i] = next;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const cx0 = c % w;
      const cy0 = (c - cx0) / w;
      if (cx0 > 0 && data[c - 1] > 0.5 && !label[c - 1]) {
        label[c - 1] = next;
        stack.push(c - 1);
      }
      if (cx0 < w - 1 && data[c + 1] > 0.5 && !label[c + 1]) {
        label[c + 1] = next;
        stack.push(c + 1);
      }
      if (cy0 > 0 && data[c - w] > 0.5 && !label[c - w]) {
        label[c - w] = next;
        stack.push(c - w);
      }
      if (cy0 < h - 1 && data[c + w] > 0.5 && !label[c + w]) {
        label[c + w] = next;
        stack.push(c + w);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] === best) {
        sx += x;
        sy += y;
      }
    }
  }
  const n = bestSize;
  let env: Envelope | null = null;
  if (best && n > w * h * 0.01) {
    const cx = sx / n;
    const cy = sy / n;
    const maxR = Math.hypot(w, h);
    const radii: number[] = [];
    for (let k = 0; k < ENVELOPE_STEPS; k++) {
      const a = (k / ENVELOPE_STEPS) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let found = 0;
      for (let r = maxR; r > 0; r -= 0.5) {
        const x = Math.round(cx + dx * r);
        const y = Math.round(cy + dy * r);
        if (x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === best) {
          found = r;
          break;
        }
      }
      radii.push(found);
    }
    // Smooth around the ring (twice) so the line reads as one calm loop.
    const smooth = (src: number[]) =>
      src.map((_, i) => {
        let t = 0;
        for (let d = -4; d <= 4; d++) t += src[(i + d + ENVELOPE_STEPS) % ENVELOPE_STEPS];
        return t / 9;
      });
    const sm = smooth(smooth(radii));
    env = {
      pts: sm.map((r, k) => {
        const a = (k / ENVELOPE_STEPS) * Math.PI * 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      }),
    };
  }
  envelopeCache.set(mask, env);
  return env;
}

interface Place {
  /** Pane rect and the photo's cover placement inside it, in poster px. */
  pane: { x: number; y: number; w: number; h: number };
  geom: { offsetX: number; offsetY: number; renderedW: number; renderedH: number };
}

function toPoster(mask: SubjectMask, place: Place, x: number, y: number) {
  return {
    x: place.pane.x + place.geom.offsetX + (x / mask.width) * place.geom.renderedW,
    y: place.pane.y + place.geom.offsetY + (y / mask.height) * place.geom.renderedH,
  };
}

/** Top-left (poster px) of a doodle sitting just outside the subject at
 * `angle` (radians, clockwise from the right), or null with no subject. */
export function ringTopLeft(
  mask: SubjectMask | null,
  place: Place,
  angle: number,
  sizePx: number,
  bounds: { x: number; y: number; w: number; h: number },
): { x: number; y: number } | null {
  if (!mask || !place.geom.renderedW) return null;
  const env = subjectEnvelope(mask);
  if (!env) return null;
  const f = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  const idx = f * ENVELOPE_STEPS;
  const i0 = Math.floor(idx) % ENVELOPE_STEPS;
  const i1 = (i0 + 1) % ENVELOPE_STEPS;
  const t = idx - Math.floor(idx);
  const ex = env.pts[i0].x * (1 - t) + env.pts[i1].x * t;
  const ey = env.pts[i0].y * (1 - t) + env.pts[i1].y * t;
  const edge = toPoster(mask, place, ex, ey);
  const dx = Math.cos(angle) * (place.geom.renderedW / mask.width);
  const dy = Math.sin(angle) * (place.geom.renderedH / mask.height);
  const len = Math.hypot(dx, dy) || 1;
  const reach = sizePx * 0.42;
  const cx = edge.x + (dx / len) * reach;
  const cy = edge.y + (dy / len) * reach;
  return {
    x: Math.min(bounds.x + bounds.w - sizePx, Math.max(bounds.x, cx - sizePx / 2)),
    y: Math.min(bounds.y + bounds.h - sizePx, Math.max(bounds.y, cy - sizePx / 2)),
  };
}

/** A hand-drawn marker line traced twice around the subject. */
export function drawSubjectOutline(
  ctx: CanvasRenderingContext2D,
  mask: SubjectMask,
  color: string,
  lineWidth: number,
  place: Place,
  seed = 7,
): void {
  const env = subjectEnvelope(mask);
  if (!env || !place.geom.renderedW) return;
  const r = rng(seed);
  const margin = Math.min(place.pane.w, place.pane.h) * 0.014;
  ctx.save();
  ctx.beginPath();
  ctx.rect(place.pane.x, place.pane.y, place.pane.w, place.pane.h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const poster = env.pts.map((p) => toPoster(mask, place, p.x, p.y));
  const cx = poster.reduce((a, p) => a + p.x, 0) / poster.length;
  const cy = poster.reduce((a, p) => a + p.y, 0) / poster.length;
  for (let pass = 0; pass < 2; pass++) {
    const start = Math.floor(r() * ENVELOPE_STEPS);
    const len = ENVELOPE_STEPS + 6 + pass * 4;
    const out = margin * (1.1 + pass * 0.9);
    ctx.beginPath();
    for (let k = 0; k <= len; k++) {
      const p = poster[(start + k) % ENVELOPE_STEPS];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const l = Math.hypot(dx, dy) || 1;
      const wob = (r() - 0.5) * margin * 1.1;
      const x = p.x + (dx / l) * (out + wob);
      const y = p.y + (dy / l) * (out + wob);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
