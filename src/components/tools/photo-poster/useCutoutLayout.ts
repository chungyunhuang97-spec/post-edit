import type { CaptionToken, Cutout } from "./types";

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return `cutout-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function wordCountOf(caption: string): number {
  return caption.trim().split(/\s+/).filter(Boolean).length;
}

function randomCutout(wordCount: number): Cutout {
  return {
    id: makeId(),
    xPct: 10 + Math.random() * 70,
    yPct: 10 + Math.random() * 70,
    wordIndex: wordCount > 0 ? Math.floor(Math.random() * wordCount) : 0,
    color: null,
  };
}

/** Sets a specific cutout's color override (null reverts it to inheriting
 * the global top-background color). Leaves position/wordIndex untouched. */
export function setCutoutColor(cutouts: Cutout[], id: string, color: string | null): Cutout[] {
  return cutouts.map((c) => (c.id === id ? { ...c, color } : c));
}

/** Clears every cutout's color override back to "inherit". */
export function resetCutoutColors(cutouts: Cutout[]): Cutout[] {
  return cutouts.map((c) => (c.color === null ? c : { ...c, color: null }));
}

/** Keeps existing cutouts (and their positions/word placement) when only
 * growing/shrinking the count, so nudging the "count" slider doesn't
 * reshuffle everything. */
export function resizeCutouts(current: Cutout[], count: number, wordCount: number): Cutout[] {
  if (count === current.length) return current;
  if (count < current.length) return current.slice(0, count);
  const next = [...current];
  while (next.length < count) {
    next.push(randomCutout(wordCount));
  }
  return next;
}

/** Re-rolls both the photo position *and* the caption word placement for
 * every cutout -- this is the single "randomize" action, since the user
 * types their own caption and just wants the cutouts scattered randomly
 * through it (rather than the tool evenly spacing them out). Any custom
 * colors in `previous` are preserved by index, since "randomize" is about
 * shuffling placement, not undoing color choices the user made. */
export function randomizeCutouts(count: number, wordCount: number, previous: Cutout[] = []): Cutout[] {
  return Array.from({ length: count }, (_, i) => ({
    ...randomCutout(wordCount),
    color: previous[i]?.color ?? null,
  }));
}

export function clampPct(value: number, maxSizePct: number): number {
  return Math.min(Math.max(value, 0), Math.max(0, 100 - maxSizePct));
}

/** Flows `cutouts` into `caption`'s word stream, each inserted right after
 * the word at its (clamped) wordIndex -- so "Warm (img) lanterns glow
 * like (img) ..." reads the same way the reference tool does. Multiple
 * cutouts can land after the same word (their random wordIndex collided,
 * or the caption got shorter since they were placed); they're then
 * inserted in cutout-array order. */
export function buildCaptionTokens(caption: string, cutouts: Cutout[]): CaptionToken[] {
  const words = caption.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return cutouts.map((c) => ({ kind: "cutout", cutoutId: c.id }));
  }
  if (cutouts.length === 0) {
    return words.map((text) => ({ kind: "word", text }));
  }

  const byIndex = new Map<number, string[]>();
  cutouts.forEach((c) => {
    const index = Math.min(words.length - 1, Math.max(0, c.wordIndex));
    const bucket = byIndex.get(index) ?? [];
    bucket.push(c.id);
    byIndex.set(index, bucket);
  });

  const tokens: CaptionToken[] = [];
  words.forEach((word, i) => {
    tokens.push({ kind: "word", text: word });
    byIndex.get(i)?.forEach((id) => tokens.push({ kind: "cutout", cutoutId: id }));
  });
  return tokens;
}
