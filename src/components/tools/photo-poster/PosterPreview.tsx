"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import { applyDuotone } from "./duotone";
import { drawFilmGrain } from "./grain";
import { drawSubjectHalftone } from "./subjectHalftone";
import type { SubjectMask } from "./subjectSegmentation";
import { captionWords, cornerLines, tileSourceRect } from "./decorLayout";
import { drawSilhouette } from "./silhouette";
import type {
  BracketOption,
  CollageLayoutId,
  Cutout,
  DecorState,
  Dot,
  FontOption,
  PosterLayoutId,
  ShapeOption,
  StickerStyleId,
  Tile,
  WordPos,
} from "./types";
import { drawHalftoneTile, locateInPane, stickerSourceRect, type CropGeom } from "./stickerCrop";
import { buildCaptionTokens, clampPct } from "./useCutoutLayout";

const DUOTONE_PREVIEW_MAX_DIMENSION = 900;
interface CoverGeometry {
  boxW: number;
  boxH: number;
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Replicates `background-size: cover` math by hand so the same numbers
 * can be reused to crop a small inline thumbnail out of the exact same
 * image, at the exact same scale. Unlike plain CSS `background-position:
 * center`, pan.x/pan.y (0-1, default 0.5) let the *centered* position be
 * shifted anywhere within the "slack" the cover-crop leaves on each axis --
 * 0 = left/top-aligned, 1 = right/bottom-aligned. zoom (>=1, default 1)
 * scales the image up beyond the minimum cover-fit size, creating more
 * slack to pan within for a tighter crop. */
function computeCoverGeometry(
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number,
  pan: { x: number; y: number },
  zoom: number,
): CoverGeometry {
  if (!boxW || !boxH || !naturalW || !naturalH) {
    return { boxW, boxH, renderedW: boxW, renderedH: boxH, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.max(boxW / naturalW, boxH / naturalH) * zoom;
  const renderedW = naturalW * scale;
  const renderedH = naturalH * scale;
  return {
    boxW,
    boxH,
    renderedW,
    renderedH,
    offsetX: -(renderedW - boxW) * pan.x,
    offsetY: -(renderedH - boxH) * pan.y,
  };
}

/** Tracks a photo's natural (unscaled) pixel dimensions -- shared by both
 * the primary and the collage-mode second photo, so cover-fit geometry can
 * be computed for either. */
function useNaturalSize(imageUrl: string | null): { w: number; h: number } {
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);
  return natural;
}

/** Recolors a photo into a two-tone dark/light duotone (see duotone.ts)
 * whenever `enabled`, returning the resulting blob URL -- shared by both
 * the primary and the collage-mode second photo. Runs at a capped working
 * resolution since the live preview never needs full photo resolution. */
function useDuotoneUrl(
  imageUrl: string | null,
  natural: { w: number; h: number },
  enabled: boolean,
  darkColor: string,
  lightColor: string,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    // No explicit "reset to null" here when disabled -- callers already
    // ignore this url whenever `enabled` is false, so a stale (and by then
    // already-revoked, via this same effect's own cleanup on the *previous*
    // run) URL sitting unused in state is harmless, and re-enabling later
    // just overwrites it with a fresh one.
    if (!enabled || !imageUrl || !natural.w || !natural.h) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = applyDuotone(img, natural.w, natural.h, darkColor, lightColor, DUOTONE_PREVIEW_MAX_DIMENSION);
      canvas.toBlob((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, imageUrl, natural.w, natural.h, darkColor, lightColor]);
  return url;
}

export interface PosterPreviewProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  imageUrl: string | null;
  uploadError: string | null;
  /** Second photo + its own upload error, only rendered once
   * collageLayoutId is a "duo-*" arrangement. */
  imageUrl2: string | null;
  uploadError2: string | null;
  collageLayoutId: CollageLayoutId;
  onRequestUpload2: () => void;
  onFilesDropped2: (files: FileList) => void;
  /** Whether the caption renders at all -- false means photo(s) fill the
   * entire canvas with no text zone, rather than an empty/collapsed one. */
  captionEnabled: boolean;
  caption: string;
  cutouts: Cutout[];
  onCutoutsChange: (next: Cutout[]) => void;
  locked: boolean;
  squareSizePx: number;
  baseFontSizePx: number;
  lineHeightMultiplier: number;
  letterSpacingPx: number;
  fontOption: FontOption;
  bracket: BracketOption;
  shape: ShapeOption;
  stickerStyleId: StickerStyleId;
  captionBgColor: string;
  textColor: string;
  stickerColor: string;
  pan: { x: number; y: number };
  onPanChange: (next: { x: number; y: number }) => void;
  /** Independent crop position for the second photo in a duo collage. */
  pan2: { x: number; y: number };
  onPan2Change: (next: { x: number; y: number }) => void;
  decor: DecorState;
  tiles: Tile[];
  onTilesChange: (next: Tile[]) => void;
  dots: Dot[];
  onDotsChange: (next: Dot[]) => void;
  wordPositions: WordPos[];
  onWordPositionsChange: (next: WordPos[]) => void;
  zoom: number;
  layout: PosterLayoutId;
  duotoneEnabled: boolean;
  duotoneDark: string;
  duotoneLight: string;
  grainEnabled: boolean;
  grainIntensity: number;
  subjectHalftoneEnabled: boolean;
  subjectMask: SubjectMask | null;
  onRequestUpload: () => void;
  onFilesDropped: (files: FileList) => void;
}

/** The detected subject of the first photo, painted as a flat color shape
 * (see silhouette.ts), aligned with that photo's cover-fit placement. */
function SilhouetteCanvas({
  mask,
  color,
  width,
  height,
  geom,
}: {
  mask: SubjectMask;
  color: string;
  width: number;
  height: number;
  geom: CropGeom;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { offsetX, offsetY, renderedW, renderedH } = geom;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSilhouette(ctx, mask, color, { x: 0, y: 0, w: canvas.width, h: canvas.height }, {
      offsetX: offsetX * dpr,
      offsetY: offsetY * dpr,
      renderedW: renderedW * dpr,
      renderedH: renderedH * dpr,
    });
  }, [mask, color, width, height, offsetX, offsetY, renderedW, renderedH]);
  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height }}
    />
  );
}

/** Loads a URL into an HTMLImageElement (null until ready) so canvas
 * drawing can sample the same bitmap the preview displays. */
function useImageElement(url: string | null): HTMLImageElement | null {
  const [state, setState] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setState({ url, img });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state && state.url === url ? state.img : null;
}

/** A sticker filled with a halftone print of the photo under it (see
 * drawHalftoneTile). Falls back to a flat color until the photo is ready. */
function HalftoneTile({
  img,
  geom,
  x,
  y,
  size,
  color,
  clipPath,
}: {
  img: HTMLImageElement | null;
  geom: CropGeom;
  x: number;
  y: number;
  size: number;
  color: string;
  clipPath: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { offsetX, offsetY, renderedW, renderedH } = geom;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || size <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = img ? stickerSourceRect({ offsetX, offsetY, renderedW, renderedH }, img.naturalWidth, x, y, size, 1) : null;
    if (img && rect) {
      drawHalftoneTile(ctx, img, rect, 0, 0, size, color);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
    }
  }, [img, offsetX, offsetY, renderedW, renderedH, x, y, size, color]);
  return <canvas ref={ref} className="absolute inset-0" style={{ width: size, height: size, clipPath }} />;
}

export function PosterPreview({
  canvasRef,
  imageUrl,
  uploadError,
  imageUrl2,
  uploadError2,
  collageLayoutId,
  onRequestUpload2,
  onFilesDropped2,
  captionEnabled,
  caption,
  cutouts,
  onCutoutsChange,
  locked,
  squareSizePx,
  baseFontSizePx,
  lineHeightMultiplier,
  letterSpacingPx,
  fontOption,
  bracket,
  shape,
  stickerStyleId,
  captionBgColor,
  textColor,
  stickerColor,
  pan,
  onPanChange,
  pan2,
  onPan2Change,
  decor,
  tiles,
  onTilesChange,
  dots,
  onDotsChange,
  wordPositions,
  onWordPositionsChange,
  zoom,
  layout,
  duotoneEnabled,
  duotoneDark,
  duotoneLight,
  grainEnabled,
  grainIntensity,
  subjectHalftoneEnabled,
  subjectMask,
  onRequestUpload,
  onFilesDropped,
}: PosterPreviewProps) {
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  // The area inside the frame border: the overlay layer's coordinate space.
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 });
  const contentObserverRef = useRef<ResizeObserver | null>(null);
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    contentObserverRef.current?.disconnect();
    contentObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContentSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    contentObserverRef.current = observer;
  }, []);
  const overlayDrag = useRef<{
    kind: "tile" | "dot" | "word";
    id: string;
    index: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originU: number;
    originV: number;
  } | null>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement>(null);
  const [textZoneSize, setTextZoneSize] = useState({ w: 0, h: 0 });
  const subjectHalftoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; originXPct: number; originYPct: number } | null>(
    null,
  );
  const panDragState = useRef<{ slot: 1 | 2; startX: number; startY: number; originPanX: number; originPanY: number } | null>(null);

  const isDuo = collageLayoutId !== "single";

  const natural = useNaturalSize(imageUrl);
  const natural2 = useNaturalSize(imageUrl2);

  // A *callback* ref, not useRef+useEffect([]) -- the photo zone's own div
  // gets torn down and remounted as a fresh DOM node whenever the layout
  // switches into/out of the two "overlay" arrangements (its position in
  // the tree changes depth: a sibling of the text zone in the 4 split
  // layouts, but the text zone's own *parent* in the overlay layouts, which
  // React can't reconcile as "the same" node across). A useEffect with an
  // empty dependency array only ever attaches once, so after that first
  // remount it would keep observing the old, now-detached element forever
  // -- boxSize freezing in place (often at 0x0) and the photo silently
  // vanishing (background-size collapses to "0px 0px") on every layout
  // switch after the first overlay one, with no way to recover short of a
  // full page reload. A callback ref re-fires on every attach, old node or
  // new, so it always ends up observing whichever element is actually live.
  const boxObserverRef = useRef<ResizeObserver | null>(null);
  const bottomZoneRef = useCallback((el: HTMLDivElement | null) => {
    boxObserverRef.current?.disconnect();
    boxObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setBoxSize({ w, h });
    });
    observer.observe(el);
    boxObserverRef.current = observer;
  }, []);

  const duotoneUrl = useDuotoneUrl(imageUrl, natural, duotoneEnabled, duotoneDark, duotoneLight);
  const duotoneUrl2 = useDuotoneUrl(imageUrl2, natural2, duotoneEnabled, duotoneDark, duotoneLight);

  // Falls back to the plain photo while the duotone recolor is still being
  // computed (async, one extra frame or two) so toggling it on doesn't
  // flash the photo away for an instant.
  const displayImageUrl = duotoneEnabled ? (duotoneUrl ?? imageUrl) : imageUrl;
  const displayImageUrl2 = duotoneEnabled ? (duotoneUrl2 ?? imageUrl2) : imageUrl2;
  const imageEl = useImageElement(displayImageUrl);
  const imageEl2 = useImageElement(displayImageUrl2);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setFrameSize({ w, h });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasRef]);

  // Redraws the film-grain layer only when it actually needs to change
  // (not on every render, e.g. while dragging a cutout) so the noise
  // pattern stays put instead of flickering like TV static.
  useEffect(() => {
    if (!grainEnabled || !frameSize.w || !frameSize.h) return;
    const canvas = grainCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = frameSize.w * dpr;
    canvas.height = frameSize.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFilmGrain(ctx, canvas.width, canvas.height, grainIntensity / 100);
  }, [grainEnabled, grainIntensity, frameSize]);

  // Same callback-ref reasoning as bottomZoneRef above -- the text zone's
  // div moves between being canvasRef's direct sibling and being nested
  // inside the photo zone across the overlay/non-overlay layout switch, so
  // a plain useRef+useEffect([]) would silently stop tracking its size
  // after the first such switch.
  const textZoneObserverRef = useRef<ResizeObserver | null>(null);
  const textZoneRef = useCallback((el: HTMLDivElement | null) => {
    textZoneObserverRef.current?.disconnect();
    textZoneObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setTextZoneSize({ w, h });
    });
    observer.observe(el);
    textZoneObserverRef.current = observer;
  }, []);

  // Renders a dot-matrix silhouette of whatever subjectMask detected in the
  // photo (see subjectSegmentation.ts) behind the caption text, instead of
  // that zone's plain background -- subjectMask itself is computed once
  // per photo up in PhotoPosterTool.tsx (segmentation is comparatively
  // slow and shared with the export path), this effect only handles
  // drawing it at the text zone's current size.
  useEffect(() => {
    if (!subjectHalftoneEnabled || !subjectMask || !imageUrl || !textZoneSize.w || !textZoneSize.h) return;
    const canvas = subjectHalftoneCanvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = textZoneSize.w * dpr;
    canvas.height = textZoneSize.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, textZoneSize.w, textZoneSize.h);
      drawSubjectHalftone(ctx, img, subjectMask, { x: 0, y: 0, w: textZoneSize.w, h: textZoneSize.h }, shape.id, textColor);
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [subjectHalftoneEnabled, subjectMask, imageUrl, textZoneSize, shape.id, textColor]);

  // In a duo collage, each photo only ever fills its own half of the photo
  // zone -- halved on whichever axis the split runs along, full-size on the
  // other. In single mode this collapses back to the full box, so `geometry`
  // below is exactly what it always was.
  const paneBoxW = collageLayoutId === "duo-h" ? boxSize.w / 2 : boxSize.w;
  const paneBoxH = collageLayoutId === "duo-v" ? boxSize.h / 2 : boxSize.h;

  const geometry = computeCoverGeometry(paneBoxW, paneBoxH, natural.w, natural.h, pan, zoom);
  // Each photo in a duo collage has its own crop position (drag within its
  // own pane); the zoom slider is still shared.
  const geometry2 = computeCoverGeometry(paneBoxW, paneBoxH, natural2.w, natural2.h, pan2, zoom);
  const squareXPct = boxSize.w ? (squareSizePx / boxSize.w) * 100 : 0;
  const squareYPct = boxSize.h ? (squareSizePx / boxSize.h) * 100 : 0;

  // With the words hidden, only the inline photo windows remain, so they
  // gather in the middle of the block instead of spreading over blank gaps.
  const allTokens = buildCaptionTokens(caption, cutouts);
  const tokens = allTokens.filter(
    (t) => (decor.showCaptionText || t.kind === "cutout") && (decor.inlineWindows || t.kind === "word"),
  );
  const cutoutById = new Map(cutouts.map((c) => [c.id, c]));

  // Dragging the photo itself (not a cutout square) repositions which part
  // of it the "cover" crop shows -- separate from the cutout-square drag
  // above since it's attached to a different element (squares sit on top
  // and capture their own pointer events first, so there's no conflict).
  // In a duo collage each pane drags its own photo independently.
  function handlePhotoPointerDown(e: ReactPointerEvent<HTMLDivElement>, slot: 1 | 2) {
    if (locked || !boxSize.w || !boxSize.h) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const origin = slot === 1 ? pan : pan2;
    panDragState.current = { slot, startX: e.clientX, startY: e.clientY, originPanX: origin.x, originPanY: origin.y };
  }

  function handlePhotoPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragState.current;
    if (!drag) return;
    const geom = drag.slot === 1 ? geometry : geometry2;
    const current = drag.slot === 1 ? pan : pan2;
    const slackX = geom.renderedW - paneBoxW;
    const slackY = geom.renderedH - paneBoxH;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    // Dragging right should reveal more of the image's left side (the
    // image visually follows the cursor), so pan decreases as dx increases.
    const nextX = slackX > 0 ? clamp01(drag.originPanX - dx / slackX) : current.x;
    const nextY = slackY > 0 ? clamp01(drag.originPanY - dy / slackY) : current.y;
    (drag.slot === 1 ? onPanChange : onPan2Change)({ x: nextX, y: nextY });
  }

  function handlePhotoPointerUp() {
    panDragState.current = null;
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, cutout: Cutout) {
    if (locked || !boxSize.w || !boxSize.h) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      id: cutout.id,
      startX: e.clientX,
      startY: e.clientY,
      originXPct: cutout.xPct,
      originYPct: cutout.yPct,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || !boxSize.w || !boxSize.h) return;
    const dxPct = ((e.clientX - drag.startX) / boxSize.w) * 100;
    const dyPct = ((e.clientY - drag.startY) / boxSize.h) * 100;
    const nextX = clampPct(drag.originXPct + dxPct, squareXPct);
    const nextY = clampPct(drag.originYPct + dyPct, squareYPct);
    onCutoutsChange(cutouts.map((c) => (c.id === drag.id ? { ...c, xPct: nextX, yPct: nextY } : c)));
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  function thumbStyle(cutout: Cutout): React.CSSProperties {
    // The thumbnail shows whichever photo the cutout sits over (in a duo
    // collage that's decided by which pane its center falls in).
    const crop = cropBackground(cutout, 1);
    return {
      width: squareSizePx,
      height: squareSizePx,
      display: "inline-block",
      verticalAlign: "middle",
      ...(crop ?? { backgroundColor: cutout.color ?? stickerColor }),
      clipPath: shape.clipPath,
    };
  }

  /** Which pane a cutout is over, its position inside that pane, and that
   * pane's photo. */
  function paneFor(cutout: Cutout) {
    const loc = locateInPane(
      collageLayoutId,
      boxSize.w,
      boxSize.h,
      (cutout.xPct / 100) * boxSize.w,
      (cutout.yPct / 100) * boxSize.h,
      squareSizePx,
    );
    return {
      ...loc,
      geom: loc.index === 0 ? geometry : geometry2,
      url: loc.index === 0 ? displayImageUrl : displayImageUrl2,
      img: loc.index === 0 ? imageEl : imageEl2,
    };
  }

  /** CSS background showing the photo region under a cutout, magnified
   * about its center. Returns null when that pane has no photo yet. */
  function cropBackground(cutout: Cutout, magnify: number): React.CSSProperties | null {
    const p = paneFor(cutout);
    if (!p.url || !p.geom.renderedW) return null;
    // offsetX/Y are <= 0 (see computeCoverGeometry), so the cutout's point
    // inside the full scaled image is p.x - offsetX. Positions are negated
    // numerically (never string-prefixed) since they can already be negative.
    const cx = (-p.geom.offsetX + p.x + squareSizePx / 2) * magnify;
    const cy = (-p.geom.offsetY + p.y + squareSizePx / 2) * magnify;
    return {
      backgroundImage: `url(${p.url})`,
      backgroundSize: `${p.geom.renderedW * magnify}px ${p.geom.renderedH * magnify}px`,
      backgroundPosition: `${squareSizePx / 2 - cx}px ${squareSizePx / 2 - cy}px`,
      backgroundRepeat: "no-repeat",
    };
  }

  function renderSticker(cutout: Cutout) {
    const fillColor = cutout.color ?? stickerColor;
    const commonProps = {
      "data-cutout-id": cutout.id,
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => handlePointerDown(e, cutout),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    };
    const outerStyle: React.CSSProperties = {
      left: `${cutout.xPct}%`,
      top: `${cutout.yPct}%`,
      width: squareSizePx,
      height: squareSizePx,
      cursor: locked ? "default" : "grab",
    };

    // Both styles are just the bare shape (no outline, no shadow): flat
    // fills it with the color, halftone with a dot print of the photo.
    return (
      <div key={cutout.id} {...commonProps} className="absolute" style={outerStyle}>
        {stickerStyleId === "halftone" ? (
          (() => {
            const p = paneFor(cutout);
            return (
              <HalftoneTile
                img={p.img}
                geom={p.geom}
                x={p.x}
                y={p.y}
                size={squareSizePx}
                color={fillColor}
                clipPath={shape.clipPath}
              />
            );
          })()
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: fillColor, clipPath: shape.clipPath }} />
        )}
      </div>
    );
  }

  // The caption zone and photo zone can sit top/bottom (either order),
  // left/right (either order), or -- for the two "overlay" layouts -- the
  // photo fills the whole canvas with the caption as an absolutely
  // positioned band on top of it. Either way the ResizeObserver on the
  // photo zone measures whatever box it actually ends up with, so none of
  // the drag/crop math above needs to know or care which arrangement is
  // active.
  const isOverlay = layout === "overlay-h" || layout === "overlay-v";
  const isRow = layout === "split-left" || layout === "split-right";
  const textFirst = layout === "text-top" || layout === "split-left";
  // No caption at all -> the photo zone is the canvas's only content, same
  // full-bleed structure the overlay layouts already use (never a split
  // that reserves empty space for a caption that isn't there).
  const fullBleed = isOverlay || !captionEnabled;

  // Before a photo is uploaded the caption zone never grows past half, so
  // the "click to upload" target in the photo zone stays visible even for
  // looks that would otherwise let the paper cover the whole poster.
  const fraction = decor.captionFraction == null ? null : imageUrl ? decor.captionFraction : Math.min(decor.captionFraction, 0.5);
  const bandFraction = fraction ?? OVERLAY_BAND_FRACTION;
  const splitFraction = fraction ?? TOP_ZONE_FRACTION;
  const bandInset = `${((1 - bandFraction) / 2) * 100}%`;
  const overlayTextStyle: React.CSSProperties = isOverlay
    ? layout === "overlay-h"
      ? { position: "absolute", left: 0, right: 0, top: bandInset, height: `${bandFraction * 100}%`, backgroundColor: captionBgColor }
      : { position: "absolute", top: 0, bottom: 0, left: bandInset, width: `${bandFraction * 100}%`, backgroundColor: captionBgColor }
    : isRow
      ? { width: `${splitFraction * 100}%` }
      : { height: `${splitFraction * 100}%` };

  const flowText = decor.captionMode === "flow";
  const textFontFamily = `${fontOption.cssVar}, ${fontOption.fallback}`;

  const textZone = (
    <div
      key="text"
      ref={textZoneRef}
      data-role="top-zone"
      className={`relative isolate flex flex-shrink-0 flex-wrap content-center items-center justify-center gap-x-1 gap-y-2 overflow-hidden px-[6%] py-[7%] ${isOverlay ? "z-10" : ""}`}
      style={{
        color: textColor,
        fontFamily: textFontFamily,
        fontSize: baseFontSizePx,
        lineHeight: lineHeightMultiplier,
        letterSpacing: `${letterSpacingPx}px`,
        ...overlayTextStyle,
      }}
    >
      {subjectHalftoneEnabled && subjectMask && (
        <canvas
          ref={subjectHalftoneCanvasRef}
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ width: "100%", height: "100%" }}
        />
      )}
      {flowText &&
        tokens.map((token, i) =>
          token.kind === "word" ? (
            <span key={i}>{token.text}</span>
          ) : (
            <span key={i} className="inline-flex items-center" style={{ fontSize: baseFontSizePx }}>
              {bracket.open}
              <span data-cutout-id={token.cutoutId} style={thumbStyle(cutoutById.get(token.cutoutId)!)} />
              {bracket.close}
            </span>
          ),
        )}
    </div>
  );

  function photoPane(
    url: string | null,
    displayUrl: string | null,
    geom: CoverGeometry,
    slot: 1 | 2,
    onUpload: () => void,
    onDrop: (files: FileList) => void,
    error: string | null,
    // Ctrl/Cmd+V paste always targets the first photo slot (see the paste
    // listener in PhotoPosterTool.tsx), so only that slot's empty-state
    // hints at it.
    pasteHint: boolean,
  ) {
    if (!url) {
      return (
        <div
          onClick={onUpload}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(e.dataTransfer.files);
          }}
          className="absolute inset-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-4 text-center text-ink-faint transition hover:border-accent hover:text-accent"
        >
          <span className="text-sm font-medium">點擊上傳照片</span>
          <span className="text-xs">或拖曳圖片到此處{pasteHint ? "，或 Ctrl/Cmd+V 貼上" : ""}</span>
          {error && <span className="mt-2 text-xs text-red-400">{error}</span>}
        </div>
      );
    }
    return (
      <div
        onPointerDown={(e) => handlePhotoPointerDown(e, slot)}
        onPointerMove={handlePhotoPointerMove}
        onPointerUp={handlePhotoPointerUp}
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${displayUrl})`,
          backgroundSize: `${geom.renderedW}px ${geom.renderedH}px`,
          backgroundPosition: `${geom.offsetX}px ${geom.offsetY}px`,
          backgroundRepeat: "no-repeat",
          cursor: locked ? "default" : "grab",
        }}
      />
    );
  }

  const photoZone = (
    <div
      key="photo"
      ref={bottomZoneRef}
      className={`relative flex min-h-0 min-w-0 flex-1 select-none touch-none bg-surface-2 ${decor.frameInsetPct > 0 ? "" : "gap-px"} ${
        collageLayoutId === "duo-v" ? "flex-col" : "flex-row"
      }`}
    >
      {isDuo ? (
        <>
          <div className="relative min-h-0 min-w-0 flex-1">
            {photoPane(imageUrl, displayImageUrl, geometry, 1, onRequestUpload, onFilesDropped, uploadError, true)}
          </div>
          <div className="relative min-h-0 min-w-0 flex-1">
            {photoPane(imageUrl2, displayImageUrl2, geometry2, 2, onRequestUpload2, onFilesDropped2, uploadError2, false)}
          </div>
        </>
      ) : (
        photoPane(imageUrl, displayImageUrl, geometry, 1, onRequestUpload, onFilesDropped, uploadError, true)
      )}
      {isDuo && decor.frameInsetPct > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            backgroundColor: decor.frameColor,
            ...(collageLayoutId === "duo-h"
              ? { top: 0, bottom: 0, left: "50%", width: (frameSize.w * decor.frameInsetPct) / 100, transform: "translateX(-50%)" }
              : { left: 0, right: 0, top: "50%", height: (frameSize.w * decor.frameInsetPct) / 100, transform: "translateY(-50%)" }),
          }}
        />
      )}
      {decor.silhouetteEnabled && subjectMask && imageUrl && (
        <SilhouetteCanvas mask={subjectMask} color={decor.silhouetteColor} width={paneBoxW} height={paneBoxH} geom={geometry} />
      )}
      {imageUrl && cutouts.map((cutout) => renderSticker(cutout))}
      {/* Overlay layouts nest the text band *inside* the photo zone (as its
          absolutely positioned child) rather than as a canvasEl-level
          sibling -- keeping the photo zone the sole normal in-flow child of
          canvasEl in every layout, overlay included. A canvasEl with no
          in-flow children at all (which an overlay-as-sibling structure
          would produce, since both zones would need position:absolute to
          overlap) left the aspect-ratio-driven ancestor frame with no
          content to size against and it collapsed to 0x0 -- confirmed by
          bisecting against the working non-overlay structure, which always
          keeps a normal in-flow child here. */}
      {isOverlay && captionEnabled && textZone}
    </div>
  );

  // --- Free-position overlay layer: small photo tiles, solid dots, and the
  // corner / scatter caption modes. Positions are % of the area inside the
  // frame, so they follow any canvas size; the export mirrors this. ---
  function startOverlayDrag(
    e: ReactPointerEvent<HTMLElement>,
    kind: "tile" | "dot" | "word",
    id: string,
    index: number,
    originX: number,
    originY: number,
    originU = 0,
    originV = 0,
  ) {
    if (locked || !contentSize.w || !contentSize.h) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    overlayDrag.current = { kind, id, index, startX: e.clientX, startY: e.clientY, originX, originY, originU, originV };
  }

  function moveOverlayDrag(e: ReactPointerEvent<HTMLElement>) {
    const d = overlayDrag.current;
    if (!d || !contentSize.w || !contentSize.h) return;
    const x = d.originX + ((e.clientX - d.startX) / contentSize.w) * 100;
    const y = d.originY + ((e.clientY - d.startY) / contentSize.h) * 100;
    if (d.kind === "tile" && decor.tileDragMode === "crop") {
      // Pan which part of the source photo the tile shows (the content
      // follows the finger), leaving the tile itself where it is.
      const t = tiles.find((tile) => tile.id === d.id);
      if (!t) return;
      const nat = t.photo === 1 && imageUrl2 ? natural2 : natural;
      if (!nat.w || !nat.h) return;
      const tw = (t.wPct / 100) * contentSize.w;
      const th = tw / t.aspect;
      const r = tileSourceRect(t, nat.w, nat.h);
      const halfU = r.sw / nat.w / 2;
      const halfV = r.sh / nat.h / 2;
      const u = Math.min(1 - halfU, Math.max(halfU, d.originU - ((e.clientX - d.startX) / tw) * (r.sw / nat.w)));
      const v = Math.min(1 - halfV, Math.max(halfV, d.originV - ((e.clientY - d.startY) / th) * (r.sh / nat.h)));
      onTilesChange(tiles.map((tile) => (tile.id === d.id ? { ...tile, u, v } : tile)));
      return;
    }
    if (d.kind === "tile") {
      onTilesChange(
        tiles.map((t) =>
          t.id === d.id
            ? { ...t, xPct: clampPct(x, t.wPct), yPct: clampPct(y, ((t.wPct / t.aspect) * contentSize.w) / contentSize.h) }
            : t,
        ),
      );
    } else if (d.kind === "dot") {
      onDotsChange(dots.map((dot) => (dot.id === d.id ? { ...dot, xPct: clampPct(x, 0), yPct: clampPct(y, 0) } : dot)));
    } else {
      onWordPositionsChange(wordPositions.map((w, i) => (i === d.index ? { xPct: clampPct(x, 0), yPct: clampPct(y, 0) } : w)));
    }
  }

  function endOverlayDrag() {
    overlayDrag.current = null;
  }

  const overlayCursor = locked ? "default" : "grab";
  const showOverlayText = captionEnabled && decor.showCaptionText;

  function renderTile(tile: Tile, i: number) {
    const useSecond = tile.photo === 1 && !!imageUrl2;
    const url = useSecond ? displayImageUrl2 : displayImageUrl;
    const nat = useSecond ? natural2 : natural;
    const tw = (tile.wPct / 100) * contentSize.w;
    const th = tw / tile.aspect;
    let bg: React.CSSProperties = { backgroundColor: "#d4d4d8" };
    if (url && nat.w && nat.h && tw > 0) {
      const r = tileSourceRect(tile, nat.w, nat.h);
      const k = tw / r.sw;
      bg = {
        backgroundImage: `url(${url})`,
        backgroundSize: `${nat.w * k}px ${nat.h * k}px`,
        backgroundPosition: `${-r.sx * k}px ${-r.sy * k}px`,
        backgroundRepeat: "no-repeat",
      };
    }
    return (
      <div
        key={tile.id}
        className="pointer-events-auto absolute"
        style={{
          left: `${tile.xPct}%`,
          top: `${tile.yPct}%`,
          width: tw,
          height: th,
          cursor: overlayCursor,
          // In crop mode the tiles are outlined so it's clear that dragging
          // now pans the photo inside them instead of moving them.
          boxShadow: decor.tileDragMode === "crop" ? "0 0 0 2px #c8ff3d" : undefined,
          ...bg,
        }}
        onPointerDown={(e) => startOverlayDrag(e, "tile", tile.id, i, tile.xPct, tile.yPct, tile.u, tile.v)}
        onPointerMove={moveOverlayDrag}
        onPointerUp={endOverlayDrag}
      >
        {decor.tileNumbered && (
          <span
            className="pointer-events-none absolute left-0 whitespace-nowrap"
            style={{ top: "-1.15em", fontSize: baseFontSizePx * 0.7, lineHeight: 1, color: textColor, fontFamily: textFontFamily }}
          >
            ({i + 1})
          </span>
        )}
      </div>
    );
  }

  const words = showOverlayText && decor.captionMode === "scatter" ? captionWords(caption) : [];
  const overlayLayer = (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden" style={{ color: textColor }}>
      {decor.tilesEnabled && imageUrl && tiles.map((tile, i) => renderTile(tile, i))}
      {decor.dotsEnabled &&
        dots.map((dot) => (
          <div
            key={dot.id}
            className="pointer-events-auto absolute rounded-full"
            style={{
              left: `${dot.xPct}%`,
              top: `${dot.yPct}%`,
              width: decor.dotSizePx,
              height: decor.dotSizePx,
              transform: "translate(-50%, -50%)",
              backgroundColor: dot.color,
              cursor: overlayCursor,
            }}
            onPointerDown={(e) => startOverlayDrag(e, "dot", dot.id, 0, dot.xPct, dot.yPct)}
            onPointerMove={moveOverlayDrag}
            onPointerUp={endOverlayDrag}
          />
        ))}
      {words.map((word, i) => {
        const pos = wordPositions[i];
        if (!pos) return null;
        return (
          <div
            key={`${i}-${word}`}
            className="pointer-events-auto absolute whitespace-nowrap"
            style={{
              left: `${pos.xPct}%`,
              top: `${pos.yPct}%`,
              transform: "translate(-50%, -50%)",
              fontFamily: textFontFamily,
              fontSize: baseFontSizePx,
              lineHeight: 1,
              cursor: overlayCursor,
            }}
            onPointerDown={(e) => startOverlayDrag(e, "word", word, i, pos.xPct, pos.yPct)}
            onPointerMove={moveOverlayDrag}
            onPointerUp={endOverlayDrag}
          >
            <span
              className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
              style={{ backgroundColor: textColor, transform: "translate(-50%, calc(-50% - 0.95em))" }}
            />
            {word}
          </div>
        );
      })}
      {showOverlayText && decor.captionMode === "corner" && (
        <div
          className="pointer-events-none absolute text-right"
          style={{ right: "5%", top: "4%", fontFamily: textFontFamily, fontSize: baseFontSizePx * 0.85, lineHeight: 1 }}
        >
          {cornerLines(caption).map((line, i) => (
            <div key={i} style={{ marginBottom: "1.6em" }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Sits above every other layer (photo, cutouts, caption text) in both
  // branches below, matching how film grain sits on top of an actual
  // printed poster rather than being just another background layer.
  const grainOverlay = grainEnabled && (
    <canvas
      ref={grainCanvasRef}
      className="pointer-events-none absolute inset-0 z-20"
      style={{ width: "100%", height: "100%" }}
    />
  );

  // The outer element is what gets measured/exported (frame included); the
  // inner one is the poster's content area, inset by the frame border
  // (padding in % is relative to width on all sides, matching the export).
  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: decor.frameInsetPct > 0 ? decor.frameColor : captionBgColor,
        padding: `${decor.frameInsetPct}%`,
      }}
    >
      <div
        ref={contentRef}
        className={`relative flex h-full w-full overflow-hidden ${fullBleed ? "" : isRow ? "flex-row" : "flex-col"}`}
        style={{ backgroundColor: captionBgColor }}
      >
        {fullBleed ? photoZone : textFirst ? [textZone, photoZone] : [photoZone, textZone]}
        {overlayLayer}
      </div>
      {grainOverlay}
    </div>
  );
}
