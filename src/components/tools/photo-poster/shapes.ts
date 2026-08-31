import type { ShapeId } from "./types";

type Point = [number, number];

/** Rescales an arbitrary point cloud to fit centered inside a
 * boxW x boxH box (with paddingPct on each side), preserving aspect
 * ratio. Used to turn parametric curves (heart, flower, blob, ...),
 * generated in whatever coordinate space is convenient for their math,
 * into the shared 0-100 percentage space every other shape uses. */
function normalizeToBox(pts: Point[], boxW: number, boxH: number, paddingPct = 4): Point[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = (paddingPct / 100) * boxW;
  const availW = boxW - pad * 2;
  const availH = boxH - pad * 2;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min(availW / spanX, availH / spanY);
  const renderedW = spanX * scale;
  const renderedH = spanY * scale;
  const offX = (boxW - renderedW) / 2;
  const offY = (boxH - renderedH) / 2;
  return pts.map(([x, y]) => [offX + (x - minX) * scale, offY + (y - minY) * scale]);
}

/** Classic parametric heart curve (Wolfram MathWorld), y flipped since
 * the formula's "up" is negative-y in our (SVG-style, y-down) space. */
function heartPoints(steps = 40): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x, -y]);
  }
  return normalizeToBox(pts, 100, 100, 3);
}

/** Lobed polar curve r = 1 + amplitude*cos(petals*theta) -- always
 * positive (amplitude < 1) so it stays a single simple closed loop, and
 * reads as a scalloped flower/daisy silhouette. */
function flowerPoints(steps = 60, petals = 6, amplitude = 0.35): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 1 + amplitude * Math.cos(petals * t);
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return normalizeToBox(pts, 100, 100, 4);
}

/** Two sine harmonics at fixed (non-random, so it's stable across
 * renders) phases -- an irregular organic "liquid blob" silhouette. */
function blobPoints(steps = 48): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 1 + 0.18 * Math.sin(3 * t) + 0.12 * Math.sin(5 * t + 1);
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return normalizeToBox(pts, 100, 100, 4);
}

/** 8-point alternating-radius star -- a 4-spike "sparkle/twinkle",
 * distinct from the 5-point `star` shape below. */
function sparklePoints(): Point[] {
  const innerR = 0.24;
  const pts: Point[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45 - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? 1 : innerR;
    pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return normalizeToBox(pts, 100, 100, 2);
}

/** Crescent moon: the outer arc of a big circle union'd with the inner
 * (concave) arc of a smaller, offset circle -- derived from actual
 * circle-circle intersection geometry (not eyeballed points) so the two
 * arcs meet cleanly with no self-intersection. */
function moonPoints(steps = 48): Point[] {
  const R1 = 1;
  const R2 = 0.82;
  const d = 0.46;
  const ix = (R1 * R1 - R2 * R2 + d * d) / (2 * d);
  const iy = Math.sqrt(Math.max(0, R1 * R1 - ix * ix));
  const a1 = Math.atan2(iy, ix); // intersection angle on circle 1
  const a2 = Math.atan2(iy, ix - d); // intersection angle on circle 2 (relative to its own center)

  const outerSteps = Math.round(steps * 0.6);
  const innerSteps = steps - outerSteps;
  const pts: Point[] = [];

  // Outer boundary: circle 1's arc that stays outside circle 2 (the long
  // way around, through pi).
  for (let i = 0; i <= outerSteps; i++) {
    const t = a1 + (i / outerSteps) * (2 * Math.PI - 2 * a1);
    pts.push([R1 * Math.cos(t), R1 * Math.sin(t)]);
  }
  // Inner (concave) boundary: circle 2's arc that lies inside circle 1,
  // swept back the other way to close the loop at the starting point.
  for (let i = 0; i <= innerSteps; i++) {
    const t = 2 * Math.PI - a2 - (i / innerSteps) * (2 * Math.PI - 2 * a2);
    pts.push([d + R2 * Math.cos(t), R2 * Math.sin(t)]);
  }
  return normalizeToBox(pts, 100, 100, 4);
}

/** Circular "animal head" silhouette with two bump features (ear angular
 * windows, measured in degrees with 0 = right, 90 = up) added to the
 * radius. A sharp linear falloff reads as pointed cat ears; a
 * sine-eased falloff plus a downward `droop` offset reads as floppy
 * hanging dog ears. Reuses the same bump-on-a-circle idea as
 * sparklePoints/moonPoints above rather than hand-eyeballed points. */
function animalHeadPoints(
  steps: number,
  earCenters: [number, number],
  earHalfWidthDeg: number,
  earHeight: number,
  rounded: boolean,
  droop = 0,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const deg = (i / steps) * 360;
    let bump = 0;
    let droopAmt = 0;
    for (const c of earCenters) {
      const d = Math.abs(((deg - c + 540) % 360) - 180);
      if (d < earHalfWidthDeg) {
        const p = 1 - d / earHalfWidthDeg;
        const b = rounded ? earHeight * Math.sin((p * Math.PI) / 2) : earHeight * p;
        if (b > bump) {
          bump = b;
          droopAmt = droop * Math.sin((p * Math.PI) / 2);
        }
      }
    }
    const r = 1 + bump;
    const t = (deg * Math.PI) / 180;
    pts.push([r * Math.cos(t), -r * Math.sin(t) + droopAmt]);
  }
  return normalizeToBox(pts, 100, 100, 4);
}

function catPoints(): Point[] {
  return animalHeadPoints(72, [58, 122], 17, 0.55, false);
}

function dogPoints(): Point[] {
  return animalHeadPoints(72, [22, 158], 24, 0.62, true, 0.5);
}

/** Percentage-space (0-100) polygon points for the shapes that are plain
 * polygons. square/rounded/circle are handled specially (rect/round-rect/
 * arc) since they aren't naturally a polygon. Single source of truth for
 * both the CSS clip-path used in the live preview and the canvas Path2D
 * used at export time, so the two can never visually drift apart. */
export const SHAPE_POLYGONS: Partial<Record<ShapeId, Point[]>> = {
  heart: heartPoints(),
  flower: flowerPoints(),
  blob: blobPoints(),
  sparkle: sparklePoints(),
  moon: moonPoints(),
  cat: catPoints(),
  dog: dogPoints(),
  lightning: [
    [65, 0],
    [25, 55],
    [45, 55],
    [35, 100],
    [75, 45],
    [55, 45],
  ],
  diamond: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
  triangle: [
    [50, 0],
    [100, 100],
    [0, 100],
  ],
  pentagon: [
    [50, 0],
    [100, 38],
    [82, 100],
    [18, 100],
    [0, 38],
  ],
  hexagon: [
    [25, 0],
    [75, 0],
    [100, 50],
    [75, 100],
    [25, 100],
    [0, 50],
  ],
  star: [
    [50, 0],
    [61, 35],
    [98, 35],
    [68, 57],
    [79, 91],
    [50, 70],
    [21, 91],
    [32, 57],
    [2, 35],
    [39, 35],
  ],
  cross: [
    [35, 0],
    [65, 0],
    [65, 35],
    [100, 35],
    [100, 65],
    [65, 65],
    [65, 100],
    [35, 100],
    [35, 65],
    [0, 65],
    [0, 35],
    [35, 35],
  ],
  parallelogram: [
    [20, 0],
    [100, 0],
    [80, 100],
    [0, 100],
  ],
};

const ROUNDED_RADIUS_PCT = 22;

export function clipPathFor(shapeId: ShapeId): string {
  switch (shapeId) {
    case "square":
      return "none";
    case "rounded":
      return `inset(0% round ${ROUNDED_RADIUS_PCT}%)`;
    case "circle":
      return "circle(50% at 50% 50%)";
    default: {
      const points = SHAPE_POLYGONS[shapeId];
      if (!points) return "none";
      return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
    }
  }
}

function roundedRectPath(path: Path2D, x: number, y: number, w: number, h: number, r: number) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.arcTo(x + w, y, x + w, y + r, r);
  path.lineTo(x + w, y + h - r);
  path.arcTo(x + w, y + h, x + w - r, y + h, r);
  path.lineTo(x + r, y + h);
  path.arcTo(x, y + h, x, y + h - r, r);
  path.lineTo(x, y + r);
  path.arcTo(x, y, x + r, y, r);
  path.closePath();
}

/** Builds the same shape as clipPathFor, as a Path2D positioned at
 * (x, y) with the given square size -- for canvas-based export. */
export function canvasShapePath(shapeId: ShapeId, x: number, y: number, size: number): Path2D {
  const path = new Path2D();
  if (shapeId === "square") {
    path.rect(x, y, size, size);
    return path;
  }
  if (shapeId === "rounded") {
    roundedRectPath(path, x, y, size, size, size * (ROUNDED_RADIUS_PCT / 100));
    return path;
  }
  if (shapeId === "circle") {
    path.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    return path;
  }
  const points = SHAPE_POLYGONS[shapeId] ?? [];
  points.forEach(([px, py], i) => {
    const ax = x + (px / 100) * size;
    const ay = y + (py / 100) * size;
    if (i === 0) path.moveTo(ax, ay);
    else path.lineTo(ax, ay);
  });
  path.closePath();
  return path;
}
