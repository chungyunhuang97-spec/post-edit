/** Turns an uploaded/pasted File into a data URL the rest of the app can
 * just `<img src>` / `background-image` without further ceremony -- while
 * catching the one upload failure mode that silently used to render an
 * empty photo zone: an iPhone photo saved in HEIC/HEIF, which Chrome (and
 * most non-Safari browsers) cannot decode at all. No onload ever fires, no
 * error ever surfaces, the box just stays blank. This converts HEIC/HEIF to
 * JPEG client-side first, and for every other file actually waits for a
 * successful decode before accepting it, so an unsupported/corrupt file
 * gets a clear message instead of a silent blank. */

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsDataURL(file);
  });
}

/** Confirms a data URL actually decodes as an image before handing it back
 * to callers -- a failed decode (bad format, truncated file) otherwise only
 * shows up much later as an inexplicably blank photo zone. */
function verifyImageDecodes(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("圖片解碼失敗"));
    img.src = url;
  });
}

function looksLikeHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // Some browsers/OSes report an empty or generic type for HEIC files
  // picked from an iPhone's camera roll -- fall back to the extension.
  return /\.(heic|heif)$/i.test(file.name);
}

export function looksLikeImageFile(file: File): boolean {
  return file.type.startsWith("image/") || looksLikeHeic(file) || /\.(jpe?g|png|gif|webp|bmp|tiff?|avif)$/i.test(file.name);
}

export type LoadedImage = { url: string } | { error: string };

export async function loadUploadedImage(file: File): Promise<LoadedImage> {
  if (!looksLikeImageFile(file)) {
    return { error: "這不是圖片檔案,請重新選擇。" };
  }

  let source: Blob = file;

  if (looksLikeHeic(file)) {
    try {
      // Loaded lazily -- most uploads are already JPEG/PNG and never need
      // the (fairly large, libheif-wasm-backed) HEIC decoder at all.
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      source = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      return { error: "這張照片是 iPhone 的 HEIC 格式,自動轉檔失敗了。請改用「使用較相容格式」拍攝,或先轉成 JPG/PNG 再上傳。" };
    }
  }

  let url: string;
  try {
    url = await readFileAsDataUrl(source);
  } catch {
    return { error: "讀取這個檔案時發生錯誤,請再試一次。" };
  }

  try {
    await verifyImageDecodes(url);
  } catch {
    return { error: "瀏覽器無法顯示這張照片,請確認格式（建議 JPG / PNG / HEIC）後重新上傳。" };
  }

  return { url };
}
