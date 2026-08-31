"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, LAYOUT_OPTIONS, generatePoeticCaption, SHAPE_OPTIONS } from "./constants";
import { CanvasSizeStep } from "./CanvasSizeStep";
import { ControlPanel } from "./ControlPanel";
import { renderPosterToCanvas } from "./exportPoster";
import { PosterPreview } from "./PosterPreview";
import type { BracketStyleId, CanvasPreset, Cutout, FontOptionId, LayoutModeId, PosterLayoutId, ShapeId } from "./types";
import { randomizeCutouts, resetCutoutColors, resizeCutouts, setCutoutColor, wordCountOf } from "./useCutoutLayout";

const DEFAULT_CUTOUT_COUNT = 6;
const INITIAL_CAPTION = generatePoeticCaption();

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pickRandomLayout(exclude?: PosterLayoutId): PosterLayoutId {
  const pool = LAYOUT_OPTIONS.map((l) => l.id).filter((id) => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? "text-top";
}

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
  const [layoutMode, setLayoutMode] = useState<LayoutModeId>("text-top");
  const [randomLayoutPick, setRandomLayoutPick] = useState<PosterLayoutId>(() => pickRandomLayout());

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Upload/paste/drag handling lives here (not in PosterPreview or
  // ControlPanel) since both need to trigger it: the empty photo zone in
  // the preview is itself the upload target, and the "照片" tab's
  // "變更照片" button re-opens the same file picker once an image exists.
  const handleRequestUpload = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileList = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (file && file.type.startsWith("image/")) {
        handleImageChange(await readFileAsDataUrl(file));
      }
    },
    [handleImageChange],
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) readFileAsDataUrl(file).then(handleImageChange);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleImageChange]);

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
  // When the layout picker is set to "random" this also re-rolls which
  // concrete arrangement is showing, so one button reshuffles the whole
  // look at once.
  const handleRandomize = useCallback(() => {
    setCutouts((prev) => randomizeCutouts(prev.length, wordCountOf(caption), prev));
    if (layoutMode === "random") {
      setRandomLayoutPick((prev) => pickRandomLayout(prev));
    }
  }, [caption, layoutMode]);

  const handleCutoutColorChange = useCallback((id: string, color: string) => {
    setCutouts((prev) => setCutoutColor(prev, id, color));
  }, []);

  const handleResetCutoutColors = useCallback(() => {
    setCutouts((prev) => resetCutoutColors(prev));
  }, []);

  const effectiveLayout: PosterLayoutId = layoutMode === "random" ? randomLayoutPick : layoutMode;

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
        layout: effectiveLayout,
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
    effectiveLayout,
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFileList(e.target.files)}
      />

      <div ref={previewWrapRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div style={frameStyle} className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
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
            layout={effectiveLayout}
            onRequestUpload={handleRequestUpload}
            onFilesDropped={handleFileList}
          />
        </div>
      </div>

      <div className="flex min-h-0 shrink-0 flex-col border-t border-line bg-surface" style={{ maxHeight: "52dvh" }}>
        <ControlPanel
          preset={preset}
          onChangeSize={() => setPreset(null)}
          imageUrl={imageUrl}
          onRequestUpload={handleRequestUpload}
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
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>
    </div>
  );
}

export function PhotoPosterHeader() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-start border-b border-line bg-surface px-4 lg:justify-center">
      <span className="text-sm font-normal tracking-wide text-accent" style={{ fontFamily: "var(--font-brand)" }}>
        be4-ㄉ-post
      </span>
    </div>
  );
}
