// Browser-only: shrink and re-encode a photo before upload.
// Re-drawing onto a canvas also drops EXIF metadata, including the GPS
// coordinates phones embed in photos.

export type EncodedImage = { blob: Blob; ext: "webp" | "jpg" };

export class UnreadableImageError extends Error {}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnreadableImageError(file.name);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(bitmap: ImageBitmap, maxEdge: number): Promise<EncodedImage> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // WebP where the browser can encode it (much smaller); JPEG otherwise.
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Could not encode image");
  return { blob: jpeg, ext: "jpg" };
}

/** Full-size photo (longest edge 1600px) plus a 480px thumbnail. */
export async function prepareListingPhoto(file: File): Promise<{ full: EncodedImage; thumb: EncodedImage }> {
  const bitmap = await decode(file);
  try {
    const full = await encode(bitmap, 1600);
    // Same browser, same encoder support, so both come out in the same format
    // and the thumbnail path can be derived from the full-size path.
    const thumb = await encode(bitmap, 480);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}
