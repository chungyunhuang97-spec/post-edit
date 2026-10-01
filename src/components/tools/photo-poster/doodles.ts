import type { Doodle, DoodleKind } from "./types";

/** Hand-drawn marker doodles, as SVG path data in a 0-100 box. Every shape
 * is generated from its own seed, so the live preview (an <svg>) and the
 * export (Path2D) draw the exact same wobbly lines. */
export const DOODLE_KINDS: DoodleKind[] = ["star", "note", "heart", "sparkle", "loop", "arrow"];

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
  } else {
    // arrow
    parts.push(`M${(10 + j(3)).toFixed(1)} ${(78 + j(3)).toFixed(1)} Q${(38 + j(6)).toFixed(1)} ${(8 + j(6)).toFixed(1)} ${(86 + j(3)).toFixed(1)} ${(28 + j(3)).toFixed(1)}`);
    parts.push(poly([[68 + j(2), 12 + j(2)], [87, 28], [66 + j(2), 42 + j(2)]]));
  }
  return parts.join(" ");
}

let doodleCounter = 0;

/** Scatters `count` doodles over `region` (% of the anchor zone), cycling
 * through the kinds in a random order so neighbours differ. */
export function makeDoodles(
  count: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  sizePctOfZoneW: number,
  zoneAspect: number,
): Doodle[] {
  if (count <= 0) return [];
  const kinds = [...DOODLE_KINDS].sort(() => Math.random() - 0.5);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.2)));
  const rows = Math.ceil(count / cols);
  const cellW = (region.x1 - region.x0) / cols;
  const cellH = (region.y1 - region.y0) / rows;
  const order = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
  // Doodles are square: their height in zone-% follows the zone's shape.
  const hPct = sizePctOfZoneW * zoneAspect;
  return Array.from({ length: count }, (_, i) => {
    const cell = order[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    return {
      id: `doodle-${Date.now().toString(36)}-${doodleCounter++}`,
      kind: kinds[i % kinds.length],
      seed: Math.floor(Math.random() * 1e9),
      xPct: region.x0 + col * cellW + Math.random() * Math.max(0, cellW - sizePctOfZoneW),
      yPct: region.y0 + row * cellH + Math.random() * Math.max(0, cellH - hPct),
      rot: (Math.random() - 0.5) * 50,
    };
  });
}
