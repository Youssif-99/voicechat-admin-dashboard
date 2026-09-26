/**
 * Asset Storage Service — Extended file handling for AppAsset.
 *
 * Supports: SVG, PNG, WEBP, JPG/JPEG
 * Features:
 *   - MIME detection from magic bytes (never trusts Content-Type)
 *   - Image dimension extraction
 *   - Thumbnail generation (≤ 128×128) using native sharp or pure-JS fallback
 *   - Automatic optimization (strip metadata, compress)
 *   - Old file deletion on replace
 *   - Path-traversal-safe filenames
 *   - SVG XSS sanitization
 *
 * Storage providers (same as storage.ts): local | s3 | cloudinary
 */

import { createHash } from "crypto";
import path from "path";
import fs from "fs/promises";

// ── Constants ──────────────────────────────────────────────────────────────

/** حد موحّد لجميع أنواع الأصول = 10 MB */
export const ASSET_MAX_BYTES     = 10 * 1024 * 1024;  // 10 MB
export const ASSET_MAX_SVG_BYTES = 10 * 1024 * 1024;  // 10 MB (موحّد مع بقية الأنواع)
export const THUMBNAIL_SIZE      = 128;                // px
export const THUMBNAIL_QUALITY   = 80;                 // JPEG/WEBP quality

export const ALLOWED_ASSET_MIMES = [
  "image/svg+xml",
  "image/png",
  "image/webp",
  "image/jpeg",
  "image/x-icon",
  "image/gif",
  "application/json",
  "application/octet-stream",
] as const;

export type AllowedAssetMime = (typeof ALLOWED_ASSET_MIMES)[number];

// ── Types ──────────────────────────────────────────────────────────────────

export type AssetUploadResult = {
  imageUrl:     string;
  thumbnailUrl: string;
  hash:         string;
  mimeType:     AllowedAssetMime;
  sizeBytes:    number;
  width:        number;
  height:       number;
};

// ── MIME detection from magic bytes ───────────────────────────────────────

export function detectAssetMime(buffer: Buffer): AllowedAssetMime | null {
  if (!buffer || buffer.length === 0) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: GIF87a (47 49 46 38 37 61) / GIF89a (47 49 46 38 39 61)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return "image/gif";
  }
  // Rive (.riv): RIVE (52 49 56 45)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x56 && buffer[3] === 0x45) {
    return "application/octet-stream";
  }
  // WEBP: RIFF????WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  // ICO: 00 00 01 00
  if (
    buffer[0] === 0x00 && buffer[1] === 0x00 &&
    buffer[2] === 0x01 && buffer[3] === 0x00
  ) {
    return "image/x-icon";
  }
  // SVG: starts with optional BOM/whitespace then '<'
  const text = buffer.slice(0, 512).toString("utf-8").trimStart();
  if (text.startsWith("<?xml") || text.startsWith("<svg") || text.startsWith("<!DOCTYPE svg")) {
    return "image/svg+xml";
  }
  // SVG with UTF-8 BOM (EF BB BF)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    const after = buffer.slice(3, 515).toString("utf-8").trimStart();
    if (after.startsWith("<?xml") || after.startsWith("<svg")) return "image/svg+xml";
  }
  // JSON / Lottie: Starts with '{' or '[' (ignoring BOM/whitespace)
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      JSON.parse(buffer.toString("utf-8"));
      return "application/json";
    } catch {
      // not valid JSON
    }
  }
  return null;
}

// ── Extension helper ───────────────────────────────────────────────────────

export function mimeToExt(mime: AllowedAssetMime): string {
  const map: Record<AllowedAssetMime, string> = {
    "image/svg+xml":          "svg",
    "image/png":              "png",
    "image/webp":             "webp",
    "image/jpeg":             "jpg",
    "image/x-icon":           "ico",
    "image/gif":              "gif",
    "application/json":       "json",
    "application/octet-stream": "riv",
  };
  return map[mime];
}

// ── Filename sanitisation ──────────────────────────────────────────────────

export function sanitizeAssetFilename(name: string, ext: string): string {
  const base = path
    .basename(name)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase()
    .slice(0, 64);
  return `${base || "asset"}_${Date.now()}.${ext}`;
}

// ── SVG sanitisation ───────────────────────────────────────────────────────

export function sanitizeAssetSvg(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    .replace(/xlink:href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'xlink:href="#"')
    .replace(/<use[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi, "")
    .replace(/data:(?!image\/(png|jpeg|gif|webp))[^;]*;base64[^"']*/gi, "");
}

// ── MD5 hash ───────────────────────────────────────────────────────────────

export function hashAssetBuffer(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

// ── Image processing (sharp optional, fallback to passthrough) ────────────

type ImageMeta = { width: number; height: number; buffer: Buffer };

async function processRasterImage(
  buffer: Buffer,
  mime: AllowedAssetMime
): Promise<ImageMeta> {
  try {
    // sharp is a native addon listed in package.json and marked as a webpack
    // external in next.config.mjs. Use require() at runtime — never import()
    // at module level — so the build never fails when sharp is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const sharpFn = (require("sharp") as any).default ?? require("sharp");
    const img  = sharpFn(buffer);
    const meta = await img.metadata();

    let optimized: Buffer;
    if (mime === "image/jpeg") {
      optimized = await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    } else if (mime === "image/webp") {
      optimized = await img.webp({ quality: 85 }).toBuffer();
    } else if (mime === "image/png") {
      optimized = await img.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer();
    } else {
      optimized = buffer;
    }

    return {
      width:  meta.width  ?? 0,
      height: meta.height ?? 0,
      buffer: optimized,
    };
  } catch {
    // sharp not available — return buffer unchanged, zero dimensions
    return { width: 0, height: 0, buffer };
  }
}

async function generateThumbnail(
  buffer: Buffer,
  mime: AllowedAssetMime
): Promise<Buffer> {
  if (mime === "image/svg+xml" || mime === "application/json" || mime === "application/octet-stream") return buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const sharpFn = (require("sharp") as any).default ?? require("sharp");
    return await sharpFn(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();
  } catch {
    return buffer;
  }
}

// ── Local storage ──────────────────────────────────────────────────────────

const LOCAL_ASSETS_DIR = path.join(process.cwd(), "public", "assets");
const LOCAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

async function ensureAssetsDir(): Promise<void> {
  await fs.mkdir(path.join(LOCAL_ASSETS_DIR, "thumbnails"), { recursive: true });
}

async function uploadLocalAsset(buffer: Buffer, filename: string): Promise<string> {
  await ensureAssetsDir();
  const dest = path.join(LOCAL_ASSETS_DIR, filename);
  if (!dest.startsWith(LOCAL_ASSETS_DIR + path.sep) && dest !== LOCAL_ASSETS_DIR) {
    throw new Error("Path traversal detected");
  }
  await fs.writeFile(dest, buffer); 
  return `${LOCAL_BASE_URL}/assets/${filename}`;
}

async function uploadLocalThumbnail(buffer: Buffer, filename: string): Promise<string> {
  await ensureAssetsDir();
  const thumbName = `thumb_${filename.replace(/\.[^.]+$/, ".webp")}`;
  const dest = path.join(LOCAL_ASSETS_DIR, "thumbnails", thumbName);
  await fs.writeFile(dest, buffer);
  return `${LOCAL_BASE_URL}/assets/thumbnails/${thumbName}`;
}

async function deleteLocalAsset(url: string): Promise<void> {
  const filename = path.basename(url.split("?")[0]);
  // Delete original
  const target = path.join(LOCAL_ASSETS_DIR, filename);
  if (target.startsWith(LOCAL_ASSETS_DIR + path.sep)) {
    try { await fs.unlink(target); } catch { /* already gone */ }
  }
  // Delete thumbnail
  const thumbName = `thumb_${filename.replace(/\.[^.]+$/, ".webp")}`;
  const thumbTarget = path.join(LOCAL_ASSETS_DIR, "thumbnails", thumbName);
  if (thumbTarget.startsWith(LOCAL_ASSETS_DIR + path.sep)) {
    try { await fs.unlink(thumbTarget); } catch { /* already gone */ }
  }
}

// ── S3 storage ─────────────────────────────────────────────────────────────

async function uploadS3Asset(
  buffer: Buffer,
  filename: string,
  mime: AllowedAssetMime,
  prefix = "assets"
): Promise<string> {
  // @ts-expect-error optional peer dependency
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new (S3Client as any)({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.AWS_S3_BUCKET!;
  const key = `${prefix}/${filename}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.send(new (PutObjectCommand as any)({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mime === "image/x-icon" ? "image/x-icon" : mime,
    CacheControl: "public, max-age=31536000, immutable",
    ACL: process.env.AWS_S3_PUBLIC === "true" ? "public-read" : undefined,
  }));
  const cdnBase = process.env.CLOUDFRONT_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
  return `${cdnBase}/${key}`;
}

async function deleteS3Asset(url: string): Promise<void> {
  try {
    // @ts-expect-error optional peer dependency
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (S3Client as any)({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const bucket = process.env.AWS_S3_BUCKET!;
    const cdnBase = process.env.CLOUDFRONT_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
    const key = url.replace(`${cdnBase}/`, "");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.send(new (DeleteObjectCommand as any)({ Bucket: bucket, Key: key }));
  } catch { /* silent */ }
}

// ── Cloudinary storage ─────────────────────────────────────────────────────

async function uploadCloudinaryAsset(buffer: Buffer, filename: string, prefix = "assets"): Promise<string> {
  // @ts-expect-error optional peer dependency
  const { v2: cloudinary } = await import("cloudinary");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cld = cloudinary as any;
  cld.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  const publicId = `${prefix}/${filename.replace(/\.[^.]+$/, "")}`;
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      { public_id: publicId, resource_type: "image", overwrite: true },
      (err: Error | null, result: { secure_url: string } | null) => {
        if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

async function deleteCloudinaryAsset(url: string): Promise<void> {
  try {
    // @ts-expect-error optional peer dependency
    const { v2: cloudinary } = await import("cloudinary");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cld = cloudinary as any;
    cld.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key:    process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    });
    const match = url.match(/\/assets\/([^/.]+)/);
    if (match) await cld.uploader.destroy(`assets/${match[1]}`);
  } catch { /* silent */ }
}

// ── Public API ─────────────────────────────────────────────────────────────

const PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

/**
 * Validate, process, and upload an asset file.
 * Returns full metadata including thumbnail URL.
 * Throws a descriptive Error on any validation failure.
 */
export async function uploadAsset(
  buffer: Buffer,
  originalName: string
): Promise<AssetUploadResult> {
  // 1. Detect MIME from magic bytes
  const mime = detectAssetMime(buffer);
  if (!mime) {
    throw new Error(
      "نوع الملف غير مدعوم. الأنواع المقبولة: Lottie (.json), Rive (.riv), SVG, PNG, WEBP, GIF, JPG/JPEG."
    );
  }

  // 2. Size limits — موحّد 10 MB لجميع الأنواع
  if (buffer.length > ASSET_MAX_BYTES) {
    throw new Error(
      `حجم الملف (${(buffer.length / 1024 / 1024).toFixed(2)} MB) يتجاوز الحد المسموح (${ASSET_MAX_BYTES / 1024 / 1024} MB).`
    );
  }

  const ext = mimeToExt(mime);

  // 3. Sanitize / optimize
  let finalBuffer = buffer;
  let width = 0, height = 0;

  if (mime === "image/svg+xml") {
    const sanitized = sanitizeAssetSvg(buffer.toString("utf-8"));
    finalBuffer = Buffer.from(sanitized, "utf-8");
  } else if (mime === "application/json" || mime === "application/octet-stream") {
    finalBuffer = buffer;
  } else {
    const processed = await processRasterImage(buffer, mime);
    finalBuffer = processed.buffer;
    width       = processed.width;
    height      = processed.height;
  }

  // 4. Thumbnail
  const thumbBuffer = await generateThumbnail(finalBuffer, mime);
  const thumbExt    = mime === "image/svg+xml" ? "svg" : (mime === "application/json" ? "json" : (mime === "application/octet-stream" ? "riv" : "webp"));

  // 5. Hash
  const hash = hashAssetBuffer(finalBuffer);

  // 6. Sanitize filename
  const filename     = sanitizeAssetFilename(originalName, ext);
  const thumbFilename = sanitizeAssetFilename(`thumb_${originalName}`, thumbExt);

  // 7. Upload
  let imageUrl: string;
  let thumbnailUrl: string;

  if (PROVIDER === "s3") {
    [imageUrl, thumbnailUrl] = await Promise.all([
      uploadS3Asset(finalBuffer, filename, mime),
      uploadS3Asset(thumbBuffer, thumbFilename, mime === "image/svg+xml" ? "image/svg+xml" : "image/webp" as AllowedAssetMime, "assets/thumbnails"),
    ]);
  } else if (PROVIDER === "cloudinary") {
    [imageUrl, thumbnailUrl] = await Promise.all([
      uploadCloudinaryAsset(finalBuffer, filename),
      uploadCloudinaryAsset(thumbBuffer, thumbFilename, "assets/thumbnails"),
    ]);
  } else {
    [imageUrl, thumbnailUrl] = await Promise.all([
      uploadLocalAsset(finalBuffer, filename),
      uploadLocalThumbnail(thumbBuffer, thumbFilename),
    ]);
  }

  return {
    imageUrl,
    thumbnailUrl,
    hash,
    mimeType: mime,
    sizeBytes: finalBuffer.length,
    width,
    height,
  };
}

/**
 * Delete a previously uploaded asset file and its thumbnail.
 * Silently succeeds if already gone.
 */
export async function deleteAsset(imageUrl?: string | null, thumbnailUrl?: string | null): Promise<void> {
  const urls = [imageUrl, thumbnailUrl].filter(Boolean) as string[];
  if (urls.length === 0) return;

  await Promise.allSettled(
    urls.map(async (url) => {
      if (PROVIDER === "s3") {
        await deleteS3Asset(url);
      } else if (PROVIDER === "cloudinary") {
        await deleteCloudinaryAsset(url);
      } else {
        await deleteLocalAsset(url);
      }
    })
  );
}
