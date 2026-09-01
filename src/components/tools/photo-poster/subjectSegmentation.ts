import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

// Both the WASM runtime loader (shared across every MediaPipe vision task,
// not just segmentation; ~11MB) and the DeepLab v3 model (~2.8MB) are
// vendored into public/mediapipe rather than referenced from jsDelivr /
// storage.googleapis.com the way official MediaPipe examples do it --
// same-origin static assets don't depend on a third-party CDN being
// reachable on whatever network the viewer is on. Only downloaded the
// first time someone turns the "主體網點" toggle on; the browser caches
// them after that.
const WASM_BASE = "/mediapipe/wasm";

// DeepLab v3, a general-purpose (not person-only) segmentation model
// trained on the 21-class Pascal VOC set: background plus 20 common
// object categories including person, cat, dog, bird, horse, cow, sheep,
// car, bus, and others.
const MODEL_URL = "/mediapipe/deeplab_v3.tflite";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function getSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= FilesetResolver.forVisionTasks(WASM_BASE).then((vision) =>
    ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: "IMAGE",
    }),
  );
  return segmenterPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for subject segmentation"));
    img.src = src;
  });
}

export interface SubjectMask {
  /** One byte per pixel, row-major, width*height long: 1 = part of the
   * detected subject, 0 = background. */
  data: Uint8Array;
  width: number;
  height: number;
}

/** Runs MediaPipe's general-purpose DeepLab v3 segmenter on the photo and
 * collapses its 21-class output into a single subject/background mask --
 * "subject" being any pixel the model didn't call background, since this
 * tool has no reason to make anyone pick which of the 20 categories
 * applies. Returns null if the model can't be loaded (offline, a blocked
 * CDN) or the photo doesn't contain any of those 20 categories at all (an
 * all-background mask) -- callers should treat either case as "no effect
 * available" rather than surface an error, since most photos (food,
 * landscapes, products, abstract graphics) simply aren't covered by this
 * particular model's vocabulary. */
export async function segmentSubject(imageUrl: string): Promise<SubjectMask | null> {
  try {
    const [segmenter, img] = await Promise.all([getSegmenter(), loadImage(imageUrl)]);
    const result = segmenter.segment(img);
    const categoryMask = result.categoryMask;
    if (!categoryMask) {
      result.close();
      return null;
    }

    const raw = categoryMask.getAsUint8Array();
    const width = categoryMask.width;
    const height = categoryMask.height;
    const data = new Uint8Array(width * height);
    let subjectPixels = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] !== 0) {
        data[i] = 1;
        subjectPixels++;
      }
    }
    result.close();

    if (subjectPixels === 0) return null;
    return { data, width, height };
  } catch {
    return null;
  }
}
