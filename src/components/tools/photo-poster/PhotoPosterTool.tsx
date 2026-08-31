"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, generatePoeticCaption, SHAPE_OPTIONS } from "./constants";
import { CanvasSizeStep } from "./CanvasSizeStep";
import { ControlPanel } from "./ControlPanel";
import { renderPosterToCanvas } from "./exportPoster";
import { PosterPreview } from "./PosterPreview";
import type { BracketStyleId, CanvasPreset, Cutout, FontOptionId, ShapeId } from "./types";
import { randomizeCutouts, resetCutoutColors, resizeCutouts, setCutoutColor, wordCountOf } from "./useCutoutLayout";

const DEFAULT_CUTOUT_COUNT = 6;
const INITIAL_CAPTION = generatePoeticCaption();

export function PhotoPosterTool() {
  const [preset, setPreset] = useState<CanvasPreset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState(INITIAL_CAPTION);
  const [cutouts, setCutouts] = useState<Cutout[]>(() =>
    randomizeCutouts(DEFAULT_CUTOUT_COUNT, wordCountOf(INITIAL_CAPTION)),
  );
  const [locked, setLocked] = useState(false);
  const [shapeId, setShapeId] = useState<ShapeId>("square");
  const [scaleMultiplier, setScaleMultiplier] = useState(2);
  const [baseFontSizePx, setBaseFontSizePx] = useState(32);
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState(1.5);
  const [letterSpacingPx, setLetterSpacingPx] = useState(0);
  const [fontOptionId, setFontOptionId] = useState<FontOptionId>("sans");
  const [bracketId, setBracketId] = useState<BracketStyleId>("round-small");
  const [topBgColor, setTopBgColor] = useState("#15111f");
  const [textColor, setTextColor] = useState("#f5f3ff");
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // The preview frame is letterboxed by hand (rather than relying on CSS
  // aspect-ratio inside a shrinking flex item, which resolves
  // inconsistently once max-width/max-height both start constraining it)
  // -- measure the available box and compute an exact pixel size that
  // preserves the poster's aspect ratio, same ResizeObserver pattern
  // PosterPreview already uses for its own bottom-zone measurement.
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setWrapSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A new photo has different dimensions, so any previous pan/zoom picked
  // for the old photo's "slack" no longer means anything -- reset to
  // centered and unzoomed.
  const handleImageChange = useCallback((url: string) => {
    setImageUrl(url);
    setPan({ x: 0.5, y: 0.5 });
    setZoom(1);
  }, []);

  const handleCutoutCountChange = useCallback(
    (n: number) => {
      setCutouts((prev) => resizeCutouts(prev, n, wordCountOf(caption)));
    },
    [caption],
  );

  // Re-rolls both the photo position *and* which word in the caption each
  // cutout's thumbnail lands after -- the user types their own caption, so
  // this is the one "shuffle the cutouts" action rather than two separate
  // randomizers. Per-cutout color overrides are preserved (see
  // randomizeCutouts) since this is about placement, not color choices.
  const handleRandomize = useCallback(() => {
    setCutouts((prev) => randomizeCutouts(prev.length, wordCountOf(caption), prev));
  }, [caption]);

  const handleCutoutColorChange = useCallback((id: string, color: string) => {
    setCutouts((prev) => setCutoutColor(prev, id, color));
  }, []);

  const handleResetCutoutColors = useCallback(() => {
    setCutouts((prev) => resetCutoutColors(prev));
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current || !preset || !imageUrl) return;
    setExporting(true);
    try {
      const previewWidthPx = canvasRef.current.getBoundingClientRect().width;
      const topZoneEl = canvasRef.current.querySelector<HTMLElement>('[data-role="top-zone"]');
      const fontOption = FONT_OPTIONS.find((f) => f.id === fontOptionId)!;
      await document.fonts.ready;
      const fontFamily = topZoneEl ? getComputedStyle(topZoneEl).fontFamily : fontOption.fallback;
      const bracket = BRACKET_OPTIONS.find((b) => b.id === bracketId)!;
      const shape = SHAPE_OPTIONS.find((s) => s.id === shapeId)!;

      const posterCanvas = await renderPosterToCanvas({
        width: preset.width,
        height: preset.height,
        imageUrl,
        caption,
        cutouts,
        shape,
        bracket,
        topBgColor,
        textColor,
        baseFontSizePx,
        lineHeightMultiplier,
        letterSpacingPx,
        squareSizePx: baseFontSizePx * scaleMultiplier,
        fontFamily,
        previewWidthPx,
        pan,
        zoom,
      });

      const blob = await new Promise<Blob | null>((resolve) => posterCanvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "photo-poster.png";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [
    preset,
    imageUrl,
    caption,
    cutouts,
    shapeId,
    bracketId,
    fontOptionId,
    topBgColor,
    textColor,
    baseFontSizePx,
    lineHeightMultiplier,
    letterSpacingPx,
    scaleMultiplier,
    pan,
    zoom,
  ]);

  if (!preset) {
    return <CanvasSizeStep onSelect={setPreset} />;
  }

  const fontOption = FONT_OPTIONS.find((f) => f.id === fontOptionId)!;
  const bracket = BRACKET_OPTIONS.find((b) => b.id === bracketId)!;
  const shape = SHAPE_OPTIONS.find((s) => s.id === shapeId)!;
  const squareSizePx = baseFontSizePx * scaleMultiplier;

  // Fit the poster's true aspect ratio inside whatever box the ResizeObserver
  // measured, capped on whichever axis is tighter. Falls back to a
  // CSS-only aspect-ratio box (visible immediately, before the first
  // measurement lands) so there's no blank flash on mount.
  const posterAR = preset.width / preset.height;
  let frameStyle: React.CSSProperties;
  if (wrapSize.w > 0 && wrapSize.h > 0) {
    let frameW = wrapSize.w;
    let frameH = frameW / posterAR;
    if (frameH > wrapSize.h) {
      frameH = wrapSize.h;
      frameW = frameH * posterAR;
    }
    frameStyle = { width: frameW, height: frameH };
  } else {
    frameStyle = { width: "100%", maxHeight: "100%", aspectRatio: `${preset.width} / ${preset.height}` };
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={previewWrapRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div style={frameStyle} className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <PosterPreview
            canvasRef={canvasRef}
            imageUrl={imageUrl}
            caption={caption}
            cutouts={cutouts}
            onCutoutsChange={setCutouts}
            locked={locked}
            squareSizePx={squareSizePx}
            baseFontSizePx={baseFontSizePx}
            lineHeightMultiplier={lineHeightMultiplier}
            letterSpacingPx={letterSpacingPx}
            fontOption={fontOption}
            bracket={bracket}
            shape={shape}
            topBgColor={topBgColor}
            textColor={textColor}
            pan={pan}
            onPanChange={setPan}
            zoom={zoom}
          />
        </div>
      </div>

      <div className="flex min-h-0 shrink-0 flex-col border-t border-line bg-surface" style={{ maxHeight: "52dvh" }}>
        <ControlPanel
          preset={preset}
          onChangeSize={() => setPreset(null)}
          imageUrl={imageUrl}
          onImageChange={handleImageChange}
          zoom={zoom}
          onZoomChange={setZoom}
          caption={caption}
          onCaptionChange={setCaption}
          onRegenerateCaption={() => setCaption(generatePoeticCaption())}
          cutouts={cutouts}
          onCutoutCountChange={handleCutoutCountChange}
          onCutoutColorChange={handleCutoutColorChange}
          onResetCutoutColors={handleResetCutoutColors}
          shapeId={shapeId}
          onShapeChange={setShapeId}
          scaleMultiplier={scaleMultiplier}
          onScaleChange={setScaleMultiplier}
          baseFontSizePx={baseFontSizePx}
          onFontSizeChange={setBaseFontSizePx}
          lineHeightMultiplier={lineHeightMultiplier}
          onLineHeightChange={setLineHeightMultiplier}
          letterSpacingPx={letterSpacingPx}
          onLetterSpacingChange={setLetterSpacingPx}
          locked={locked}
          onToggleLocked={() => setLocked((v) => !v)}
          onRandomize={handleRandomize}
          fontOptionId={fontOptionId}
          onFontOptionChange={setFontOptionId}
          bracketId={bracketId}
          onBracketChange={setBracketId}
          topBgColor={topBgColor}
          onTopBgColorChange={setTopBgColor}
          textColor={textColor}
          onTextColorChange={setTextColor}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>
    </div>
  );
}

export function PhotoPosterHeader() {
  return (
    <div className="flex h-11 shrink-0 items-center border-b border-line bg-surface px-4">
      <span
        className="bg-clip-text text-sm font-semibold tracking-wide text-transparent y2k-gradient"
      >
        相片海報產生器
      </span>
    </div>
  );
}
