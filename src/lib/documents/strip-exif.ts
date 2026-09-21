import "server-only";

import sharp from "sharp";
import type { ApprovedFileType } from "./file-validation";

/**
 * Re-encodes JPEG/PNG images to strip EXIF/GPS metadata (phone photos
 * routinely embed GPS coordinates) per the brief. sharp doesn't carry
 * metadata forward unless explicitly asked to (`.withMetadata()`),
 * which we deliberately never call. PDFs pass through unchanged — the
 * brief scopes this requirement to "photos", and PDF metadata
 * stripping is a different problem or best done by whatever produced
 * the PDF.
 */
export async function stripExifIfImage(buffer: Buffer, mime: ApprovedFileType): Promise<Buffer> {
  if (mime === "application/pdf") {
    return buffer;
  }
  const image = sharp(buffer, { failOn: "none" });
  if (mime === "image/jpeg") {
    return image.jpeg({ quality: 90 }).toBuffer();
  }
  return image.png().toBuffer();
}
