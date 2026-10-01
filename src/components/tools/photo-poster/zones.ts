import { OVERLAY_BAND_FRACTION, TOP_ZONE_FRACTION } from "./constants";
import type { PosterLayoutId } from "./types";

export interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Mirrors PosterPreview.tsx's layout switch: the text zone and photo zone
 * sit top/bottom (either order), left/right (either order), or -- for the
 * two "overlay" layouts -- the photo fills the entire canvas and the text
 * zone is a centered band that gets painted on top of it afterward. */
export function computeZones(
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


/** Width / height of the caption zone for a poster of the given aspect
 * ratio, or of the whole poster when there is no caption zone. Used to
 * size free-placed items (small photos) so their heights come out right in
 * zone-relative percentages. */
export function zoneAspectOf(
  layout: PosterLayoutId,
  fraction: number | null,
  canvasAspect: number,
  captionEnabled: boolean,
): number {
  if (!captionEnabled) return canvasAspect;
  const z = computeZones(layout, canvasAspect, 1, fraction).text;
  return z.h > 0 ? z.w / z.h : canvasAspect;
}
