import { drawFilmGrain } from "./grain";
import { paneFracs } from "./collage";
import type { SubjectMask } from "./subjectSegmentation";
import { captionWords, cornerLines, tileSourceRect } from "./decorLayout";
import { drawSilhouette } from "./silhouette";
import { buildSubjectCutout } from "./subjectCutout";
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
import { drawDotArt } from "./dotArt";
import { computeZones, type ZoneRect } from "./zones";
import { drawHalftoneTile, locateInPane, stickerSourceRect, type SourceRect } from "./stickerCrop";

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

/** Pixel rects of the photo panes (see collage.ts). */
function splitPanes(zone: ZoneRect, collageLayoutId: CollageLayoutId): ZoneRect[] {
  return paneFracs(collageLayoutId).map((f) => ({
    x: zone.x + f.x * zone.w,
    y: zone.y + f.y * zone.h,
    w: f.w * zone.w,
    h: f.h * zone.h,
  }));
}

export interface RenderPosterParams {
  width: number;
  height: number;
  /** One url per pane of the collage layout (null = slot still empty). */
  imageUrls: (string | null)[];
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
  /** Per-photo 0-1 pan within the cover-crop slack (0.5 = centered). */
  pans: { x: number; y: number }[];
  /** Frame, caption mode and silhouette settings (see DecorState). */
  decor: DecorState;
  tiles: Tile[];
  dots: Dot[];
  wordPositions: WordPos[];
  /** Per-photo zoom >= 1 beyond the minimum cover-fit scale. */
  zooms: number[];
  /** Which of the 6 concrete text/photo zone arrangements to render. */
  layout: PosterLayoutId;
  /** Paints a random noise layer over the entire finished poster, last. */
  grainEnabled: boolean;
  /** 0-100. */
  grainIntensity: number;
  subjectMasks: (SubjectMask | null)[];
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
    imageUrls,
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

  const isMulti = collageLayoutId !== "single";
  const paneCount = paneFracs(collageLayoutId).length;

  // An empty slot just leaves its pane showing the base fill.
  const imgs: (HTMLImageElement | null)[] = await Promise.all(
    Array.from({ length: paneCount }, (_, i) => (imageUrls[i] ? loadImage(imageUrls[i]!) : Promise.resolve(null))),
  );
  const srcW = imgs.map((im) => (im ? im.naturalWidth : 0));
  const srcH = imgs.map((im) => (im ? im.naturalHeight : 0));

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

  const panes = splitPanes(photoZone, collageLayoutId);
  const geoms = panes.map((pane, i) =>
    imgs[i] ? coverGeometry(pane.w, pane.h, srcW[i], srcH[i], pans[i] ?? { x: 0.5, y: 0.5 }, zooms[i] ?? 1) : null,
  );
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
    const src = imgs[loc.index];
    const geom = geoms[loc.index];
    const w = srcW[loc.index];
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
    panes.forEach((pane, i) => {
      const im = imgs[i];
      const g = geoms[i];
      if (!im || !g) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.x, pane.y, pane.w, pane.h);
      ctx.clip();
      ctx.drawImage(im, 0, 0, srcW[i], srcH[i], pane.x + g.offsetX, pane.y + g.offsetY, g.renderedW, g.renderedH);
      ctx.restore();
    });

    // With a frame, the seams between photos are frame-colored too.
    if (isMulti && inset > 0) {
      ctx.fillStyle = decor.frameColor;
      panes.forEach((pane) => {
        if (pane.x > photoZone.x + 1) ctx.fillRect(pane.x - inset / 2, pane.y, inset, pane.h);
        if (pane.y > photoZone.y + 1) ctx.fillRect(pane.x, pane.y - inset / 2, pane.w, inset);
      });
    }

    if (decor.silhouetteEnabled) {
      panes.forEach((pane, i) => {
        const m = subjectMasks[i];
        const g = geoms[i];
        if (m && g) drawSilhouette(ctx, m, decor.silhouetteColor, pane, g);
      });
    }

    if (decor.dotArtEnabled) {
      panes.forEach((pane, i) => {
        const im = imgs[i];
        const g = geoms[i];
        if (!im || !g) return;
        drawDotArt(ctx, im, subjectMasks[i] ?? null, pane, g, {
          cellPx: (decor.dotArtCellPct / 100) * content.w,
          threshold: decor.dotArtThreshold,
          invert: decor.dotArtInvert,
          area: decor.dotArtArea,
          color: decor.dotArtColor,
        });
      });
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
  if (isOverlay && captionEnabled && !decor.captionBgTransparent) {
    ctx.fillStyle = captionBgColor;
    ctx.fillRect(textZone.x, textZone.y, textZone.w, textZone.h);
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
  // corner / scatter caption modes. All positions are % of the caption zone
  // (the whole poster when there is none), so they move and scale with it,
  // matching the live preview's overlay container. Anything poking out of
  // the poster's content area is clipped. ---
  const anchor: ZoneRect = captionEnabled ? textZone : content;
  const px = (pct: number) => anchor.x + (pct / 100) * anchor.w;
  const py = (pct: number) => anchor.y + (pct / 100) * anchor.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(content.x, content.y, content.w, content.h);
  ctx.clip();

  if (decor.tilesEnabled) {
    tiles.forEach((tile, i) => {
      const pi = imgs[tile.photo] ? tile.photo : imgs.findIndex((im) => !!im);
      const src = pi >= 0 ? imgs[pi] : null;
      if (!src) return;
      const natW = src.naturalWidth;
      const natH = src.naturalHeight;
      const bmpW = srcW[pi];
      const bmpH = srcH[pi];
      const r = tileSourceRect(tile, natW, natH);
      const kx = bmpW / natW;
      const ky = bmpH / natH;
      const x = px(tile.xPct);
      const y = py(tile.yPct);
      const w = (tile.wPct / 100) * anchor.w;
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
      if (decor.scatterVertical) {
        // Turned 90deg clockwise: dot first, the word running down from it.
        const r = fontPx * 0.4;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = "left";
        ctx.fillText(word, r * 2 + fontPx * 0.35, fontPx * 0.35);
        ctx.restore();
        return;
      }
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
      ctx.fillText(line, anchor.x + anchor.w * 0.95, anchor.y + anchor.h * 0.04 + size + i * size * 2.6);
    });
    ctx.textAlign = "left";
  }
  ctx.restore();

  // The subject cut out of its photo and pasted elsewhere, with a white
  // sticker border (positions are % of the content area).
  if (decor.silhouetteEnabled && decor.subjectPaste) {
    const pi = decor.subjectPastePhoto;
    const src = imgs[pi] ?? null;
    const mask = subjectMasks[pi] ?? null;
    const cut = src && mask ? buildSubjectCutout(src, mask) : null;
    if (cut) {
      const w = (decor.subjectPasteW / 100) * content.w;
      const h = w / cut.aspect;
      ctx.save();
      ctx.beginPath();
      ctx.rect(content.x, content.y, content.w, content.h);
      ctx.clip();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetY = 4 * scale;
      ctx.drawImage(cut.canvas, content.x + (decor.subjectPasteX / 100) * content.w, content.y + (decor.subjectPasteY / 100) * content.h, w, h);
      ctx.restore();
    }
  }

  // Last, so grain sits on top of literally everything -- photo, cutouts,
  // and caption text alike -- matching how film grain sits on top of an
  // actual printed poster rather than being just another background layer.
  if (grainEnabled) {
    drawFilmGrain(ctx, width, height, grainIntensity / 100);
  }

  return canvas;
}
