"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import { applyDuotone } from "./duotone";
import { drawFilmGrain } from "./grain";
import { drawSubjectHalftone } from "./subjectHalftone";
import type { SubjectMask } from "./subjectSegmentation";
import type { BracketOption, CollageLayoutId, Cutout, FontOption, PosterLayoutId, ShapeOption } from "./types";
import { buildCaptionTokens, clampPct } from "./useCutoutLayout";

const DUOTONE_PREVIEW_MAX_DIMENSION = 900;
const CENTER_PAN = { x: 0.5, y: 0.5 };
// Die-cut sticker border width, as a fraction of the cutout's own size --
// scaling with the sticker (not a fixed px) keeps the border reading as the
// same *proportion* of edge whether the sticker is tiny or huge. Shared
// with exportPoster.ts's identical constant so the live preview and the
// exported PNG agree.
const STICKER_BORDER_FRACTION = 0.1;

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
  topBgColor: string;
  textColor: string;
  pan: { x: number; y: number };
  onPanChange: (next: { x: number; y: number }) => void;
  zoom: number;
  layout: PosterLayoutId;
  duotoneEnabled: boolean;
  grainEnabled: boolean;
  grainIntensity: number;
  subjectHalftoneEnabled: boolean;
  subjectMask: SubjectMask | null;
  onRequestUpload: () => void;
  onFilesDropped: (files: FileList) => void;
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
  topBgColor,
  textColor,
  pan,
  onPanChange,
  zoom,
  layout,
  duotoneEnabled,
  grainEnabled,
  grainIntensity,
  subjectHalftoneEnabled,
  subjectMask,
  onRequestUpload,
  onFilesDropped,
}: PosterPreviewProps) {
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const grainCanvasRef = useRef<HTMLCanvasElement>(null);
  const [textZoneSize, setTextZoneSize] = useState({ w: 0, h: 0 });
  const subjectHalftoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; originXPct: number; originYPct: number } | null>(
    null,
  );
  const panDragState = useRef<{ startX: number; startY: number; originPanX: number; originPanY: number } | null>(null);

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

  const duotoneUrl = useDuotoneUrl(imageUrl, natural, duotoneEnabled, topBgColor, textColor);
  const duotoneUrl2 = useDuotoneUrl(imageUrl2, natural2, duotoneEnabled, topBgColor, textColor);

  // Falls back to the plain photo while the duotone recolor is still being
  // computed (async, one extra frame or two) so toggling it on doesn't
  // flash the photo away for an instant.
  const displayImageUrl = duotoneEnabled ? (duotoneUrl ?? imageUrl) : imageUrl;
  const displayImageUrl2 = duotoneEnabled ? (duotoneUrl2 ?? imageUrl2) : imageUrl2;

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

  const geometry = computeCoverGeometry(paneBoxW, paneBoxH, natural.w, natural.h, isDuo ? CENTER_PAN : pan, zoom);
  // The second photo doesn't get its own drag-to-pan handle (two
  // independently-dragged crops inside one small preview box got confusing
  // fast) -- it always centers within its pane, but still honors the shared
  // zoom slider so both halves can be framed tighter together.
  const geometry2 = computeCoverGeometry(paneBoxW, paneBoxH, natural2.w, natural2.h, CENTER_PAN, zoom);
  const squareXPct = boxSize.w ? (squareSizePx / boxSize.w) * 100 : 0;
  const squareYPct = boxSize.h ? (squareSizePx / boxSize.h) * 100 : 0;

  const tokens = buildCaptionTokens(caption, cutouts);
  const cutoutById = new Map(cutouts.map((c) => [c.id, c]));

  // Dragging the photo itself (not a cutout square) repositions which part
  // of it the "cover" crop shows -- separate from the cutout-square drag
  // above since it's attached to a different element (squares sit on top
  // and capture their own pointer events first, so there's no conflict).
  // Disabled in duo mode (see geometry/geometry2 above -- both photos stay
  // centered on their own pane there).
  function handlePhotoPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (locked || isDuo || !boxSize.w || !boxSize.h) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    panDragState.current = { startX: e.clientX, startY: e.clientY, originPanX: pan.x, originPanY: pan.y };
  }

  function handlePhotoPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragState.current;
    if (!drag) return;
    const slackX = geometry.renderedW - paneBoxW;
    const slackY = geometry.renderedH - paneBoxH;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    // Dragging right should reveal more of the image's left side (the
    // image visually follows the cursor), so pan decreases as dx increases.
    const nextX = slackX > 0 ? clamp01(drag.originPanX - dx / slackX) : pan.x;
    const nextY = slackY > 0 ? clamp01(drag.originPanY - dy / slackY) : pan.y;
    onPanChange({ x: nextX, y: nextY });
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
    // In a duo collage a cutout's crop could fall over either photo, and
    // the caption thumbnail has no easy way to say which -- so instead of
    // guessing, duo mode always shows these as flat color chips (the same
    // "no photo" fallback single mode already uses before any photo is
    // uploaded), matching the solid sticker each one already paints onto
    // the photo zone itself.
    const thumbImage = isDuo ? null : displayImageUrl;
    // xPct/yPct are relative to the *visible* box, not the full scaled
    // image. The box's own viewport starts `-offsetX`/`-offsetY` pixels
    // into the scaled image (offsetX/Y are <= 0, per computeCoverGeometry),
    // so that's the base to add the on-box pixel offset to, giving the
    // target point's position within the full scaled image.
    const left = -geometry.offsetX + (cutout.xPct / 100) * paneBoxW;
    const top = -geometry.offsetY + (cutout.yPct / 100) * paneBoxH;
    return {
      width: squareSizePx,
      height: squareSizePx,
      display: "inline-block",
      verticalAlign: "middle",
      backgroundImage: thumbImage ? `url(${thumbImage})` : undefined,
      backgroundColor: thumbImage ? undefined : (cutout.color ?? "#d4d4d8"),
      backgroundSize: `${geometry.renderedW}px ${geometry.renderedH}px`,
      // Negate numerically (not by string-prefixing "-") since left/top are
      // already negative whenever the cover-cropped image overflows its
      // box on that axis -- string-prefixing would emit invalid double
      // negatives like "--131px", which the browser silently drops,
      // leaving the previous (stale) background-position in place.
      backgroundPosition: `${-left}px ${-top}px`,
      backgroundRepeat: "no-repeat",
      clipPath: shape.clipPath,
    };
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

  const bandInset = `${((1 - OVERLAY_BAND_FRACTION) / 2) * 100}%`;
  const overlayTextStyle: React.CSSProperties = isOverlay
    ? layout === "overlay-h"
      ? { position: "absolute", left: 0, right: 0, top: bandInset, height: `${OVERLAY_BAND_FRACTION * 100}%`, backgroundColor: topBgColor }
      : { position: "absolute", top: 0, bottom: 0, left: bandInset, width: `${OVERLAY_BAND_FRACTION * 100}%`, backgroundColor: topBgColor }
    : isRow
      ? { width: `${TOP_ZONE_FRACTION * 100}%` }
      : { height: `${TOP_ZONE_FRACTION * 100}%` };

  const textZone = (
    <div
      key="text"
      ref={textZoneRef}
      data-role="top-zone"
      className={`relative isolate flex flex-shrink-0 flex-wrap content-center items-center justify-center gap-x-1 gap-y-2 overflow-hidden px-[6%] py-[7%] ${isOverlay ? "z-10" : ""}`}
      style={{
        color: textColor,
        fontFamily: `${fontOption.cssVar}, ${fontOption.fallback}`,
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
      {tokens.map((token, i) =>
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
    draggable: boolean,
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
        onPointerDown={draggable ? handlePhotoPointerDown : undefined}
        onPointerMove={draggable ? handlePhotoPointerMove : undefined}
        onPointerUp={draggable ? handlePhotoPointerUp : undefined}
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${displayUrl})`,
          backgroundSize: `${geom.renderedW}px ${geom.renderedH}px`,
          backgroundPosition: `${geom.offsetX}px ${geom.offsetY}px`,
          backgroundRepeat: "no-repeat",
          cursor: draggable && !locked ? "grab" : "default",
        }}
      />
    );
  }

  const photoZone = (
    <div
      key="photo"
      ref={bottomZoneRef}
      className={`relative flex min-h-0 min-w-0 flex-1 select-none touch-none gap-px bg-surface-2 ${
        collageLayoutId === "duo-v" ? "flex-col" : "flex-row"
      }`}
    >
      {isDuo ? (
        <>
          <div className="relative min-h-0 min-w-0 flex-1">
            {photoPane(imageUrl, displayImageUrl, geometry, false, onRequestUpload, onFilesDropped, uploadError, true)}
          </div>
          <div className="relative min-h-0 min-w-0 flex-1">
            {photoPane(imageUrl2, displayImageUrl2, geometry2, false, onRequestUpload2, onFilesDropped2, uploadError2, false)}
          </div>
        </>
      ) : (
        photoPane(imageUrl, displayImageUrl, geometry, true, onRequestUpload, onFilesDropped, uploadError, true)
      )}
      {imageUrl &&
        cutouts.map((cutout) => (
          // A die-cut sticker, not a flat paint swatch: a white "cut line"
          // (an identically-clipped layer a few px larger, so it reads as a
          // uniform-width edge for any of the shape set) plus a drop-shadow
          // that -- unlike box-shadow -- follows the clip-path's actual
          // silhouette instead of the square bounding box, giving it a
          // printed/peeled-sticker lift off the photo. This is what makes a
          // cutout read as a deliberate sticker at a glance rather than a
          // stray colored speck, which matters even more once the photo
          // zone is a full-bleed collage with nothing else to anchor it to.
          <div
            key={cutout.id}
            data-cutout-id={cutout.id}
            onPointerDown={(e) => handlePointerDown(e, cutout)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute"
            style={{
              left: `${cutout.xPct}%`,
              top: `${cutout.yPct}%`,
              width: squareSizePx,
              height: squareSizePx,
              cursor: locked ? "default" : "grab",
            }}
          >
            <div
              className="absolute"
              style={{
                inset: -STICKER_BORDER_FRACTION * squareSizePx,
                backgroundColor: "#ffffff",
                clipPath: shape.clipPath,
                filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.4))",
              }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: cutout.color ?? topBgColor, clipPath: shape.clipPath }}
            />
          </div>
        ))}
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

  if (fullBleed) {
    return (
      <div ref={canvasRef} className="relative flex h-full w-full overflow-hidden" style={{ backgroundColor: topBgColor }}>
        {photoZone}
        {grainOverlay}
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className={`relative flex h-full w-full overflow-hidden ${isRow ? "flex-row" : "flex-col"}`}
      style={{ backgroundColor: topBgColor }}
    >
      {textFirst ? [textZone, photoZone] : [photoZone, textZone]}
      {grainOverlay}
    </div>
  );
}
