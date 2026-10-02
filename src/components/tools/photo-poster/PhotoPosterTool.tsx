"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, SHAPE_BASE_PX, SHAPE_OPTIONS, generateSocialCaption } from "./constants";
import { MAX_PHOTOS, photoCountOf } from "./collage";
import { assignTilePhotos, captionWords, makeDots, makeTiles, makeWordPositions } from "./decorLayout";
import { CanvasSizeStep } from "./CanvasSizeStep";
import { ToolPanel, ToolRail, type TabId } from "./ControlPanel";
import { renderPosterToCanvas } from "./exportPoster";
import { loadUploadedImage } from "./imageUpload";
import { analyzePhotoMood } from "./photoMood";
import { PosterPreview } from "./PosterPreview";
import { STYLE_PRESETS, buildStyleState } from "./stylePresets";
import { useStyleThumbnails } from "./styleThumbnails";
import { useSubjectMask, type MaskStatus } from "./useSubjectMask";
import { zoneAspectOf } from "./zones";
import type {
  BracketStyleId,
  CanvasPreset,
  CollageLayoutId,
  Cutout,
  DecorState,
  Dot,
  FontOptionId,
  PosterLayoutId,
  ShapeId,
  StickerStyleId,
  StylePreset,
  Tile,
  WordPos,
} from "./types";
import { ALL_FEATURES, DEFAULT_DECOR } from "./types";
import { randomizeCutouts, resetCutoutColors, resizeCutouts, setCutoutColor, wordCountOf } from "./useCutoutLayout";

const DEFAULT_CUTOUT_COUNT = 6;
// Phone bottom sheet height, as % of the screen height: the default, the
// limits the handle can drag between (so neither the poster nor the
// controls can be squeezed out), and where the chosen height is remembered.
const SHEET_DEFAULT = 44;
const SHEET_MIN = 24;
const SHEET_MAX = 72;
const SHEET_STORAGE_KEY = "photo-poster.sheetHeight";

/** The settings that make up "a style", reduced to one comparable string:
 * used to tell whether the applied style has been tweaked since. Things
 * that are placement or randomness (positions, which cutout lands where,
 * the pasted subject's spot) are left out on purpose. */
function styleSnapshot(v: {
  shapeId: string;
  bracketId: string;
  fontOptionId: string;
  layout: string;
  captionBgColor: string;
  textColor: string;
  stickerColor: string;
  scaleMultiplier: number;
  baseFontSizePx: number;
  lineHeightMultiplier: number;
  letterSpacingPx: number;
  grainEnabled: boolean;
  grainIntensity: number;
  stickerStyleId: string;
  shapesEnabled: boolean;
  captionEnabled: boolean;
  decor: DecorState;
  cutoutCount: number;
  tileCount: number;
  dotCount: number;
}): string {
  const { subjectPasteX, subjectPasteY, ...decorRest } = v.decor;
  void subjectPasteX;
  void subjectPasteY;
  return JSON.stringify({ ...v, decor: decorRest });
}

function readStoredSheetHeight(): number {
  try {
    const v = Number(window.localStorage.getItem(SHEET_STORAGE_KEY));
    return v >= SHEET_MIN && v <= SHEET_MAX ? v : SHEET_DEFAULT;
  } catch {
    return SHEET_DEFAULT;
  }
}
// Where freshly generated free-placed layers land, in % of the poster.
const TILE_REGION = { x0: 8, y0: 10, x1: 92, y1: 90 };
const DOT_REGION = { x0: 5, y0: 5, x1: 95, y1: 95 };
const WORD_REGION = { x0: 12, y0: 15, x1: 88, y1: 85 };
const INITIAL_CAPTION = generateSocialCaption("neutral");
const DEFAULT_CAPTION_BG = "#15111f";
const DEFAULT_TEXT_COLOR = "#f5f3ff";

export function PhotoPosterTool() {
  const [preset, setPreset] = useState<CanvasPreset | null>(null);
  const canvasAspect = preset ? preset.width / preset.height : 0.8;
  // One entry per photo slot (up to MAX_PHOTOS); only the first
  // photoCountOf(collageLayoutId) slots are shown.
  const [imageUrls, setImageUrls] = useState<(string | null)[]>(() => Array(MAX_PHOTOS).fill(null));
  const [uploadErrors, setUploadErrors] = useState<(string | null)[]>(() => Array(MAX_PHOTOS).fill(null));
  const imageUrl = imageUrls[0];
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
  // Master switch for the cutout shapes. Off just hides them (preview,
  // caption thumbnails and export) -- the cutout list itself is kept so
  // turning it back on restores the same arrangement.
  const [shapesEnabled, setShapesEnabled] = useState(true);
  const [shapeId, setShapeId] = useState<ShapeId>("square");
  const [stickerStyleId, setStickerStyleId] = useState<StickerStyleId>("flat");
  const [scaleMultiplier, setScaleMultiplier] = useState(0.5);
  const [baseFontSizePx, setBaseFontSizePx] = useState(16);
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState(1.5);
  const [letterSpacingPx, setLetterSpacingPx] = useState(0);
  const [fontOptionId, setFontOptionId] = useState<FontOptionId>("sans");
  const [bracketId, setBracketId] = useState<BracketStyleId>("round-small");
  // Which tool's adjustment panel is open under the canvas (null = closed,
  // canvas gets the full height).
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [sheetHeight, setSheetHeight] = useState(() => (typeof window === "undefined" ? SHEET_DEFAULT : readStoredSheetHeight()));
  const sheetDrag = useRef<{ startY: number; startH: number } | null>(null);
  // Independent colors, each named for what it actually paints, so none of
  // them silently drives something unrelated when the layout changes (e.g.
  // in a two-photo collage there's no "top zone", and the caption band
  // color used to double as the default sticker color).
  const [captionBgColor, setCaptionBgColor] = useState(DEFAULT_CAPTION_BG);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [stickerColor, setStickerColor] = useState(DEFAULT_CAPTION_BG);
  const [pans, setPans] = useState(() => Array.from({ length: MAX_PHOTOS }, () => ({ x: 0.5, y: 0.5 })));
  const [zooms, setZooms] = useState<number[]>(() => Array(MAX_PHOTOS).fill(1));
  const [exporting, setExporting] = useState(false);
  const [layout, setLayout] = useState<PosterLayoutId>("text-top");
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  // Frame / caption mode / silhouette settings, plus the free-placed small
  // photos, dots and scattered words they drive (see DecorState).
  const [decor, setDecor] = useState<DecorState>(DEFAULT_DECOR);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [dots, setDots] = useState<Dot[]>([]);
  const [wordPositions, setWordPositions] = useState<WordPos[]>([]);
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null);
  // With a style applied, only the controls it uses are listed; this brings
  // every control back.
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  // What the applied style looked like when applied (see styleSnapshot).
  const [styleBaseline, setStyleBaseline] = useState<string | null>(null);
  const patchDecor = useCallback((patch: Partial<DecorState>) => setDecor((d) => ({ ...d, ...patch })), []);
  const [grainEnabled, setGrainEnabled] = useState(false);
  const [grainIntensity, setGrainIntensity] = useState(30);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSlotRef = useRef(0);

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

  // Small photos are sized against the caption zone's shape.
  const zoneAspect = zoneAspectOf(layout, decor.captionFraction, canvasAspect, captionEnabled);

  // How many of the current layout's slots hold a photo (at least 1, so the
  // small photos / styles always have something to draw from).
  const paneCount = photoCountOf(collageLayoutId);
  const photoCount = Math.max(1, imageUrls.slice(0, paneCount).filter(Boolean).length);

  // A new photo has different dimensions, so any previous pan/zoom picked
  // for the old photo's "slack" no longer means anything -- reset to
  // centered and unzoomed.
  const setSlotPhoto = useCallback(
    (slot: number, url: string) => {
      setImageUrls((prev) => prev.map((u, i) => (i === slot ? url : u)));
      setUploadErrors((prev) => prev.map((e, i) => (i === slot ? null : e)));
      setPans((prev) => prev.map((pn, i) => (i === slot ? { x: 0.5, y: 0.5 } : pn)));
      setZooms((prev) => prev.map((z, i) => (i === slot ? 1 : z)));
      // Every uploaded photo should show up in the small-photo layer too.
      if (slot > 0) {
        const filled = imageUrls.slice(0, photoCountOf(collageLayoutId)).filter(Boolean).length + (imageUrls[slot] ? 0 : 1);
        setTiles((prev) => assignTilePhotos(prev, Math.max(1, filled), zoneAspect, TILE_REGION));
      }
    },
    [imageUrls, collageLayoutId, zoneAspect],
  );

  // Upload/paste/drag handling lives here (not in PosterPreview or
  // ControlPanel) since both need to trigger it: each empty photo pane in
  // the preview is itself an upload target, and the 版型 tab's slots
  // re-open the same file picker.
  const handleRequestUpload = useCallback((slot: number) => {
    uploadSlotRef.current = slot;
    fileInputRef.current?.click();
  }, []);

  const handleFileList = useCallback(
    async (slot: number, files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const result = await loadUploadedImage(file);
      if ("error" in result) {
        setUploadErrors((prev) => prev.map((e, i) => (i === slot ? result.error : e)));
        return;
      }
      setSlotPhoto(slot, result.url);
    },
    [setSlotPhoto],
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      // Pasting fills the first empty slot of the current layout, or
      // replaces photo 1 when they are all taken.
      const empty = imageUrls.slice(0, photoCountOf(collageLayoutId)).findIndex((u) => !u);
      const slot = empty >= 0 ? empty : 0;
      loadUploadedImage(file).then((result) => {
        if ("error" in result) {
          setUploadErrors((prev) => prev.map((er, i) => (i === slot ? result.error : er)));
          return;
        }
        setSlotPhoto(slot, result.url);
      });
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setSlotPhoto, collageLayoutId, imageUrls]);

  // Subject detection (a client-side ML model) runs only once a feature
  // that needs it is switched on, once per photo; the preview and the
  // export share the result.
  // Subject detection also serves the dot art when it only covers the subject (or only the background).
  const sil = decor.silhouetteEnabled || (decor.dotArtEnabled && decor.dotArtArea !== "all");
  const mask0 = useSubjectMask(paneCount > 0 ? imageUrls[0] : null, sil);
  const mask1 = useSubjectMask(paneCount > 1 ? imageUrls[1] : null, sil);
  const mask2 = useSubjectMask(paneCount > 2 ? imageUrls[2] : null, sil);
  const mask3 = useSubjectMask(paneCount > 3 ? imageUrls[3] : null, sil);
  const subjectMasks = useMemo(
    () => [mask0.mask, mask1.mask, mask2.mask, mask3.mask],
    [mask0.mask, mask1.mask, mask2.mask, mask3.mask],
  );
  const maskStatuses = [mask0.status, mask1.status, mask2.status, mask3.status];
  const maskStatus: MaskStatus = maskStatuses.includes("loading")
    ? "loading"
    : maskStatuses.includes("ready")
      ? "ready"
      : maskStatuses.includes("unavailable")
        ? "unavailable"
        : "idle";

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

  const handleCollageLayoutChange = useCallback((id: CollageLayoutId) => {
    setCollageLayoutId(id);
    setTiles((prev) =>
      assignTilePhotos(prev, Math.max(1, imageUrls.slice(0, photoCountOf(id)).filter(Boolean).length), zoneAspect, TILE_REGION),
    );
    if (id !== "single") {
      // The default scale was tuned for a sticker sitting inline within a
      // line of caption text -- against two full-bleed photos with no
      // caption at all, that same size reads as a stray, broken-looking
      // speck rather than a deliberate sticker. Bump it up (once, only
      // while still at/under that original default) so a fresh collage
      // starts out legible; a user who already sized it up keeps their
      // choice.
      setScaleMultiplier((prev) => (prev <= 0.5 ? 1.4 : prev));
    }
  }, [imageUrls, zoneAspect]);

  // Applies a full named look in one go -- every field a style preset
  // covers is overwritten (including a fresh cutout scatter/count, so the
  // poster visibly reshuffles rather than just recoloring), while the
  // caption text, photo, and pan/zoom the user already set are left alone.
  const handleApplyStylePreset = useCallback(
    (style: StylePreset) => {
      if (!preset) return;
      const st = buildStyleState(style, {
        caption,
        canvasAspect: preset.width / preset.height,
        photoCount,
      });
      setActiveStyleId(style.id);
      setStyleBaseline(
        styleSnapshot({
          shapeId: st.shapeId,
          bracketId: st.bracketId,
          fontOptionId: st.fontOptionId,
          layout: st.layout,
          captionBgColor: st.captionBgColor,
          textColor: st.textColor,
          stickerColor: st.stickerColor,
          scaleMultiplier: st.scaleMultiplier,
          baseFontSizePx: st.baseFontSizePx,
          lineHeightMultiplier: st.lineHeightMultiplier,
          letterSpacingPx: st.letterSpacingPx,
          grainEnabled: st.grainEnabled,
          grainIntensity: st.grainIntensity,
          stickerStyleId: st.stickerStyleId,
          shapesEnabled: st.shapesEnabled,
          captionEnabled: st.captionEnabled,
          decor: st.decor,
          cutoutCount: st.cutouts.length,
          tileCount: st.tiles.length,
          dotCount: st.dots.length,
        }),
      );
      setShapeId(st.shapeId);
      setBracketId(st.bracketId);
      setFontOptionId(st.fontOptionId);
      setLayout(st.layout);
      setCaptionBgColor(st.captionBgColor);
      setTextColor(st.textColor);
      setStickerColor(st.stickerColor);
      setScaleMultiplier(st.scaleMultiplier);
      setBaseFontSizePx(st.baseFontSizePx);
      setLineHeightMultiplier(st.lineHeightMultiplier);
      setLetterSpacingPx(st.letterSpacingPx);
      setGrainEnabled(st.grainEnabled);
      setGrainIntensity(st.grainIntensity);
      setStickerStyleId(st.stickerStyleId);
      setShapesEnabled(st.shapesEnabled);
      setCaptionEnabled(st.captionEnabled);
      setDecor(st.decor);
      setCutouts(st.cutouts);
      setTiles(st.tiles);
      setDots(st.dots);
      setWordPositions(st.wordPositions);
    },
    [caption, photoCount, preset],
  );

  // --- Free-placed layers (small photos, dots, scattered words). Turning a
  // layer on for the first time generates it; the count sliders keep what's
  // already placed and only add/remove the difference; "shuffle" re-rolls.

  const handleTilesEnabledChange = useCallback(
    (enabled: boolean) => {
      patchDecor({ tilesEnabled: enabled });
      if (enabled && tiles.length === 0) setTiles(makeTiles(4, TILE_REGION, zoneAspect, photoCount));
    },
     
    [tiles.length, zoneAspect, photoCount, patchDecor],
  );
  const handleTileCountChange = useCallback(
    (n: number) =>
      setTiles((prev) =>
        n <= prev.length ? prev.slice(0, n) : [...prev, ...makeTiles(n - prev.length, TILE_REGION, zoneAspect, photoCount)],
      ),
     
    [zoneAspect, photoCount],
  );
  // k = how many times tighter than "half the photo" each small photo crops.
  const handleTileZoomChange = useCallback(
    (k: number) => setTiles((prev) => prev.map((t) => ({ ...t, s: Math.min(0.95, 0.5 / k) }))),
    [],
  );
  const handleTileChange = useCallback(
    (id: string, patch: Partial<Tile>) => setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  );
  const handleShuffleTiles = useCallback(
    () => setTiles((prev) => makeTiles(prev.length, TILE_REGION, zoneAspect, photoCount)),
     
    [zoneAspect, photoCount],
  );

  const handleDotsEnabledChange = useCallback(
    (enabled: boolean) => {
      patchDecor({ dotsEnabled: enabled });
      if (enabled && dots.length === 0) setDots(makeDots(5, DOT_REGION, ["#f4b400", "#1a56db", "#d9381e", "#188038"]));
    },
     
    [dots.length, patchDecor],
  );
  const handleDotCountChange = useCallback(
    (n: number) =>
      setDots((prev) =>
        n <= prev.length
          ? prev.slice(0, n)
          : [...prev, ...makeDots(n - prev.length, DOT_REGION, ["#f4b400", "#1a56db", "#d9381e", "#188038"])],
      ),
     
    [],
  );
  const handleShuffleDots = useCallback(
    () =>
      setDots((prev) =>
        makeDots(prev.length, DOT_REGION, prev.length ? [...new Set(prev.map((d) => d.color))] : ["#1a56db"]).map((d, i) => ({
          ...d,
          color: prev[i]?.color ?? d.color,
        })),
      ),
     
    [],
  );
  const handleDotColorChange = useCallback(
    (id: string, color: string) => setDots((prev) => prev.map((d) => (d.id === id ? { ...d, color } : d))),
    [],
  );
  const handleShuffleWords = useCallback(
    () => setWordPositions(makeWordPositions(captionWords(caption).length, WORD_REGION)),
     
    [caption],
  );

  // Scatter mode needs an anchor per word: top up (keeping existing
  // positions) whenever the mode is switched on or the caption gains words.
  const ensureWordPositions = useCallback((count: number) => {
    setWordPositions((prev) =>
      prev.length >= count ? prev : [...prev, ...makeWordPositions(count - prev.length, WORD_REGION)],
    );
     
  }, []);
  const activeStyle = STYLE_PRESETS.find((p) => p.id === activeStyleId) ?? null;
  const features = activeStyle && !showAllFeatures ? activeStyle.features : ALL_FEATURES;
  // 剪影填色 is one color story: frame, silhouette and caption block follow
  // a single "主色" so they can't drift apart.
  const styleDirty =
    !!activeStyle &&
    styleBaseline !== null &&
    styleBaseline !==
      styleSnapshot({
        shapeId,
        bracketId,
        fontOptionId,
        layout,
        captionBgColor,
        textColor,
        stickerColor,
        scaleMultiplier,
        baseFontSizePx,
        lineHeightMultiplier,
        letterSpacingPx,
        grainEnabled,
        grainIntensity,
        stickerStyleId,
        shapesEnabled,
        captionEnabled,
        decor,
        cutoutCount: cutouts.length,
        tileCount: tiles.length,
        dotCount: dots.length,
      });
  const linkedColor = activeStyle?.linkedColors === "frame" && !showAllFeatures;
  // 挖空色塊: the shapes are the same colour as the block they cut through.
  const stickerLinked = activeStyle?.linkedColors === "sticker" && !showAllFeatures;
  const handleDecorChange = useCallback(
    (patch: Partial<DecorState>) => {
      let next = patch;
      if (linkedColor && patch.frameColor) {
        next = { ...patch, silhouetteColor: patch.frameColor };
        setCaptionBgColor(patch.frameColor);
      }
      patchDecor(next);
      if (patch.captionMode === "scatter") ensureWordPositions(captionWords(caption).length);
    },
    [patchDecor, ensureWordPositions, caption, linkedColor],
  );
  const handleCaptionBgChange = useCallback(
    (hex: string) => {
      setCaptionBgColor(hex);
      if (stickerLinked) setStickerColor(hex);
    },
    [stickerLinked],
  );
  const handleCaptionChange = useCallback(
    (text: string) => {
      setCaption(text);
      if (decor.captionMode === "scatter") ensureWordPositions(captionWords(text).length);
    },
    [decor.captionMode, ensureWordPositions],
  );

  const styleThumbs = useStyleThumbnails(activeTab === "style");

  // Suggests a new caption in a casual, social-caption tone -- when a
  // photo is uploaded, a quick client-side canvas analysis (brightness /
  // warmth / saturation, no server or API key involved) picks a mood
  // bucket that steers word choice, so a bright warm photo and a dark
  // moody one don't get the same generic suggestion.
  const handleRegenerateCaption = useCallback(async () => {
    setSuggestingCaption(true);
    try {
      const mood = imageUrl ? await analyzePhotoMood(imageUrl) : "neutral";
      const next = generateSocialCaption(mood);
      setCaption(next);
      if (decor.captionMode === "scatter") ensureWordPositions(captionWords(next).length);
    } finally {
      setSuggestingCaption(false);
    }
  }, [imageUrl, decor.captionMode, ensureWordPositions]);

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
        imageUrls: imageUrls.slice(0, paneCount),
        collageLayoutId,
        captionEnabled,
        caption,
        cutouts: shapesEnabled ? cutouts : [],
        shape,
        stickerStyleId,
        bracket,
        captionBgColor,
        textColor,
        stickerColor,
        baseFontSizePx,
        lineHeightMultiplier,
        letterSpacingPx,
        squareSizePx: SHAPE_BASE_PX * scaleMultiplier,
        fontFamily,
        previewWidthPx,
        pans,
        decor,
        tiles,
        dots,
        wordPositions,
        zooms,
        layout,
        grainEnabled,
        grainIntensity,
        subjectMasks,
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
    imageUrls,
    paneCount,
    collageLayoutId,
    captionEnabled,
    caption,
    cutouts,
    shapesEnabled,
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
    pans,
    decor,
    tiles,
    dots,
    wordPositions,
    zooms,
    layout,
    grainEnabled,
    grainIntensity,
    subjectMasks,
  ]);

  // Dragging the handle above the panel resizes it (phones only); the
  // poster refits itself into whatever height is left.
  function handleSheetDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetDrag.current = { startY: e.clientY, startH: sheetHeight };
  }
  function handleSheetMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = sheetDrag.current;
    if (!d) return;
    const next = d.startH + ((d.startY - e.clientY) / window.innerHeight) * 100;
    setSheetHeight(Math.min(SHEET_MAX, Math.max(SHEET_MIN, next)));
  }
  function handleSheetUp() {
    if (!sheetDrag.current) return;
    sheetDrag.current = null;
    try {
      window.localStorage.setItem(SHEET_STORAGE_KEY, String(Math.round(sheetHeight)));
    } catch {
      // remembering the height is a nicety; ignore blocked storage
    }
  }

  const visibleTabs: TabId[] = [
    "layout",
    "style",
    "caption",
  ];

  // Two-photo layouts need both slots filled; a missing one would export a
  // blank half. Clicking export then opens 版型 (where the slots are).
  const missingPhotos = imageUrls.slice(0, paneCount).some((u) => !u);
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
  const squareSizePx = SHAPE_BASE_PX * scaleMultiplier;

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
    <div className={`flex h-full min-h-0 ${activeTab ? "flex-col md:flex-row" : "flex-row"}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          void handleFileList(uploadSlotRef.current, e.target.files);
          e.target.value = "";
        }}
      />

      {/* Phone: opening a tool swaps the main menu for that tool's controls
          (with a back button) under the poster. Wider screens have room for
          both: the menu stays, and the controls take a one-third column
          beside it, leaving the poster the rest. */}
      <ToolRail
        visibleTabs={visibleTabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
        sizeLabel={`${preset.label} ${preset.width} × ${preset.height}`}
        onChangeSize={() => setPreset(null)}
        onExport={handleExportClick}
        exporting={exporting}
        missingPhotos={missingPhotos}
        locked={locked}
        onToggleLocked={() => setLocked((v) => !v)}
      />

      <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col md:order-2">
      <div ref={previewWrapCallbackRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <div
          style={frameStyle}
          className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        >
          <PosterPreview
            canvasRef={canvasRef}
            imageUrls={imageUrls}
            uploadErrors={uploadErrors}
            collageLayoutId={collageLayoutId}
            captionEnabled={captionEnabled}
            caption={caption}
            cutouts={shapesEnabled ? cutouts : []}
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
            pans={pans}
            onPanChange={(slot, next) => setPans((prev) => prev.map((pn, i) => (i === slot ? next : pn)))}
            decor={decor}
            tiles={tiles}
            onTilesChange={setTiles}
            dots={dots}
            onDotsChange={setDots}
            wordPositions={wordPositions}
            onWordPositionsChange={setWordPositions}
            zooms={zooms}
            layout={layout}
            grainEnabled={grainEnabled}
            grainIntensity={grainIntensity}
            subjectMasks={subjectMasks}
            onDecorChange={patchDecor}
            onRequestUpload={handleRequestUpload}
            onFilesDropped={handleFileList}
          />
        </div>
      </div>

      </div>

      {activeTab && (
        <div
          className="order-2 flex h-[var(--sheet-h)] min-h-0 shrink-0 flex-col border-t border-line bg-surface md:order-1 md:h-auto md:w-1/3 md:min-w-[300px] md:max-w-[440px] md:border-r md:border-t-0"
          style={{ "--sheet-h": `${sheetHeight}dvh` } as React.CSSProperties}
        >
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="拖曳調整面板高度"
            className="flex h-5 shrink-0 cursor-row-resize touch-none items-center justify-center md:hidden"
            onPointerDown={handleSheetDown}
            onPointerMove={handleSheetMove}
            onPointerUp={handleSheetUp}
            onPointerCancel={handleSheetUp}
            onDoubleClick={() => setSheetHeight(SHEET_DEFAULT)}
          >
            <span className="h-1 w-10 rounded-full bg-line" />
          </div>
          <div className="min-h-0 flex-1">
          <ToolPanel
            activeTab={activeTab}
            onClose={() => setActiveTab(null)}
            onApplyStylePreset={handleApplyStylePreset}
            onExport={handleExportClick}
            exporting={exporting}
            missingPhotos={missingPhotos}
            features={features}
            showAllFeatures={showAllFeatures}
            onShowAllFeaturesChange={setShowAllFeatures}
            linkedColor={linkedColor}
            stickerLinked={stickerLinked}
            styleDirty={styleDirty}
            onRestoreStyle={() => activeStyle && handleApplyStylePreset(activeStyle)}
            styleThumbs={styleThumbs}
            activeStyleId={activeStyleId}
            decor={decor}
            onDecorChange={handleDecorChange}
            tiles={tiles}
            onTilesEnabledChange={handleTilesEnabledChange}
            onTileCountChange={handleTileCountChange}
            onTileZoomChange={handleTileZoomChange}
            onTileChange={handleTileChange}
            onShuffleTiles={handleShuffleTiles}
            dots={dots}
            onDotsEnabledChange={handleDotsEnabledChange}
            onDotCountChange={handleDotCountChange}
            onShuffleDots={handleShuffleDots}
            onDotColorChange={handleDotColorChange}
            onShuffleWords={handleShuffleWords}
            imageUrls={imageUrls}
            uploadErrors={uploadErrors}
            onRequestUpload={handleRequestUpload}
            zooms={zooms}
            onZoomChange={(slot, n) => setZooms((prev) => prev.map((z, i) => (i === slot ? n : z)))}
            grainEnabled={grainEnabled}
            onGrainEnabledChange={setGrainEnabled}
            grainIntensity={grainIntensity}
            onGrainIntensityChange={setGrainIntensity}
            caption={caption}
            onCaptionChange={handleCaptionChange}
            onRegenerateCaption={handleRegenerateCaption}
            suggestingCaption={suggestingCaption}
            cutouts={cutouts}
            shapesEnabled={shapesEnabled}
            onShapesEnabledChange={setShapesEnabled}
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
            onCaptionBgColorChange={handleCaptionBgChange}
            textColor={textColor}
            onTextColorChange={setTextColor}
            layout={layout}
            onLayoutChange={setLayout}
            collageLayoutId={collageLayoutId}
            onCollageLayoutChange={handleCollageLayoutChange}
            captionEnabled={captionEnabled}
            onCaptionEnabledChange={setCaptionEnabled}
            maskStatus={maskStatus}
          />
          </div>
        </div>
      )}
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
