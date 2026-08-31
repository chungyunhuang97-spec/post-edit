"use client";

import { useCallback, useRef, useState } from "react";
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
  const [topBgColor, setTopBgColor] = useState("#ebebeb");
  const [textColor, setTextColor] = useState("#111111");
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:items-start">
      {/* order-2/order-1: on mobile the poster preview shows first so
          people see their result immediately, instead of scrolling past
          the whole (long) settings panel first; desktop keeps the
          familiar controls-left/preview-right split. */}
      <div className="order-2 w-full lg:order-1 lg:w-80 lg:flex-shrink-0">
        <ControlPanel
          preset={preset}
          onChangeSize={() => setPreset(null)}
          imageUrl={imageUrl}
          onImageChange={handleImageChange}
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
          zoom={zoom}
          onZoomChange={setZoom}
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

      <div className="order-1 mx-auto w-full max-w-md lg:order-2">
        <PosterPreview
          canvasRef={canvasRef}
          width={preset.width}
          height={preset.height}
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
        <p className="mt-3 text-center text-xs text-ink-faint">
          畫布解析度：{preset.width} × {preset.height} · 拖曳方塊調整挖空 · 拖曳照片本身調整顯示範圍
        </p>
      </div>
    </div>
  );
}

export function PhotoPosterHeader() {
  return (
    <div className="border-b border-line bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <span className="text-sm font-medium text-ink">相片海報產生器</span>
      </div>
    </div>
  );
}
