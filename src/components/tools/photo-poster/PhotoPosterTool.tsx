"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, SHAPE_OPTIONS, generateSocialCaption } from "./constants";
import { CanvasSizeStep } from "./CanvasSizeStep";
import { ControlPanel } from "./ControlPanel";
import { renderPosterToCanvas } from "./exportPoster";
import { analyzePhotoMood } from "./photoMood";
import { PosterPreview } from "./PosterPreview";
import { segmentSubject, type SubjectMask } from "./subjectSegmentation";
import type { BracketStyleId, CanvasPreset, Cutout, FontOptionId, PosterLayoutId, ShapeId } from "./types";
import { randomizeCutouts, resetCutoutColors, resizeCutouts, setCutoutColor, wordCountOf } from "./useCutoutLayout";

const DEFAULT_CUTOUT_COUNT = 6;
const INITIAL_CAPTION = generateSocialCaption("neutral");

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [scaleMultiplier, setScaleMultiplier] = useState(0.5);
  const [baseFontSizePx, setBaseFontSizePx] = useState(16);
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState(1.5);
  const [letterSpacingPx, setLetterSpacingPx] = useState(0);
  const [fontOptionId, setFontOptionId] = useState<FontOptionId>("sans");
  const [bracketId, setBracketId] = useState<BracketStyleId>("round-small");
  const [topBgColor, setTopBgColor] = useState("#15111f");
  const [textColor, setTextColor] = useState("#f5f3ff");
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [layout, setLayout] = useState<PosterLayoutId>("text-top");
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  const [duotoneEnabled, setDuotoneEnabled] = useState(false);
  const [grainEnabled, setGrainEnabled] = useState(false);
  const [grainIntensity, setGrainIntensity] = useState(30);
  const [subjectHalftoneEnabled, setSubjectHalftoneEnabled] = useState(false);
  const [subjectMask, setSubjectMask] = useState<SubjectMask | null>(null);
  const [subjectHalftoneStatus, setSubjectHalftoneStatus] = useState<"idle" | "loading" | "ready" | "unavailable">(
    "idle",
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks which photo the current subjectMask (if any) was computed for,
  // so switching photos or re-enabling the toggle only re-runs the
  // (comparatively slow, model-download-gated) segmentation when it
  // actually needs to -- not on every unrelated re-render.
  const subjectMaskForUrlRef = useRef<string | null>(null);

  // The preview frame is letterboxed by hand: measure the available box and
  // compute an exact pixel size that preserves the poster's aspect ratio.
  // A pure-CSS attempt (grid place-items:center + aspect-ratio + auto-sized
  // max-width/max-height, no JS) broke for the two "overlay" layouts --
  // when the photo zone is the frame's *only* in-flow child and uses
  // flex-1 (flex-basis:0%), it contributes no positive size to the
  // ancestor's content-based aspect-ratio auto-sizing, collapsing the
  // whole chain to 0x0; the 4-zone-split layouts happened to avoid this
  // because their text zone (flex-shrink-0, flex-basis:auto) always
  // supplied a positive contribution. JS measurement sidesteps that CSS
  // auto-sizing edge case entirely. Attached via a *callback ref* (not
  // useRef+useEffect) since a plain effect only runs once right after the
  // very first commit -- and on that first commit `preset` is still null,
  // so this component takes the early `return <CanvasSizeStep />` branch
  // and the ref-bearing div doesn't exist yet, permanently missing it. A
  // callback ref instead fires exactly when the DOM node actually mounts.
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  const wrapObserverRef = useRef<ResizeObserver | null>(null);
  const previewWrapCallbackRef = useCallback((el: HTMLDivElement | null) => {
    wrapObserverRef.current?.disconnect();
    wrapObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setWrapSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    wrapObserverRef.current = observer;
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

  // Runs subject segmentation (a client-side ML model, see
  // subjectSegmentation.ts) only when the "主體網點" toggle is actually on
  // -- someone who never touches it never triggers the model download --
  // and only once per photo, since the result is reused by both the live
  // preview and the export rather than segmenting twice.
  useEffect(() => {
    if (!subjectHalftoneEnabled || !imageUrl) return;
    if (subjectMaskForUrlRef.current === imageUrl) return;
    subjectMaskForUrlRef.current = imageUrl;
    setSubjectMask(null);
    setSubjectHalftoneStatus("loading");
    let cancelled = false;
    segmentSubject(imageUrl).then((mask) => {
      if (cancelled || subjectMaskForUrlRef.current !== imageUrl) return;
      setSubjectMask(mask);
      setSubjectHalftoneStatus(mask ? "ready" : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [subjectHalftoneEnabled, imageUrl]);

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

  // Suggests a new caption in a casual, social-caption tone -- when a
  // photo is uploaded, a quick client-side canvas analysis (brightness /
  // warmth / saturation, no server or API key involved) picks a mood
  // bucket that steers word choice, so a bright warm photo and a dark
  // moody one don't get the same generic suggestion.
  const handleRegenerateCaption = useCallback(async () => {
    setSuggestingCaption(true);
    try {
      const mood = imageUrl ? await analyzePhotoMood(imageUrl) : "neutral";
      setCaption(generateSocialCaption(mood));
    } finally {
      setSuggestingCaption(false);
    }
  }, [imageUrl]);

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
        layout,
        duotoneEnabled,
        grainEnabled,
        grainIntensity,
        subjectHalftoneEnabled,
        subjectMask,
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
    layout,
    duotoneEnabled,
    grainEnabled,
    grainIntensity,
    subjectHalftoneEnabled,
    subjectMask,
  ]);

  if (!preset) {
    return <CanvasSizeStep onSelect={setPreset} />;
  }

  const fontOption = FONT_OPTIONS.find((f) => f.id === fontOptionId)!;
  const bracket = BRACKET_OPTIONS.find((b) => b.id === bracketId)!;
  const shape = SHAPE_OPTIONS.find((s) => s.id === shapeId)!;
  const squareSizePx = baseFontSizePx * scaleMultiplier;

  // Fit the poster's true aspect ratio inside whatever box the
  // ResizeObserver measured, capped on whichever axis is tighter. Falls
  // back to a modest fixed-ish CSS aspect-ratio box for the brief instant
  // before the first measurement lands (imperceptible in practice -- the
  // observer's first callback fires within the same frame).
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
    frameStyle = { width: "50vmin", aspectRatio: `${preset.width} / ${preset.height}` };
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

      <div ref={previewWrapCallbackRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div
          style={frameStyle}
          className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        >
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
            layout={layout}
            duotoneEnabled={duotoneEnabled}
            grainEnabled={grainEnabled}
            grainIntensity={grainIntensity}
            subjectHalftoneEnabled={subjectHalftoneEnabled}
            subjectMask={subjectMask}
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
          duotoneEnabled={duotoneEnabled}
          onDuotoneEnabledChange={setDuotoneEnabled}
          grainEnabled={grainEnabled}
          onGrainEnabledChange={setGrainEnabled}
          grainIntensity={grainIntensity}
          onGrainIntensityChange={setGrainIntensity}
          caption={caption}
          onCaptionChange={setCaption}
          onRegenerateCaption={handleRegenerateCaption}
          suggestingCaption={suggestingCaption}
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
          layout={layout}
          onLayoutChange={setLayout}
          subjectHalftoneEnabled={subjectHalftoneEnabled}
          onSubjectHalftoneEnabledChange={setSubjectHalftoneEnabled}
          subjectHalftoneStatus={subjectHalftoneStatus}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>
    </div>
  );
}

export function PhotoPosterHeader() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-center border-b border-line bg-surface px-4">
      <span className="text-sm font-normal tracking-wide text-accent" style={{ fontFamily: "var(--font-brand)" }}>
        BE4 THE POST
      </span>
    </div>
  );
}
