import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import { drawHalftone } from "./halftone";
import type { BracketOption, Cutout, PosterLayoutId, ShapeOption } from "./types";
import { buildCaptionTokens } from "./useCutoutLayout";
import { canvasShapePath } from "./shapes";

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
function computeZones(layout: PosterLayoutId, width: number, height: number): { text: ZoneRect; photo: ZoneRect } {
  if (layout === "overlay-h") {
    const bandH = height * OVERLAY_BAND_FRACTION;
    return {
      text: { x: 0, y: (height - bandH) / 2, w: width, h: bandH },
      photo: { x: 0, y: 0, w: width, h: height },
    };
  }
  if (layout === "overlay-v") {
    const bandW = width * OVERLAY_BAND_FRACTION;
    return {
      text: { x: (width - bandW) / 2, y: 0, w: bandW, h: height },
      photo: { x: 0, y: 0, w: width, h: height },
    };
  }

  const isRow = layout === "split-left" || layout === "split-right";
  const textFirst = layout === "text-top" || layout === "split-left";

  if (isRow) {
    const textW = width * TOP_ZONE_FRACTION;
    const photoW = width - textW;
    const textX = textFirst ? 0 : photoW;
    const photoX = textFirst ? textW : 0;
    return {
      text: { x: textX, y: 0, w: textW, h: height },
      photo: { x: photoX, y: 0, w: photoW, h: height },
    };
  }

  const textH = height * TOP_ZONE_FRACTION;
  const photoH = height - textH;
  const textY = textFirst ? 0 : photoH;
  const photoY = textFirst ? textH : 0;
  return {
    text: { x: 0, y: textY, w: width, h: textH },
    photo: { x: 0, y: photoY, w: width, h: photoH },
  };
}

export interface RenderPosterParams {
  width: number;
  height: number;
  imageUrl: string;
  caption: string;
  cutouts: Cutout[];
  shape: ShapeOption;
  bracket: BracketOption;
  topBgColor: string;
  textColor: string;
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
  /** >=1 zoom beyond the minimum cover-fit scale, matching the live
   * preview's zoom slider (1 = no extra zoom). */
  zoom: number;
  /** Which of the 6 concrete text/photo zone arrangements to render. */
  layout: PosterLayoutId;
  /** Whether to paint a shape-glyph halftone dot texture (derived from the
   * photo's own brightness map) behind the caption text. */
  halftoneEnabled: boolean;
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
    caption,
    cutouts,
    shape,
    bracket,
    topBgColor,
    textColor,
    baseFontSizePx,
    lineHeightMultiplier,
    letterSpacingPx,
    squareSizePx,
    fontFamily,
    previewWidthPx,
    pan,
    zoom,
    layout,
    halftoneEnabled,
  } = params;

  const scale = previewWidthPx ? width / previewWidthPx : 1;
  const fontPx = Math.max(1, baseFontSizePx * scale);
  const squarePx = Math.max(1, squareSizePx * scale);
  const letterSpacing = letterSpacingPx * scale;
  const gapX = 4 * scale; // matches Tailwind gap-x-1 (0.25rem)
  const gapY = 8 * scale; // matches Tailwind gap-y-2 (0.5rem)

  const isOverlay = layout === "overlay-h" || layout === "overlay-v";
  const { text: textZone, photo: photoZone } = computeZones(layout, width, height);

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

  ctx.fillStyle = topBgColor;
  ctx.fillRect(0, 0, width, height);

  const img = await loadImage(imageUrl);

  ctx.font = `${fontPx}px ${fontFamily}`;
  const bracketOpenW = bracket.open ? ctx.measureText(bracket.open).width : 0;
  const bracketCloseW = bracket.close ? ctx.measureText(bracket.close).width : 0;

  const tokens = buildCaptionTokens(caption, cutouts);
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

  const bottomGeom = coverGeometry(photoZone.w, photoZone.h, img.naturalWidth, img.naturalHeight, pan, zoom);
  const cutoutById = new Map(cutouts.map((c) => [c.id, c]));

  function cutoutImagePoint(cutout: Cutout) {
    // Same math as the live preview's thumbStyle: where this cutout's
    // top-left point falls within the full *scaled* source image --
    // zone-local, since PosterPreview's ResizeObserver measurement (which
    // this mirrors) is always relative to the photo zone's own box
    // regardless of where that box sits on the canvas.
    return {
      left: -bottomGeom.offsetX + (cutout.xPct / 100) * photoZone.w,
      top: -bottomGeom.offsetY + (cutout.yPct / 100) * photoZone.h,
    };
  }

  // --- Photo zone: full photo, then the shaped mask "holes" -- painted
  // *before* the text pass so that for the overlay layouts (where the
  // text zone's band physically sits on top of the photo zone, unlike the
  // 4 non-overlapping splits where paint order doesn't matter) the text
  // band's opaque fill and the caption text both end up on top of the
  // photo, not underneath it. ---
  if (photoZone.w > 0 && photoZone.h > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoZone.x, photoZone.y, photoZone.w, photoZone.h);
    ctx.clip();
    ctx.drawImage(
      img,
      0,
      0,
      img.naturalWidth,
      img.naturalHeight,
      photoZone.x + bottomGeom.offsetX,
      photoZone.y + bottomGeom.offsetY,
      bottomGeom.renderedW,
      bottomGeom.renderedH,
    );
    ctx.restore();

    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetY = 1 * scale;
    cutouts.forEach((cutout) => {
      const x = photoZone.x + (cutout.xPct / 100) * photoZone.w;
      const y = photoZone.y + (cutout.yPct / 100) * photoZone.h;
      ctx.fillStyle = cutout.color ?? topBgColor;
      ctx.fill(canvasShapePath(shape.id, x, y, squarePx));
    });
    ctx.shadowColor = "transparent";
  }

  // The overlay layouts have no separate background fill under the text
  // band (the initial full-canvas fill is now covered by the photo drawn
  // above), so paint an opaque band there before the text sits on top.
  if (isOverlay) {
    ctx.fillStyle = topBgColor;
    ctx.fillRect(textZone.x, textZone.y, textZone.w, textZone.h);
  }

  if (halftoneEnabled) {
    drawHalftone(ctx, img, textZone, shape.id, textColor);
  }

  // --- Paint pass: caption text + inline cropped thumbnails, both
  // horizontally centered per line and vertically centered as a block
  // within the text zone (matching the live preview's content-center +
  // justify-center) ---
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

      if (photoZone.w > 0 && photoZone.h > 0) {
        const { left, top } = cutoutImagePoint(cutout);
        const path = canvasShapePath(shape.id, imgX, boxY, squarePx);
        ctx.save();
        ctx.clip(path);
        ctx.drawImage(
          img,
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
          imgX - left,
          boxY - top,
          bottomGeom.renderedW,
          bottomGeom.renderedH,
        );
        ctx.restore();
      }

      if (bracket.close) ctx.fillText(bracket.close, imgX + squarePx, baselineY);
    });
    rowY += rowHeight + gapY;
  });

  ctx.restore();

  return canvas;
}
