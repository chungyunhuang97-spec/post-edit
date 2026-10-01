"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, SHAPE_OPTIONS, generateSocialCaption } from "./constants";
import { CanvasSizeStep } from "./CanvasSizeStep";
import { ToolPanel, ToolRail, type TabId } from "./ControlPanel";
import { renderPosterToCanvas } from "./exportPoster";
import { loadUploadedImage } from "./imageUpload";
import { analyzePhotoMood } from "./photoMood";
import { PosterPreview } from "./PosterPreview";
import { segmentSubject, type SubjectMask } from "./subjectSegmentation";
import type {
  BracketStyleId,
  CanvasPreset,
  CollageLayoutId,
  Cutout,
  FontOptionId,
  PosterLayoutId,
  ShapeId,
  StickerStyleId,
  StylePreset,
} from "./types";
import { randomizeCutouts, resetCutoutColors, resizeCutouts, setCutoutColor, wordCountOf } from "./useCutoutLayout";

const DEFAULT_CUTOUT_COUNT = 6;
const INITIAL_CAPTION = generateSocialCaption("neutral");
const DEFAULT_CAPTION_BG = "#15111f";
const DEFAULT_TEXT_COLOR = "#f5f3ff";

export function PhotoPosterTool() {
  const [preset, setPreset] = useState<CanvasPreset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Second photo + its own upload error, only meaningful once collageLayout
  // is a "duo-*" arrangement -- kept as a sibling of imageUrl rather than
  // generalizing to an array so the existing single-photo path (still the
  // overwhelmingly common case) stays untouched.
  const [imageUrl2, setImageUrl2] = useState<string | null>(null);
  const [uploadError2, setUploadError2] = useState<string | null>(null);
  const [collageLayoutId, setCollageLayoutId] = useState<CollageLayoutId>("single");
  // Whether the caption renders at all. In collage mode this is the whole
  // point (photos fill the canvas; the caption is an optional band pressed
  // on top of them, not a separate reserved zone) but it's a plain toggle
  // in single mode too rather than something gated behind collage.
  const [captionEnabled, setCaptionEnabled] = useState(true);
  const [caption, setCaption] = useState(INITIAL_CAPTION);
  const [cutouts, setCutouts] = useState<Cutout[]>(() =>
    randomizeCutouts(DEFAULT_CUTOUT_COUNT, wordCountOf(INITIAL_CAPTION)),
  );
  const [locked, setLocked] = useState(false);
  const [shapeId, setShapeId] = useState<ShapeId>("square");
  const [stickerStyleId, setStickerStyleId] = useState<StickerStyleId>("die-cut");
  const [scaleMultiplier, setScaleMultiplier] = useState(0.5);
  const [baseFontSizePx, setBaseFontSizePx] = useState(16);
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState(1.5);
  const [letterSpacingPx, setLetterSpacingPx] = useState(0);
  const [fontOptionId, setFontOptionId] = useState<FontOptionId>("sans");
  const [bracketId, setBracketId] = useState<BracketStyleId>("round-small");
  // Which tool's adjustment panel is open under the canvas (null = closed,
  // canvas gets the full height).
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  // Independent colors, each named for what it actually paints, so none of
  // them silently drives something unrelated when the layout changes (e.g.
  // in a two-photo collage there's no "top zone", and the caption band
  // color used to double as the default sticker color).
  const [captionBgColor, setCaptionBgColor] = useState(DEFAULT_CAPTION_BG);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [stickerColor, setStickerColor] = useState(DEFAULT_CAPTION_BG);
  const [duotoneDark, setDuotoneDark] = useState(DEFAULT_CAPTION_BG);
  const [duotoneLight, setDuotoneLight] = useState(DEFAULT_TEXT_COLOR);
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
  const fileInputRef2 = useRef<HTMLInputElement>(null);
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
      if (!file) return;
      const result = await loadUploadedImage(file);
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }
      setUploadError(null);
      handleImageChange(result.url);
    },
    [handleImageChange],
  );

  const handleRequestUpload2 = useCallback(() => fileInputRef2.current?.click(), []);

  const handleFileList2 = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const result = await loadUploadedImage(file);
    if ("error" in result) {
      setUploadError2(result.error);
      return;
    }
    setUploadError2(null);
    setImageUrl2(result.url);
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      // In a two-photo layout, pasting fills the second slot once the
      // first is taken, rather than always replacing photo 1.
      const intoSecond = collageLayoutId !== "single" && !!imageUrl && !imageUrl2;
      loadUploadedImage(file).then((result) => {
        if ("error" in result) {
          (intoSecond ? setUploadError2 : setUploadError)(result.error);
          return;
        }
        if (intoSecond) {
          setUploadError2(null);
          setImageUrl2(result.url);
        } else {
          setUploadError(null);
          handleImageChange(result.url);
        }
      });
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleImageChange, collageLayoutId, imageUrl, imageUrl2]);

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

  // With 2 photos already filling the whole photo zone, the 4 "split"
  // layouts (a dedicated, separately-colored caption block beside/above the
  // photo) stop making sense -- the mental model becomes "photo(s) fill the
  // canvas, caption is an optional band on top of them", which is exactly
  // what the two overlay layouts already are. So entering collage mode from
  // one of the 4 split layouts snaps to overlay-h; leaving collage mode
  // doesn't touch it back, since overlay still works fine for a single photo.
  const handleCollageLayoutChange = useCallback(
    (id: CollageLayoutId) => {
      setCollageLayoutId(id);
      if (id !== "single") {
        setLayout((prev) => (prev === "overlay-h" || prev === "overlay-v" ? prev : "overlay-h"));
        // The default scale was tuned for a sticker sitting inline within a
        // line of caption text -- against two full-bleed photos with no
        // caption at all, that same size reads as a stray, broken-looking
        // speck rather than a deliberate sticker. Bump it up (once, only
        // while still at/under that original default) so a fresh collage
        // starts out legible; a user who already sized it up keeps their
        // choice.
        setScaleMultiplier((prev) => (prev <= 0.5 ? 1.4 : prev));
      }
    },
    [],
  );

  // Applies a full named look in one go -- every field a style preset
  // covers is overwritten (including a fresh cutout scatter/count, so the
  // poster visibly reshuffles rather than just recoloring), while the
  // caption text, photo, and pan/zoom the user already set are left alone.
  const handleApplyStylePreset = useCallback(
    (preset: StylePreset) => {
      setShapeId(preset.shapeId);
      setBracketId(preset.bracketId);
      setFontOptionId(preset.fontOptionId);
      // Two-photo layouts only support the overlay arrangements, so a
      // preset's split layout would leave no option selected.
      setLayout((prev) => (collageLayoutId === "single" || preset.layout.startsWith("overlay") ? preset.layout : prev));
      setCaptionBgColor(preset.captionBgColor);
      setTextColor(preset.textColor);
      setStickerColor(preset.captionBgColor);
      setDuotoneDark(preset.captionBgColor);
      setDuotoneLight(preset.textColor);
      setScaleMultiplier(preset.scaleMultiplier);
      setBaseFontSizePx(preset.baseFontSizePx);
      setLineHeightMultiplier(preset.lineHeightMultiplier);
      setLetterSpacingPx(preset.letterSpacingPx);
      setDuotoneEnabled(preset.duotoneEnabled);
      setGrainEnabled(preset.grainEnabled);
      setGrainIntensity(preset.grainIntensity);
      setSubjectHalftoneEnabled(preset.subjectHalftoneEnabled ?? false);
      const fresh = randomizeCutouts(preset.cutoutCount, wordCountOf(caption));
      setCutouts(fresh.map((c, i) => ({ ...c, color: preset.palette ? preset.palette[i % preset.palette.length] : null })));
    },
    [caption, collageLayoutId],
  );

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
        imageUrl2,
        collageLayoutId,
        captionEnabled,
        caption,
        cutouts,
        shape,
        stickerStyleId,
        bracket,
        captionBgColor,
        textColor,
        stickerColor,
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
        duotoneDark,
        duotoneLight,
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
    imageUrl2,
    collageLayoutId,
    captionEnabled,
    caption,
    cutouts,
    shapeId,
    stickerStyleId,
    bracketId,
    fontOptionId,
    captionBgColor,
    textColor,
    stickerColor,
    baseFontSizePx,
    lineHeightMultiplier,
    letterSpacingPx,
    scaleMultiplier,
    pan,
    zoom,
    layout,
    duotoneEnabled,
    duotoneDark,
    duotoneLight,
    grainEnabled,
    grainIntensity,
    subjectHalftoneEnabled,
    subjectMask,
  ]);

  // Two-photo layouts need both slots filled; a missing one would export a
  // blank half. Clicking export then opens 版型 (where the slots are).
  const missingPhotos = !imageUrl || (collageLayoutId !== "single" && !imageUrl2);
  const handleExportClick = () => {
    if (missingPhotos) setActiveTab("layout");
    else void handleExport();
  };

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
    <div className="flex h-full min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => void handleFileList(e.target.files)}
      />
      <input
        ref={fileInputRef2}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => void handleFileList2(e.target.files)}
      />

      <ToolRail
        activeTab={activeTab}
        onSelect={setActiveTab}
        sizeLabel={`${preset.label} ${preset.width} × ${preset.height}`}
        onChangeSize={() => setPreset(null)}
        onExport={handleExportClick}
        exporting={exporting}
        missingPhotos={missingPhotos}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={previewWrapCallbackRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div
          style={frameStyle}
          className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        >
          <PosterPreview
            canvasRef={canvasRef}
            imageUrl={imageUrl}
            uploadError={uploadError}
            imageUrl2={imageUrl2}
            uploadError2={uploadError2}
            collageLayoutId={collageLayoutId}
            captionEnabled={captionEnabled}
            onRequestUpload2={handleRequestUpload2}
            onFilesDropped2={handleFileList2}
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
            stickerStyleId={stickerStyleId}
            captionBgColor={captionBgColor}
            textColor={textColor}
            stickerColor={stickerColor}
            pan={pan}
            onPanChange={setPan}
            zoom={zoom}
            layout={layout}
            duotoneEnabled={duotoneEnabled}
            duotoneDark={duotoneDark}
            duotoneLight={duotoneLight}
            grainEnabled={grainEnabled}
            grainIntensity={grainIntensity}
            subjectHalftoneEnabled={subjectHalftoneEnabled}
            subjectMask={subjectMask}
            onRequestUpload={handleRequestUpload}
            onFilesDropped={handleFileList}
          />
        </div>
      </div>

      {activeTab && (
        <div className="min-h-0 shrink-0 border-t border-line bg-surface" style={{ height: "max(36dvh, 220px)", maxHeight: "50dvh" }}>
          <ToolPanel
            activeTab={activeTab}
            onClose={() => setActiveTab(null)}
            onApplyStylePreset={handleApplyStylePreset}
            imageUrl={imageUrl}
            uploadError={uploadError}
            onRequestUpload={handleRequestUpload}
            imageUrl2={imageUrl2}
            uploadError2={uploadError2}
            onRequestUpload2={handleRequestUpload2}
            zoom={zoom}
            onZoomChange={setZoom}
            duotoneEnabled={duotoneEnabled}
            onDuotoneEnabledChange={setDuotoneEnabled}
            duotoneDark={duotoneDark}
            onDuotoneDarkChange={setDuotoneDark}
            duotoneLight={duotoneLight}
            onDuotoneLightChange={setDuotoneLight}
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
            stickerColor={stickerColor}
            onStickerColorChange={setStickerColor}
            shapeId={shapeId}
            onShapeChange={setShapeId}
            stickerStyleId={stickerStyleId}
            onStickerStyleChange={setStickerStyleId}
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
            captionBgColor={captionBgColor}
            onCaptionBgColorChange={setCaptionBgColor}
            textColor={textColor}
            onTextColorChange={setTextColor}
            layout={layout}
            onLayoutChange={setLayout}
            collageLayoutId={collageLayoutId}
            onCollageLayoutChange={handleCollageLayoutChange}
            captionEnabled={captionEnabled}
            onCaptionEnabledChange={setCaptionEnabled}
            subjectHalftoneEnabled={subjectHalftoneEnabled}
            onSubjectHalftoneEnabledChange={setSubjectHalftoneEnabled}
            subjectHalftoneStatus={subjectHalftoneStatus}
          />
        </div>
      )}
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
