"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import { drawFilmGrain } from "./grain";
import type { SubjectMask } from "./subjectSegmentation";
import { captionWords, cornerLines, tileSourceRect } from "./decorLayout";
import { drawSilhouette } from "./silhouette";
import { buildSubjectCutout } from "./subjectCutout";
import { computeZones } from "./zones";
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
import { paneFracs } from "./collage";
import { drawHalftoneTile, locateInPane, stickerSourceRect, type CropGeom } from "./stickerCrop";
import { buildCaptionTokens, clampPct } from "./useCutoutLayout";

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

/** Loads every photo url (one per slot) once; returns the image elements
 * and natural sizes per slot (null / 0x0 until loaded or when empty). */
function useImages(urls: (string | null)[]): { els: (HTMLImageElement | null)[]; naturals: { w: number; h: number }[] } {
  const [loaded, setLoaded] = useState<Record<string, HTMLImageElement>>({});
  const key = urls.join("|");
  useEffect(() => {
    let cancelled = false;
    urls.forEach((u) => {
      if (!u) return;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setLoaded((prev) => (prev[u] ? prev : { ...prev, [u]: img }));
      };
      img.src = u;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const els = urls.map((u) => (u ? (loaded[u] ?? null) : null));
  const naturals = els.map((el) => ({ w: el?.naturalWidth ?? 0, h: el?.naturalHeight ?? 0 }));
  return { els, naturals };
}

export interface PosterPreviewProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** One url / error per photo slot (see collage.ts). */
  imageUrls: (string | null)[];
  uploadErrors: (string | null)[];
  collageLayoutId: CollageLayoutId;
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
  pans: { x: number; y: number }[];
  onPanChange: (slot: number, next: { x: number; y: number }) => void;
  decor: DecorState;
  tiles: Tile[];
  onTilesChange: (next: Tile[]) => void;
  dots: Dot[];
  onDotsChange: (next: Dot[]) => void;
  wordPositions: WordPos[];
  onWordPositionsChange: (next: WordPos[]) => void;
  zooms: number[];
  layout: PosterLayoutId;
  grainEnabled: boolean;
  grainIntensity: number;
  subjectMasks: (SubjectMask | null)[];
  onDecorChange: (patch: Partial<DecorState>) => void;
  onRequestUpload: (slot: number) => void;
  onFilesDropped: (slot: number, files: FileList) => void;
}

/** The detected subject of a photo, painted as a flat color shape
 * (see silhouette.ts), aligned with that photo's cover-fit placement. */
function SilhouetteCanvas({
  mask,
  color,
  width,
  height,
  geom,
  left = 0,
  top = 0,
}: {
  left?: number;
  top?: number;
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
      className="pointer-events-none absolute"
      style={{ width, height, left, top }}
    />
  );
}

/** The cut-out subject (see subjectCutout.ts) drawn into a canvas that
 * scales to whatever size the poster is shown at. */
function PastedSubject({
  canvas: source,
  style,
  handlers,
}: {
  canvas: HTMLCanvasElement;
  style: React.CSSProperties;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: () => void;
  };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    ctx?.drawImage(source, 0, 0);
  }, [source]);
  return <canvas ref={ref} className="pointer-events-auto absolute" style={style} {...handlers} />;
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
  imageUrls,
  uploadErrors,
  collageLayoutId,
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
  pans,
  onPanChange,
  decor,
  tiles,
  onTilesChange,
  dots,
  onDotsChange,
  wordPositions,
  onWordPositionsChange,
  zooms,
  layout,
  grainEnabled,
  grainIntensity,
  subjectMasks,
  onDecorChange,
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
  const subjectDrag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; originXPct: number; originYPct: number } | null>(
    null,
  );
  const panDragState = useRef<{ slot: number; startX: number; startY: number; originPanX: number; originPanY: number } | null>(null);

  const panesFrac = paneFracs(collageLayoutId);
  const imageUrl = imageUrls[0] ?? null;
  const { els: imageEls, naturals } = useImages(imageUrls.slice(0, panesFrac.length));

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

  // Each photo only ever fills its own pane of the photo zone (see
  // collage.ts), with its own crop position and zoom. In single mode the
  // one pane is the whole box.
  const paneBoxes = panesFrac.map((f) => ({ w: f.w * boxSize.w, h: f.h * boxSize.h }));
  const geometries = paneBoxes.map((b, i) =>
    computeCoverGeometry(b.w, b.h, naturals[i].w, naturals[i].h, pans[i] ?? { x: 0.5, y: 0.5 }, zooms[i] ?? 1),
  );
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
  function handlePhotoPointerDown(e: ReactPointerEvent<HTMLDivElement>, slot: number) {
    if (locked || !boxSize.w || !boxSize.h) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const origin = pans[slot] ?? { x: 0.5, y: 0.5 };
    panDragState.current = { slot, startX: e.clientX, startY: e.clientY, originPanX: origin.x, originPanY: origin.y };
  }

  function handlePhotoPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragState.current;
    if (!drag) return;
    const geom = geometries[drag.slot];
    const current = pans[drag.slot] ?? { x: 0.5, y: 0.5 };
    const slackX = geom.renderedW - paneBoxes[drag.slot].w;
    const slackY = geom.renderedH - paneBoxes[drag.slot].h;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    // Dragging right should reveal more of the image's left side (the
    // image visually follows the cursor), so pan decreases as dx increases.
    const nextX = slackX > 0 ? clamp01(drag.originPanX - dx / slackX) : current.x;
    const nextY = slackY > 0 ? clamp01(drag.originPanY - dy / slackY) : current.y;
    onPanChange(drag.slot, { x: nextX, y: nextY });
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
      geom: geometries[loc.index],
      url: imageUrls[loc.index] ?? null,
      img: imageEls[loc.index] ?? null,
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
  // Free-placed items (small photos, dots, scattered words) are positioned
  // as % of the caption zone -- the whole poster when there is none -- so
  // they follow it when its size or position changes.
  const zoneRect = captionEnabled
    ? computeZones(layout, contentSize.w, contentSize.h, fraction).text
    : { x: 0, y: 0, w: contentSize.w, h: contentSize.h };
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

  function photoPane(slot: number) {
    const url = imageUrls[slot] ?? null;
    const geom = geometries[slot];
    const error = uploadErrors[slot] ?? null;
    const onUpload = () => onRequestUpload(slot);
    const onDrop = (files: FileList) => onFilesDropped(slot, files);
    const pasteHint = slot === 0 || !imageUrl;
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
          backgroundImage: `url(${url})`,
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
      className="relative min-h-0 min-w-0 flex-1 select-none touch-none bg-surface-2"
    >
      {panesFrac.map((f, slot) => (
        <div
          key={slot}
          className="absolute"
          style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
        >
          {photoPane(slot)}
        </div>
      ))}
      {panesFrac.length > 1 && decor.frameInsetPct > 0 && (
        <>
          {panesFrac.map((f, slot) => {
            const t = (frameSize.w * decor.frameInsetPct) / 100;
            return (
              <Fragment key={slot}>
                {f.x > 0.001 && (
                  <div
                    className="pointer-events-none absolute"
                    style={{ backgroundColor: decor.frameColor, left: `${f.x * 100}%`, top: `${f.y * 100}%`, height: `${f.h * 100}%`, width: t, transform: "translateX(-50%)" }}
                  />
                )}
                {f.y > 0.001 && (
                  <div
                    className="pointer-events-none absolute"
                    style={{ backgroundColor: decor.frameColor, left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: t, transform: "translateY(-50%)" }}
                  />
                )}
              </Fragment>
            );
          })}
        </>
      )}
      {decor.silhouetteEnabled &&
        panesFrac.map((f, slot) => {
          const m = subjectMasks[slot];
          if (!m || !imageUrls[slot]) return null;
          return (
            <SilhouetteCanvas
              key={slot}
              mask={m}
              color={decor.silhouetteColor}
              width={paneBoxes[slot].w}
              height={paneBoxes[slot].h}
              geom={geometries[slot]}
              left={f.x * boxSize.w}
              top={f.y * boxSize.h}
            />
          );
        })}
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
    if (locked || !zoneRect.w || !zoneRect.h) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    overlayDrag.current = { kind, id, index, startX: e.clientX, startY: e.clientY, originX, originY, originU, originV };
  }

  function moveOverlayDrag(e: ReactPointerEvent<HTMLElement>) {
    const d = overlayDrag.current;
    if (!d || !zoneRect.w || !zoneRect.h) return;
    const x = d.originX + ((e.clientX - d.startX) / zoneRect.w) * 100;
    const y = d.originY + ((e.clientY - d.startY) / zoneRect.h) * 100;
    if (d.kind === "tile" && decor.tileDragMode === "crop") {
      // Pan which part of the source photo the tile shows (the content
      // follows the finger), leaving the tile itself where it is.
      const t = tiles.find((tile) => tile.id === d.id);
      if (!t) return;
      const nat = naturals[tilePhoto(t)] ?? { w: 0, h: 0 };
      if (!nat.w || !nat.h) return;
      const tw = (t.wPct / 100) * zoneRect.w;
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
            ? { ...t, xPct: clampPct(x, t.wPct), yPct: clampPct(y, ((t.wPct / t.aspect) * zoneRect.w) / zoneRect.h) }
            : t,
        ),
      );
    } else if (d.kind === "dot") {
      onDotsChange(dots.map((dot) => (dot.id === d.id ? { ...dot, xPct: Math.min(140, Math.max(-40, x)), yPct: Math.min(140, Math.max(-40, y)) } : dot)));
    } else {
      onWordPositionsChange(wordPositions.map((w, i) => (i === d.index ? { xPct: Math.min(120, Math.max(-20, x)), yPct: Math.min(120, Math.max(-20, y)) } : w)));
    }
  }

  function endOverlayDrag() {
    overlayDrag.current = null;
  }

  /** The slot a small photo draws from (falls back to the first filled one). */
  function tilePhoto(t: Tile): number {
    if (imageUrls[t.photo] && t.photo < panesFrac.length) return t.photo;
    return Math.max(0, imageUrls.slice(0, panesFrac.length).findIndex(Boolean));
  }

  const overlayCursor = locked ? "default" : "grab";
  const showOverlayText = captionEnabled && decor.showCaptionText;

  function renderTile(tile: Tile, i: number) {
    const pi = tilePhoto(tile);
    const url = imageUrls[pi] ?? null;
    const nat = naturals[pi] ?? { w: 0, h: 0 };
    const tw = (tile.wPct / 100) * zoneRect.w;
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

  // The subject cut out of its photo and pasted elsewhere (positions are %
  // of the poster's content area, independent of the caption zone).
  const pasteSource = imageEls[decor.subjectPastePhoto] ?? null;
  const pasteMask = subjectMasks[decor.subjectPastePhoto] ?? null;
  const pastedCut =
    decor.silhouetteEnabled && decor.subjectPaste && pasteSource && pasteMask ? buildSubjectCutout(pasteSource, pasteMask) : null;
  const pasteW = (decor.subjectPasteW / 100) * contentSize.w;
  const pastedLayer = pastedCut && contentSize.w > 0 && (
    <div className="pointer-events-none absolute inset-0 z-[16] overflow-hidden">
      <PastedSubject
        canvas={pastedCut.canvas}
        style={{
          left: `${decor.subjectPasteX}%`,
          top: `${decor.subjectPasteY}%`,
          width: pasteW,
          height: pasteW / pastedCut.aspect,
          cursor: locked ? "default" : "grab",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
          touchAction: "none",
        }}
        handlers={{
          onPointerDown: (e) => {
            if (locked || !contentSize.w) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            subjectDrag.current = { startX: e.clientX, startY: e.clientY, originX: decor.subjectPasteX, originY: decor.subjectPasteY };
          },
          onPointerMove: (e) => {
            const d = subjectDrag.current;
            if (!d || !contentSize.w || !contentSize.h) return;
            onDecorChange({
              subjectPasteX: Math.min(110, Math.max(-30, d.originX + ((e.clientX - d.startX) / contentSize.w) * 100)),
              subjectPasteY: Math.min(110, Math.max(-30, d.originY + ((e.clientY - d.startY) / contentSize.h) * 100)),
            });
          },
          onPointerUp: () => {
            subjectDrag.current = null;
          },
        }}
      />
    </div>
  );

  const words = showOverlayText && decor.captionMode === "scatter" ? captionWords(caption) : [];
  const overlayLayer = (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden" style={{ color: textColor }}>
      <div
        className="absolute"
        style={{ left: zoneRect.x, top: zoneRect.y, width: zoneRect.w, height: zoneRect.h }}
      >
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
        {pastedLayer}
      </div>
      {grainOverlay}
    </div>
  );
}
