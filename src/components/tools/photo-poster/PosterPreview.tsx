"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import { applyDuotone } from "./duotone";
import { drawFilmGrain } from "./grain";
import { drawSubjectHalftone } from "./subjectHalftone";
import type { SubjectMask } from "./subjectSegmentation";
import type { BracketOption, Cutout, FontOption, PosterLayoutId, ShapeOption } from "./types";
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

export interface PosterPreviewProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  imageUrl: string | null;
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
  const bottomZoneRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [duotoneUrl, setDuotoneUrl] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const grainCanvasRef = useRef<HTMLCanvasElement>(null);
  const textZoneRef = useRef<HTMLDivElement>(null);
  const [textZoneSize, setTextZoneSize] = useState({ w: 0, h: 0 });
  const subjectHalftoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; originXPct: number; originYPct: number } | null>(
    null,
  );
  const panDragState = useRef<{ startX: number; startY: number; originPanX: number; originPanY: number } | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const el = bottomZoneRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setBoxSize({ w, h });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Recolors the photo into two tones (dark/light, reusing the existing
  // topBgColor/textColor pickers rather than adding new ones) whenever
  // duotone is on -- the resulting blob URL replaces the plain imageUrl
  // everywhere the photo is painted, below. Runs at a capped working
  // resolution since the live preview never needs full photo resolution.
  useEffect(() => {
    // No explicit "reset to null" here when disabled -- displayImageUrl
    // below already ignores duotoneUrl whenever duotoneEnabled is false, so
    // a stale (and by then already-revoked, via this same effect's own
    // cleanup on the *previous* run) URL sitting unused in state is
    // harmless, and re-enabling later just overwrites it with a fresh one.
    if (!duotoneEnabled || !imageUrl || !natural.w || !natural.h) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = applyDuotone(img, natural.w, natural.h, topBgColor, textColor, DUOTONE_PREVIEW_MAX_DIMENSION);
      canvas.toBlob((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setDuotoneUrl(objectUrl);
      });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [duotoneEnabled, imageUrl, natural.w, natural.h, topBgColor, textColor]);

  // Falls back to the plain photo while the duotone recolor is still being
  // computed (async, one extra frame or two) so toggling it on doesn't
  // flash the photo away for an instant.
  const displayImageUrl = duotoneEnabled ? (duotoneUrl ?? imageUrl) : imageUrl;

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

  useEffect(() => {
    const el = textZoneRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setTextZoneSize({ w, h });
    });
    observer.observe(el);
    return () => observer.disconnect();
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

  const geometry = computeCoverGeometry(boxSize.w, boxSize.h, natural.w, natural.h, pan, zoom);
  const squareXPct = boxSize.w ? (squareSizePx / boxSize.w) * 100 : 0;
  const squareYPct = boxSize.h ? (squareSizePx / boxSize.h) * 100 : 0;

  const tokens = buildCaptionTokens(caption, cutouts);
  const cutoutById = new Map(cutouts.map((c) => [c.id, c]));

  // Dragging the photo itself (not a cutout square) repositions which part
  // of it the "cover" crop shows -- separate from the cutout-square drag
  // above since it's attached to a different element (squares sit on top
  // and capture their own pointer events first, so there's no conflict).
  function handlePhotoPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (locked || !boxSize.w || !boxSize.h) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    panDragState.current = { startX: e.clientX, startY: e.clientY, originPanX: pan.x, originPanY: pan.y };
  }

  function handlePhotoPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragState.current;
    if (!drag) return;
    const slackX = geometry.renderedW - boxSize.w;
    const slackY = geometry.renderedH - boxSize.h;
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
    // xPct/yPct are relative to the *visible* box, not the full scaled
    // image. The box's own viewport starts `-offsetX`/`-offsetY` pixels
    // into the scaled image (offsetX/Y are <= 0, per computeCoverGeometry),
    // so that's the base to add the on-box pixel offset to, giving the
    // target point's position within the full scaled image.
    const left = -geometry.offsetX + (cutout.xPct / 100) * boxSize.w;
    const top = -geometry.offsetY + (cutout.yPct / 100) * boxSize.h;
    return {
      width: squareSizePx,
      height: squareSizePx,
      display: "inline-block",
      verticalAlign: "middle",
      backgroundImage: displayImageUrl ? `url(${displayImageUrl})` : undefined,
      backgroundColor: displayImageUrl ? undefined : "#d4d4d8",
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

  const photoZone = (
    <div
      key="photo"
      ref={bottomZoneRef}
      className="relative min-h-0 min-w-0 flex-1 select-none touch-none bg-surface-2"
    >
      {imageUrl ? (
        <div
          onPointerDown={handlePhotoPointerDown}
          onPointerMove={handlePhotoPointerMove}
          onPointerUp={handlePhotoPointerUp}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${displayImageUrl})`,
            backgroundSize: `${geometry.renderedW}px ${geometry.renderedH}px`,
            backgroundPosition: `${geometry.offsetX}px ${geometry.offsetY}px`,
            backgroundRepeat: "no-repeat",
            cursor: locked ? "default" : "grab",
          }}
        />
      ) : (
        <div
          onClick={onRequestUpload}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilesDropped(e.dataTransfer.files);
          }}
          className="absolute inset-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-center text-ink-faint transition hover:border-accent hover:text-accent"
        >
          <span className="text-sm font-medium">點擊上傳照片</span>
          <span className="text-xs">或拖曳圖片到此處，或 Ctrl/Cmd+V 貼上</span>
        </div>
      )}
      {imageUrl &&
        cutouts.map((cutout) => (
          <div
            key={cutout.id}
            data-cutout-id={cutout.id}
            onPointerDown={(e) => handlePointerDown(e, cutout)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute shadow-[0_0_0_1px_rgba(255,255,255,0.5),0_2px_10px_rgba(0,0,0,0.45)]"
            style={{
              left: `${cutout.xPct}%`,
              top: `${cutout.yPct}%`,
              width: squareSizePx,
              height: squareSizePx,
              backgroundColor: cutout.color ?? topBgColor,
              clipPath: shape.clipPath,
              cursor: locked ? "default" : "grab",
            }}
          />
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
      {isOverlay && textZone}
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

  if (isOverlay) {
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
