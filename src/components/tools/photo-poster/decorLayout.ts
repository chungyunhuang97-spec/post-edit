import type { CaptionMode, Dot, Tile, WordPos } from "./types";

let idCounter = 0;
function makeId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** A region of the caption zone (the whole poster when there is none),
 * in % of that zone. */
export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Width-to-height ratios small prints commonly come in. */
const TILE_ASPECTS = [1, 0.75, 1.33, 0.8, 1];

/** Lays `count` small photos out inside `region` as a loose staggered
 * grid -- jittered rather than random, so they read as deliberately placed
 * prints and never pile on top of each other. `zoneAspect` (zone
 * width / height) converts widths into the matching height in % so the
 * rows can be spaced correctly. Crops are drawn from `photoCount` source
 * photos in rotation, each from a different part of the picture. */
export function makeTiles(
  count: number,
  region: Region,
  zoneAspect: number,
  photoCount: number,
  aspects: number[] = TILE_ASPECTS,
): Tile[] {
  if (count <= 0) return [];
  const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cellW = (region.x1 - region.x0) / cols;
  const cellH = (region.y1 - region.y0) / rows;
  const tiles: Tile[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const aspect = aspects[i % aspects.length];
    // Fit inside the cell: limited by cell width, and by cell height
    // (converted to width via the aspect ratios).
    const maxWByHeight = ((cellH * 0.82) * aspect) / zoneAspect;
    const wPct = Math.min(cellW * 0.78, maxWByHeight);
    const hPct = (wPct / aspect) * zoneAspect;
    // Stagger odd columns downward and jitter slightly.
    const stagger = col % 2 === 1 ? cellH * 0.12 : 0;
    tiles.push({
      id: makeId("tile"),
      photo: (photoCount > 1 ? i % 2 : 0) as 0 | 1,
      u: rand(0.15, 0.85),
      v: rand(0.15, 0.85),
      s: rand(0.22, 0.5),
      xPct: region.x0 + col * cellW + rand(0, Math.max(0, cellW - wPct)),
      yPct: region.y0 + row * cellH + Math.min(stagger, Math.max(0, cellH - hPct)) + rand(0, Math.max(0, (cellH - hPct) * 0.5)),
      wPct,
      aspect,
    });
  }
  return tiles;
}

/** Scatters solid dots over `region`, cycling through `palette`. */
export function makeDots(count: number, region: Region, palette: string[]): Dot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: makeId("dot"),
    xPct: rand(region.x0, region.x1),
    yPct: rand(region.y0, region.y1),
    color: palette[i % palette.length],
  }));
}

/** Spreads `count` word anchors over `region` on a jittered grid so they
 * look scattered but never collide. */
export function makeWordPositions(count: number, region: Region): WordPos[] {
  if (count <= 0) return [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.2)));
  const rows = Math.ceil(count / cols);
  const cellW = (region.x1 - region.x0) / cols;
  const cellH = (region.y1 - region.y0) / rows;
  // Shuffle cell order so consecutive words aren't neighbours.
  const order = Array.from({ length: cols * rows }, (_, i) => i).sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => {
    const cell = order[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    return {
      xPct: region.x0 + (col + rand(0.25, 0.75)) * cellW,
      yPct: region.y0 + (row + rand(0.25, 0.75)) * cellH,
    };
  });
}

/** Where a tile's source crop sits in the photo, in the photo's natural
 * pixels. Independent of how the photo is laid out on the poster. */
export function tileSourceRect(tile: Tile, naturalW: number, naturalH: number) {
  const sw = Math.min(naturalW, tile.s * naturalW);
  const sh = Math.min(naturalH, sw / tile.aspect);
  const sw2 = sh * tile.aspect;
  const sx = Math.min(naturalW - sw2, Math.max(0, tile.u * naturalW - sw2 / 2));
  const sy = Math.min(naturalH - sh, Math.max(0, tile.v * naturalH - sh / 2));
  return { sx, sy, sw: sw2, sh };
}

/** The caption split into the short lines the `corner` mode stacks:
 * sentences / explicit line breaks, or the whole text when it has neither. */
export function cornerLines(caption: string): string[] {
  const parts = caption
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [caption.trim()].filter(Boolean);
}

export function captionWords(caption: string): string[] {
  return caption.trim().split(/\s+/).filter(Boolean);
}

/** Whether a caption mode draws its text in the free-position overlay
 * layer rather than inside the caption zone. */
export function usesOverlayText(mode: CaptionMode): boolean {
  return mode !== "flow";
}

/** Re-deals which source photo each tile shows after the number of
 * uploaded photos changes (and adds tiles if there are fewer tiles than
 * photos), so every photo the user has uploaded appears at least once. */
export function assignTilePhotos(tiles: Tile[], photoCount: number, zoneAspect: number, region: Region): Tile[] {
  if (tiles.length === 0) return tiles;
  const all = [...tiles];
  if (all.length < photoCount) all.push(...makeTiles(photoCount - all.length, region, zoneAspect, photoCount));
  return all.map((t, i) => ({ ...t, photo: (photoCount > 1 ? i % 2 : 0) as 0 | 1 }));
}
