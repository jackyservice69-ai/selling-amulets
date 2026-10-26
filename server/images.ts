import sharp from "sharp";
import { HttpError } from "./security.js";

const pixelLimit = 40000000;
export const imagePolicy = {
  maxDimension: 1600,
  maxBytes: 1024 * 1024,
  thumbnailDimension: 600,
  thumbnailMaxBytes: 150 * 1024,
} as const;

async function encode(source: Buffer, thumbnail: boolean) {
  const maxBytes = thumbnail ? imagePolicy.thumbnailMaxBytes : imagePolicy.maxBytes;
  const attempts = thumbnail
    ? [[600, 76], [600, 68], [512, 68], [400, 68]]
    : [[1600, 84], [1600, 78], [1600, 72], [1280, 76], [1024, 76]];
  for (const [size, quality] of attempts) {
    const result = await sharp(source, { limitInputPixels: pixelLimit, failOn: "warning" })
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4, alphaQuality: 100 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length <= maxBytes) return result;
  }
  throw new HttpError(400, "ไม่สามารถบีบอัดรูปนี้ได้ กรุณาลดขนาดหรือเลือกรูปใหม่");
}

// Finish decoding and generating both versions before writing any file or DB row.
// Sharp strips EXIF/GPS by default; rotate applies orientation before stripping it.
export async function optimizeImage(source: Buffer) {
  try {
    const meta = await sharp(source, { limitInputPixels: pixelLimit, failOn: "warning" }).metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1)
      throw new HttpError(400, "รองรับเฉพาะ JPG, PNG และ WebP แบบภาพนิ่ง");
    const image = await encode(source, false);
    const thumbnail = await encode(source, true);
    return {
      image: image.data,
      thumbnail: thumbnail.data,
      optimization: {
        format: "webp" as const,
        width: image.info.width,
        height: image.info.height,
        originalBytes: source.length,
        imageBytes: image.data.length,
        thumbnailBytes: thumbnail.data.length,
      },
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "ไฟล์รูปภาพเสียหาย ขนาดภาพใหญ่เกินไป หรือไม่รองรับ กรุณาเลือกรูปใหม่");
  }
}
