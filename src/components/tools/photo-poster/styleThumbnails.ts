"use client";

import { useEffect, useRef, useState } from "react";
import { BRACKET_OPTIONS, FONT_OPTIONS, SHAPE_OPTIONS } from "./constants";
import { renderPosterToCanvas } from "./exportPoster";
import { STYLE_PRESETS, buildStyleState } from "./stylePresets";
import type { SubjectMask } from "./subjectSegmentation";
import type { FontOption } from "./types";

const SAMPLE_CAPTION = "slow weekend with sea breeze";
const THUMB_W = 240;
const THUMB_H = 300;
// The width the preset font sizes are calibrated against (a phone-width
// live preview); thumbnails are the same poster scaled down uniformly.
const REFERENCE_PREVIEW_W = 330;

/** The person-shaped region drawn onto the sample photo. Drawn once for the
 * picture and once (as white on black) to produce the matching subject
 * mask, so the silhouette style previews correctly without running the
 * segmentation model. */
function drawSubject(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(w * 0.46, h * 0.78, w * 0.2, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.46, h * 0.42, w * 0.095, 0, Math.PI * 2);
  ctx.fill();
}

/** A neutral sample photo (sky, sea, sand, a standing figure) so every
 * style card shows the same scene and differs only by its style. */
function makeSampleScene(): { url: string; mask: SubjectMask } {
  const w = 640;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, "#9ec5e8");
  sky.addColorStop(1, "#f2dfc8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#5b88ad";
  ctx.fillRect(0, h * 0.5, w, h * 0.16);
  ctx.fillStyle = "#e2cba3";
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  ctx.fillStyle = "#fff4d6";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.2, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  drawSubject(ctx, w, h, "#3d4b5c");

  const mw = 128;
  const mh = 160;
  const mc = document.createElement("canvas");
  mc.width = mw;
  mc.height = mh;
  const mctx = mc.getContext("2d", { willReadFrequently: true })!;
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, mw, mh);
  drawSubject(mctx, mw, mh, "#fff");
  const px = mctx.getImageData(0, 0, mw, mh).data;
  const data = new Uint8Array(mw * mh);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4] > 127 ? 1 : 0;
  return { url: canvas.toDataURL("image/jpeg", 0.85), mask: { data, width: mw, height: mh } };
}

/** Resolves a font option's CSS variable stack to the concrete family
 * string canvas text needs, making sure the font file is loaded first. */
async function resolveFontFamily(option: FontOption): Promise<string> {
  const el = document.createElement("span");
  el.style.cssText = `position:absolute;visibility:hidden;font-family:${option.cssVar}, ${option.fallback}`;
  el.textContent = "Aa字";
  document.body.appendChild(el);
  const family = getComputedStyle(el).fontFamily;
  try {
    await document.fonts.load(`16px ${family}`, "Aa字");
  } catch {
    // fall back to whatever is available
  }
  el.remove();
  return family;
}

/** Renders one thumbnail per style preset by running the real export
 * renderer on a sample photo at small size -- so each card shows exactly
 * what applying that style produces. Generated lazily (the first time
 * `enabled` turns true) and cached for the session. */
export function useStyleThumbnails(enabled: boolean): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const startedRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Starts the first time `enabled` is true and then runs to completion,
  // even if the user leaves the style tab meanwhile.
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    const cancelled = false;
    void (async () => {
      await document.fonts.ready;
      const scene = makeSampleScene();
      for (const preset of STYLE_PRESETS) {
        if (unmountedRef.current) return;
        const st = buildStyleState(preset, { caption: SAMPLE_CAPTION, canvasAspect: THUMB_W / THUMB_H, photoCount: 1 });
        const fontOption = FONT_OPTIONS.find((f) => f.id === st.fontOptionId)!;
        try {
          const canvas = await renderPosterToCanvas({
            width: THUMB_W,
            height: THUMB_H,
            imageUrl: scene.url,
            imageUrl2: null,
            collageLayoutId: "single",
            captionEnabled: st.captionEnabled,
            caption: SAMPLE_CAPTION,
            cutouts: st.shapesEnabled ? st.cutouts : [],
            shape: SHAPE_OPTIONS.find((s) => s.id === st.shapeId)!,
            stickerStyleId: st.stickerStyleId,
            bracket: BRACKET_OPTIONS.find((b) => b.id === st.bracketId)!,
            captionBgColor: st.captionBgColor,
            textColor: st.textColor,
            stickerColor: st.stickerColor,
            baseFontSizePx: st.baseFontSizePx,
            lineHeightMultiplier: st.lineHeightMultiplier,
            letterSpacingPx: st.letterSpacingPx,
            squareSizePx: st.baseFontSizePx * st.scaleMultiplier,
            fontFamily: await resolveFontFamily(fontOption),
            previewWidthPx: REFERENCE_PREVIEW_W,
            pan: { x: 0.5, y: 0.5 },
            pan2: { x: 0.5, y: 0.5 },
            decor: st.decor,
            tiles: st.tiles,
            dots: st.dots,
            wordPositions: st.wordPositions,
            zoom: 1,
            layout: st.layout,
            duotoneEnabled: false,
            duotoneDark: "#000000",
            duotoneLight: "#ffffff",
            grainEnabled: st.grainEnabled,
            grainIntensity: st.grainIntensity,
            subjectHalftoneEnabled: false,
            subjectMask: scene.mask,
          });
          if (unmountedRef.current || cancelled) return;
          const url = canvas.toDataURL("image/jpeg", 0.85);
          setThumbs((prev) => ({ ...prev, [preset.id]: url }));
        } catch {
          // A failed thumbnail just leaves that card on its text fallback.
        }
      }
    })();
  }, [enabled]);

  return thumbs;
}
