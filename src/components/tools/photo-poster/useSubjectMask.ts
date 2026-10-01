import { useEffect, useRef, useState } from "react";
import { segmentSubject, type SubjectMask } from "./subjectSegmentation";

export type MaskStatus = "idle" | "loading" | "ready" | "unavailable";

/** Detects the subject of the photo at `url`, but only once `enabled` is on
 * (so nobody who never uses a subject feature downloads the model), and
 * only once per photo -- results are kept by URL, so toggling the feature
 * off and on again, or switching photos back and forth, doesn't re-run it. */
export function useSubjectMask(url: string | null, enabled: boolean): { mask: SubjectMask | null; status: MaskStatus } {
  const [masks, setMasks] = useState<Record<string, SubjectMask | null>>({});
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !url || url in masks || inFlight.current.has(url)) return;
    inFlight.current.add(url);
    segmentSubject(url).then((mask) => {
      inFlight.current.delete(url);
      setMasks((prev) => ({ ...prev, [url]: mask }));
    });
  }, [enabled, url, masks]);

  if (!enabled || !url) return { mask: null, status: "idle" };
  if (!(url in masks)) return { mask: null, status: "loading" };
  const mask = masks[url];
  return { mask, status: mask ? "ready" : "unavailable" };
}
