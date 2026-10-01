import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import { applyDuotone } from "./duotone";
import { drawFilmGrain } from "./grain";
import { drawSubjectHalftone } from "./subjectHalftone";
import type { SubjectMask } from "./subjectSegmentation";
import { captionWords, cornerLines, tileSourceRect } from "./decorLayout";
import { drawSilhouette } from "./silhouette";
import type {
  BracketOption,
  CollageLayoutId,
  Cutout,
  DecorState,
  Dot,
  PosterLayoutId,
  ShapeOption,
  StickerStyleId,
  Tile,
  WordPos,
} from "./types";
import { buildCaptionTokens } from "./useCutoutLayout";
import { canvasShapePath } from "./shapes";
import { drawHalftoneTile, locateInPane, stickerSourceRect, type SourceRect } from "./stickerCrop";

// The export renders at full poster resolution (often much larger than a
// phone photo needs to be shown at), so the duotone pass caps its working
// resolution well above the live preview's cap -- quality matters more
// here than speed, but an uncapped multi-thousand-pixel DSLR photo would
// still make the per-pixel recolor loop needlessly slow.
const DUOTONE_EXPORT_MAX_DIMENSION = 3000;
// Matches PosterPreview.tsx: in a duo collage neither photo gets a
// drag-to-pan handle, so both simply center within their own half.
interface CoverGeometry {
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
}

/** Mirrors PosterPreview.tsx's computeCoverGeometry -- pan.x/pan.y (0-1,
 * default 0.5) shift the cover-crop's centered position anywhere within
 * the slack it leaves on each axis, and zoom (>=1) scales beyond the
 * minimum cover-fit size for a tighter crop. */
function coverGeometry(
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number,
  pan: { x: number; y: number },
  zoom: number,
): CoverGeometry {
  const scale = Math.max(boxW / naturalW, boxH / naturalH) * zoom;
  const renderedW = naturalW * scale;
  const renderedH = naturalH * scale;
  return {
    renderedW,
    renderedH,
    offsetX: -(renderedW - boxW) * pan.x,
    offsetY: -(renderedH - boxH) * pan.y,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image"));
    img.src = src;
  });
}

// Manual per-character measure/fill instead of the newer ctx.letterSpacing
// API -- older Safari support for that property is shaky, and this
// project has already been burned twice by Safari-specific canvas/DOM
// gaps that only showed up on a real device.
function measureWithSpacing(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  if (spacing === 0 || text.length === 0) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

function fillWithSpacing(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  if (spacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

interface LineItem {
  kind: "word" | "cutout";
  text?: string;
  cutoutId?: string;
  x: number;
  width: number;
}

interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Mirrors PosterPreview.tsx's layout switch: the text zone and photo zone
 * sit top/bottom (either order), left/right (either order), or -- for the
 * two "overlay" layouts -- the photo fills the entire canvas and the text
 * zone is a centered band that gets painted on top of it afterward. */
function computeZones(
  layout: PosterLayoutId,
  width: number,
  height: number,
  fraction: number | null,
): { text: ZoneRect; photo: ZoneRect } {
  if (layout === "overlay-h") {
    const bandH = height * (fraction ?? OVERLAY_BAND_FRACTION);
    return {
      text: { x: 0, y: (height - bandH) / 2, w: width, h: bandH },
      photo: { x: 0, y: 0, w: width, h: height },
    };
  }
  if (layout === "overlay-v") {
    const bandW = width * (fraction ?? OVERLAY_BAND_FRACTION);
    return {
      text: { x: (width - bandW) / 2, y: 0, w: bandW, h: height },
      photo: { x: 0, y: 0, w: width, h: height },
    };
  }

  const isRow = layout === "split-left" || layout === "split-right";
  const textFirst = layout === "text-top" || layout === "split-left";

  if (isRow) {
    const textW = width * (fraction ?? TOP_ZONE_FRACTION);
    const photoW = width - textW;
    const textX = textFirst ? 0 : photoW;
    const photoX = textFirst ? textW : 0;
    return {
      text: { x: textX, y: 0, w: textW, h: height },
      photo: { x: photoX, y: 0, w: photoW, h: height },
    };
  }

  const textH = height * (fraction ?? TOP_ZONE_FRACTION);
  const photoH = height - textH;
  const textY = textFirst ? 0 : photoH;
  const photoY = textFirst ? textH : 0;
  return {
    text: { x: 0, y: textY, w: width, h: textH },
    photo: { x: 0, y: photoY, w: width, h: photoH },
  };
}

/** Mirrors PosterPreview.tsx's paneBoxW/paneBoxH split -- in "single" mode
 * both panes are just the whole photo zone (paneB is simply unused by
 * callers then); "duo-h"/"duo-v" halve it along the matching axis. */
function splitPanes(zone: ZoneRect, collageLayoutId: CollageLayoutId): [ZoneRect, ZoneRect] {
  if (collageLayoutId === "duo-h") {
    const w = zone.w / 2;
    return [
      { x: zone.x, y: zone.y, w, h: zone.h },
      { x: zone.x + w, y: zone.y, w: zone.w - w, h: zone.h },
    ];
  }
  if (collageLayoutId === "duo-v") {
    const h = zone.h / 2;
    return [
      { x: zone.x, y: zone.y, w: zone.w, h },
      { x: zone.x, y: zone.y + h, w: zone.w, h: zone.h - h },
    ];
  }
  return [zone, zone];
}

export interface RenderPosterParams {
  width: number;
  height: number;
  imageUrl: string;
  /** Second photo, only drawn when collageLayoutId isn't "single". */
  imageUrl2: string | null;
  collageLayoutId: CollageLayoutId;
  /** Whether the caption renders at all -- false means the photo zone
   * takes the full canvas and no text/inline-thumbnail pass runs. */
  captionEnabled: boolean;
  caption: string;
  cutouts: Cutout[];
  shape: ShapeOption;
  stickerStyleId: StickerStyleId;
  bracket: BracketOption;
  captionBgColor: string;
  textColor: string;
  /** Default fill for any cutout without its own color override. */
  stickerColor: string;
  baseFontSizePx: number;
  lineHeightMultiplier: number;
  letterSpacingPx: number;
  squareSizePx: number;
  /** Resolved CSS font-family string (read from the live preview's
   * computed style) so the exported text uses the exact font the user
   * sees, including hashed next/font family names. */
  fontFamily: string;
  /** CSS px width the slider-driven values above are calibrated against
   * (the live preview's current rendered width) -- everything is scaled
   * up uniformly from there to the export resolution, the same idea as
   * html-to-image's pixelRatio, but computed by hand. */
  previewWidthPx: number;
  /** 0-1 pan within the photo's cover-crop slack, matching the live
   * preview's draggable photo position (0.5 = centered). */
  pan: { x: number; y: number };
  /** Frame, caption mode and silhouette settings (see DecorState). */
  decor: DecorState;
  tiles: Tile[];
  dots: Dot[];
  wordPositions: WordPos[];
  /** Second photo's crop position in a duo collage. */
  pan2: { x: number; y: number };
  /** >=1 zoom beyond the minimum cover-fit scale, matching the live
   * preview's zoom slider (1 = no extra zoom). */
  zoom: number;
  /** Which of the 6 concrete text/photo zone arrangements to render. */
  layout: PosterLayoutId;
  /** Recolors the photo into duotoneDark (shadows) / duotoneLight
   * (highlights) instead of its own colors. */
  duotoneEnabled: boolean;
  duotoneDark: string;
  duotoneLight: string;
  /** Paints a random noise layer over the entire finished poster, last. */
  grainEnabled: boolean;
  /** 0-100. */
  grainIntensity: number;
  /** Renders a dot-matrix silhouette of subjectMask behind the caption
   * text instead of that zone's plain background. No-ops if subjectMask
   * is null (segmentation unavailable or found nothing recognizable). */
  subjectHalftoneEnabled: boolean;
  subjectMask: SubjectMask | null;
}

/** Renders the poster directly onto a <canvas>, entirely by hand --
 * deliberately not a DOM screenshot (html-to-image/html2canvas-style
 * libraries rasterize via an SVG <foreignObject>, which WebKit/Safari is
 * known to handle unreliably for background-image + clip-path together,
 * silently dropping content instead of erroring). Canvas 2D's clip(),
 * drawImage() and Path2D are solid across all engines including iOS
 * Safari, so this is the reliable option for a tool meant to be used and
 * shared from a phone. */
export async function renderPosterToCanvas(params: RenderPosterParams): Promise<HTMLCanvasElement> {
  const {
    width,
    height,
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
    squareSizePx,
    fontFamily,
    previewWidthPx,
    pan,
    pan2,
    decor,
    tiles,
    dots,
    wordPositions,
    zoom,
    layout,
    duotoneEnabled,
    duotoneDark,
    duotoneLight,
    grainEnabled,
    grainIntensity,
    subjectHalftoneEnabled,
    subjectMask,
  } = params;

  const scale = previewWidthPx ? width / previewWidthPx : 1;
  const fontPx = Math.max(1, baseFontSizePx * scale);
  const squarePx = Math.max(1, squareSizePx * scale);
  const letterSpacing = letterSpacingPx * scale;
  const gapX = 4 * scale; // matches Tailwind gap-x-1 (0.25rem)
  const gapY = 8 * scale; // matches Tailwind gap-y-2 (0.5rem)

  const isOverlay = layout === "overlay-h" || layout === "overlay-v";
  // No caption at all -> the photo zone takes the whole canvas, same as the
  // overlay layouts already do, rather than a split that reserves empty
  // space for a caption that isn't there (mirrors PosterPreview.tsx).
  // The frame is a border around the whole poster: every zone below is laid
  // out inside this inset content rect, then shifted into place.
  const inset = (decor.frameInsetPct / 100) * width;
  const content: ZoneRect = { x: inset, y: inset, w: Math.max(0, width - 2 * inset), h: Math.max(0, height - 2 * inset) };
  const shift = (z: ZoneRect): ZoneRect => ({ x: z.x + inset, y: z.y + inset, w: z.w, h: z.h });
  const rawZones = captionEnabled
    ? computeZones(layout, content.w, content.h, decor.captionFraction)
    : { text: { x: 0, y: 0, w: 0, h: 0 }, photo: { x: 0, y: 0, w: content.w, h: content.h } };
  const textZone = captionEnabled ? shift(rawZones.text) : rawZones.text;
  const photoZone = shift(rawZones.photo);
  // Only the flowing-paragraph mode writes inside the caption zone; the
  // corner / scatter modes draw their text in the free overlay layer.
  const flowText = captionEnabled && decor.captionMode === "flow";

  // CSS `%` padding (px-[6%] / py-[7%], both horizontal AND vertical)
  // resolves against the *containing block's width* -- here, the text
  // zone's own rendered width, not the full canvas or the zone's height.
  const padX = textZone.w * 0.06;
  const padY = textZone.w * 0.07;
  const lineHeight = fontPx * lineHeightMultiplier;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = inset > 0 ? decor.frameColor : captionBgColor;
  ctx.fillRect(0, 0, width, height);
  if (inset > 0) {
    ctx.fillStyle = captionBgColor;
    ctx.fillRect(content.x, content.y, content.w, content.h);
  }

  const isDuo = collageLayoutId !== "single";

  const img = await loadImage(imageUrl);
  // Recolored once up front (rather than per drawImage call below) so
  // every place the photo gets painted -- the main photo zone and the
  // inline cropped thumbnails in the caption -- stays in sync. A
  // <canvas> is a valid drawImage source, so nothing downstream needs to
  // know whether it's drawing the original photo or this recolored one,
  // aside from reading width/height off the right object.
  const photoSource: CanvasImageSource = duotoneEnabled
    ? applyDuotone(img, img.naturalWidth, img.naturalHeight, duotoneDark, duotoneLight, DUOTONE_EXPORT_MAX_DIMENSION)
    : img;
  const srcW = duotoneEnabled ? (photoSource as HTMLCanvasElement).width : img.naturalWidth;
  const srcH = duotoneEnabled ? (photoSource as HTMLCanvasElement).height : img.naturalHeight;

  // Second photo, only loaded in a duo collage that actually has one --
  // its absence (slot not filled in yet) just leaves that pane showing the
  // canvas's base captionBgColor fill underneath.
  const img2 = isDuo && imageUrl2 ? await loadImage(imageUrl2) : null;
  const photoSource2: CanvasImageSource | null = img2
    ? duotoneEnabled
      ? applyDuotone(img2, img2.naturalWidth, img2.naturalHeight, duotoneDark, duotoneLight, DUOTONE_EXPORT_MAX_DIMENSION)
      : img2
    : null;
  const srcW2 = photoSource2 ? (duotoneEnabled ? (photoSource2 as HTMLCanvasElement).width : img2!.naturalWidth) : 0;
  const srcH2 = photoSource2 ? (duotoneEnabled ? (photoSource2 as HTMLCanvasElement).height : img2!.naturalHeight) : 0;

  ctx.font = `${fontPx}px ${fontFamily}`;
  const bracketOpenW = bracket.open ? ctx.measureText(bracket.open).width : 0;
  const bracketCloseW = bracket.close ? ctx.measureText(bracket.close).width : 0;

  const allTokens = buildCaptionTokens(caption, cutouts);
  const tokens = allTokens.filter(
    (t) => (decor.showCaptionText || t.kind === "cutout") && (decor.inlineWindows || t.kind === "word"),
  );
  const availableWidth = Math.max(1, textZone.w - padX * 2);

  // --- Layout pass: word-wrap the token stream (mirrors the live
  // preview's flex-wrap layout) without drawing anything yet, so we know
  // the text block's total height before deciding where the photo starts.
  const lines: LineItem[][] = [];
  let currentLine: LineItem[] = [];
  let cursorX = 0;

  function commitLine() {
    if (currentLine.length) lines.push(currentLine);
    currentLine = [];
    cursorX = 0;
  }

  for (const token of tokens) {
    if (token.kind === "word") {
      const w = measureWithSpacing(ctx, token.text, letterSpacing);
      if (cursorX > 0 && cursorX + w > availableWidth) commitLine();
      currentLine.push({ kind: "word", text: token.text, x: cursorX, width: w });
      cursorX += w + gapX;
    } else {
      const w = bracketOpenW + squarePx + bracketCloseW;
      if (cursorX > 0 && cursorX + w > availableWidth) commitLine();
      currentLine.push({ kind: "cutout", cutoutId: token.cutoutId, x: cursorX, width: w });
      cursorX += w + gapX;
    }
  }
  commitLine();

  const rowHeights = lines.map((line) => (line.some((it) => it.kind === "cutout") ? Math.max(lineHeight, squarePx) : lineHeight));
  const totalTextHeight = rowHeights.reduce((a, b) => a + b, 0) + gapY * Math.max(0, lines.length - 1);

  // In "single" mode paneA is exactly photoZone and paneB is unused; a duo
  // collage halves the zone along the matching axis (see splitPanes above).
  const [paneA, paneB] = splitPanes(photoZone, collageLayoutId);
  const bottomGeom = coverGeometry(paneA.w, paneA.h, srcW, srcH, pan, zoom);
  const paneBGeom = photoSource2 ? coverGeometry(paneB.w, paneB.h, srcW2, srcH2, pan2, zoom) : null;
  const cutoutById = new Map(cutouts.map((c) => [c.id, c]));

  /** The photo (and source rect within it) a cutout sits over -- in a duo
   * collage whichever pane its center falls in. Null when that pane has no
   * photo. Same math as the live preview's cropBackground. */
  function cropFor(cutout: Cutout, magnify: number): { src: CanvasImageSource; rect: SourceRect } | null {
    const loc = locateInPane(
      collageLayoutId,
      photoZone.w,
      photoZone.h,
      (cutout.xPct / 100) * photoZone.w,
      (cutout.yPct / 100) * photoZone.h,
      squarePx,
    );
    const src = loc.index === 0 ? photoSource : photoSource2;
    const geom = loc.index === 0 ? bottomGeom : paneBGeom;
    const w = loc.index === 0 ? srcW : srcW2;
    if (!src || !geom) return null;
    const rect = stickerSourceRect(geom, w, loc.x, loc.y, squarePx, magnify);
    return rect ? { src, rect } : null;
  }

  // --- Photo zone: full photo (or, in a duo collage, both photos side by
  // side/stacked), then the shaped mask "holes" -- painted *before* the
  // text pass so that for the overlay layouts (where the text zone's band
  // physically sits on top of the photo zone, unlike the 4 non-overlapping
  // splits where paint order doesn't matter) the text band's opaque fill
  // and the caption text both end up on top of the photo, not underneath
  // it. ---
  if (photoZone.w > 0 && photoZone.h > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(paneA.x, paneA.y, paneA.w, paneA.h);
    ctx.clip();
    ctx.drawImage(
      photoSource,
      0,
      0,
      srcW,
      srcH,
      paneA.x + bottomGeom.offsetX,
      paneA.y + bottomGeom.offsetY,
      bottomGeom.renderedW,
      bottomGeom.renderedH,
    );
    ctx.restore();

    if (isDuo && photoSource2 && paneBGeom) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(paneB.x, paneB.y, paneB.w, paneB.h);
      ctx.clip();
      ctx.drawImage(
        photoSource2,
        0,
        0,
        srcW2,
        srcH2,
        paneB.x + paneBGeom.offsetX,
        paneB.y + paneBGeom.offsetY,
        paneBGeom.renderedW,
        paneBGeom.renderedH,
      );
      ctx.restore();
    }

    // With a frame, the seam between two photos is frame-colored too.
    if (isDuo && inset > 0) {
      ctx.fillStyle = decor.frameColor;
      if (collageLayoutId === "duo-h") ctx.fillRect(paneB.x - inset / 2, photoZone.y, inset, photoZone.h);
      else ctx.fillRect(photoZone.x, paneB.y - inset / 2, photoZone.w, inset);
    }

    if (decor.silhouetteEnabled && subjectMask) {
      drawSilhouette(ctx, subjectMask, decor.silhouetteColor, paneA, bottomGeom);
    }

    // Mirrors PosterPreview.tsx's renderSticker: the bare shape, filled
    // with its color (flat) or a dot print of the photo (halftone).
    cutouts.forEach((cutout) => {
      const x = photoZone.x + (cutout.xPct / 100) * photoZone.w;
      const y = photoZone.y + (cutout.yPct / 100) * photoZone.h;
      const color = cutout.color ?? stickerColor;
      const crop = stickerStyleId === "halftone" ? cropFor(cutout, 1) : null;
      if (crop) {
        ctx.save();
        ctx.clip(canvasShapePath(shape.id, x, y, squarePx));
        drawHalftoneTile(ctx, crop.src, crop.rect, x, y, squarePx, color);
        ctx.restore();
      } else {
        ctx.fillStyle = color;
        ctx.fill(canvasShapePath(shape.id, x, y, squarePx));
      }
    });
  }

  // The overlay layouts have no separate background fill under the text
  // band (the initial full-canvas fill is now covered by the photo drawn
  // above), so paint an opaque band there before the text sits on top.
  if (isOverlay && captionEnabled) {
    ctx.fillStyle = captionBgColor;
    ctx.fillRect(textZone.x, textZone.y, textZone.w, textZone.h);
  }

  if (captionEnabled && subjectHalftoneEnabled && subjectMask) {
    drawSubjectHalftone(ctx, img, subjectMask, textZone, shape.id, textColor);
  }

  // --- Paint pass: caption text + inline cropped thumbnails, both
  // horizontally centered per line and vertically centered as a block
  // within the text zone (matching the live preview's content-center +
  // justify-center). Skipped entirely with no caption -- textZone is a
  // zero-size rect in that case, so this would no-op anyway, but skipping
  // it outright avoids setting up canvas state for nothing. ---
  if (flowText) {
    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "alphabetic";

    // Clip to the text zone's own bounds, matching the live preview's
    // overflow:hidden on that same box -- without this, a caption long
    // enough to overflow its zone would keep drawing past it (bleeding into
    // the photo zone below in the 4-way splits, or floating unbacked over
    // the photo in the overlay layouts, since the opaque band fill above
    // only covers the zone's own rect).
    ctx.save();
    ctx.beginPath();
    ctx.rect(textZone.x, textZone.y, textZone.w, textZone.h);
    ctx.clip();

    const contentBoxHeight = Math.max(0, textZone.h - padY * 2);
    let rowY = textZone.y + padY + Math.max(0, (contentBoxHeight - totalTextHeight) / 2);

    lines.forEach((line, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      const baselineY = rowY + rowHeight / 2 + fontPx * 0.35;
      const lastItem = line[line.length - 1];
      const lineWidth = lastItem.x + lastItem.width;
      const lineStartX = textZone.x + padX + Math.max(0, (availableWidth - lineWidth) / 2);

      line.forEach((item) => {
        const drawX = lineStartX + item.x;
        if (item.kind === "word") {
          fillWithSpacing(ctx, item.text!, drawX, baselineY, letterSpacing);
          return;
        }
        const cutout = cutoutById.get(item.cutoutId!);
        if (!cutout) return;

        const boxY = rowY + (rowHeight - squarePx) / 2;
        if (bracket.open) ctx.fillText(bracket.open, drawX, baselineY);
        const imgX = drawX + bracketOpenW;

        const path = canvasShapePath(shape.id, imgX, boxY, squarePx);
        const crop = photoZone.w > 0 && photoZone.h > 0 ? cropFor(cutout, 1) : null;
        if (crop) {
          ctx.save();
          ctx.clip(path);
          ctx.drawImage(crop.src, crop.rect.sx, crop.rect.sy, crop.rect.sSize, crop.rect.sSize, imgX, boxY, squarePx, squarePx);
          ctx.restore();
        } else {
          // No photo under this cutout (e.g. the second slot is still
          // empty): flat color chip, matching the sticker on the photo.
          const prevFill = ctx.fillStyle;
          ctx.fillStyle = cutout.color ?? stickerColor;
          ctx.fill(path);
          ctx.fillStyle = prevFill;
        }

        if (bracket.close) ctx.fillText(bracket.close, imgX + squarePx, baselineY);
      });
      rowY += rowHeight + gapY;
    });

    ctx.restore();
  }

  // --- Free-position overlay layer: small photo tiles, solid dots, and the
  // corner / scatter caption modes. All positions are % of the content
  // rect, matching the live preview's overlay container. ---
  const px = (pct: number) => content.x + (pct / 100) * content.w;
  const py = (pct: number) => content.y + (pct / 100) * content.h;

  if (decor.tilesEnabled) {
    tiles.forEach((tile, i) => {
      const useSecond = tile.photo === 1 && photoSource2 && img2;
      const src = useSecond ? photoSource2! : photoSource;
      const natW = useSecond ? img2!.naturalWidth : img.naturalWidth;
      const natH = useSecond ? img2!.naturalHeight : img.naturalHeight;
      const bmpW = useSecond ? srcW2 : srcW;
      const bmpH = useSecond ? srcH2 : srcH;
      const r = tileSourceRect(tile, natW, natH);
      const kx = bmpW / natW;
      const ky = bmpH / natH;
      const x = px(tile.xPct);
      const y = py(tile.yPct);
      const w = (tile.wPct / 100) * content.w;
      const h = w / tile.aspect;
      ctx.drawImage(src, r.sx * kx, r.sy * ky, r.sw * kx, r.sh * ky, x, y, w, h);
      if (decor.tileNumbered) {
        ctx.font = `${fontPx * 0.7}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`(${i + 1})`, x, y - 5 * scale);
      }
    });
  }

  if (decor.dotsEnabled) {
    dots.forEach((dot) => {
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(px(dot.xPct), py(dot.yPct), (decor.dotSizePx * scale) / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (captionEnabled && decor.showCaptionText && decor.captionMode === "scatter") {
    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    captionWords(caption).forEach((word, i) => {
      const pos = wordPositions[i];
      if (!pos) return;
      const cx = px(pos.xPct);
      const cy = py(pos.yPct);
      ctx.fillText(word, cx, cy + fontPx * 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy - fontPx * 0.95, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.textAlign = "left";
  }

  if (captionEnabled && decor.showCaptionText && decor.captionMode === "corner") {
    const size = fontPx * 0.85;
    ctx.font = `${size}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    cornerLines(caption).forEach((line, i) => {
      ctx.fillText(line, content.x + content.w * 0.95, content.y + content.h * 0.04 + size + i * size * 2.6);
    });
    ctx.textAlign = "left";
  }

  // Last, so grain sits on top of literally everything -- photo, cutouts,
  // and caption text alike -- matching how film grain sits on top of an
  // actual printed poster rather than being just another background layer.
  if (grainEnabled) {
    drawFilmGrain(ctx, width, height, grainIntensity / 100);
  }

  return canvas;
}
