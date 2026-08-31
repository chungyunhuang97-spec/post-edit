"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TOP_ZONE_FRACTION } from "./constants";
import type { BracketOption, Cutout, FontOption, ShapeOption } from "./types";
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

export interface PosterPreviewProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
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
}

export function PosterPreview({
  canvasRef,
  width,
  height,
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
}: PosterPreviewProps) {
  const bottomZoneRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
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
      backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
      backgroundColor: imageUrl ? undefined : "#d4d4d8",
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

  return (
    <div
      ref={canvasRef}
      className="flex w-full flex-col overflow-hidden shadow-sm"
      style={{ aspectRatio: `${width} / ${height}`, backgroundColor: topBgColor }}
    >
      {/* Top zone: poetic caption with inline cropped-photo thumbnails.
          Always exactly TOP_ZONE_FRACTION of the canvas -- a fixed
          half-and-half split with the photo zone, regardless of caption
          length -- a short caption is centered within its half rather
          than shrinking the zone; overflow:hidden protects against an
          exceptionally long one growing it (which would otherwise
          squeeze the photo zone toward zero on a narrow phone screen,
          where the fixed-px font size takes up proportionally more of
          the box than on desktop). Mirrored in exportPoster.ts so the
          two never disagree. */}
      <div
        data-role="top-zone"
        className="flex flex-shrink-0 flex-wrap content-center items-center justify-center gap-x-1 gap-y-2 overflow-hidden px-[6%] py-[7%]"
        style={{
          color: textColor,
          fontFamily: `${fontOption.cssVar}, ${fontOption.fallback}`,
          fontSize: baseFontSizePx,
          lineHeight: lineHeightMultiplier,
          letterSpacing: `${letterSpacingPx}px`,
          height: `${TOP_ZONE_FRACTION * 100}%`,
        }}
      >
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

      {/* Bottom zone: the source photo with draggable cutout windows */}
      <div ref={bottomZoneRef} className="relative min-h-0 flex-1 select-none touch-none bg-neutral-200">
        {imageUrl ? (
          <div
            onPointerDown={handlePhotoPointerDown}
            onPointerMove={handlePhotoPointerMove}
            onPointerUp={handlePhotoPointerUp}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${geometry.renderedW}px ${geometry.renderedH}px`,
              backgroundPosition: `${geometry.offsetX}px ${geometry.offsetY}px`,
              backgroundRepeat: "no-repeat",
              cursor: locked ? "default" : "grab",
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
            尚未上傳照片
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
              className="absolute shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
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
      </div>
    </div>
  );
}
