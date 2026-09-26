/**
 * Storage Service — Production-grade icon file handling.
 *
 * Strategy (in priority order):
 *   1. If STORAGE_PROVIDER=s3        → upload to AWS S3, return CDN URL via CLOUDFRONT_BASE_URL
 *   2. If STORAGE_PROVIDER=cloudinary → upload to Cloudinary
 *   3. Default (local)               → write to /public/icons/, serve from Next.js
 *
 * Security:
 *   - MIME-type validation via magic bytes (never trusts Content-Type / extension)
 *   - Filename sanitization & path-traversal prevention
 *   - Max size: 10 MB for all types (SVG, PNG, WEBP, ICO)
 *   - SVG content sanitization (strip <script>, event handlers, JS URIs)
 *
 * Accepted types: SVG · PNG · WEBP · ICO
 */

import { createHash } from "crypto";
import path from "path";
import fs from "fs/promises";

// ── Constants ──────────────────────────────────────────────────────────────

/** حد موحّد لجميع أنواع الملفات = 10 MB */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * @deprecated استخدم MAX_FILE_BYTES
 * محتفظ به للتوافقية العكسية مع أي كود خارجي قد يستورده.
 */
export const MAX_SVG_BYTES = MAX_FILE_BYTES;
/** @deprecated استخدم MAX_FILE_BYTES */
export const MAX_PNG_BYTES = MAX_FILE_BYTES;

export const ALLOWED_MIME = [
  "image/svg+xml",
  "image/png",
  "image/webp",
  "image/x-icon",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

// ── Types ──────────────────────────────────────────────────────────────────

export type UploadResult = {
  url:       string;
  hash:      string;
  sizeBytes: number;
  mimeType:  AllowedMime;
};

/** Result object — لا نستخدم throw للأخطاء المتوقعة */
export type UploadIconResult =
  | { success: true;  data: UploadResult; error?: never }
  | { success: false; error: string;     data?: never  };

export type StorageDeleteResult = { deleted: boolean };

// ── Validation helpers ─────────────────────────────────────────────────────

/**
 * Detect MIME type from magic bytes — do NOT trust the `type` field from FormData.
 */
export function detectMime(buffer: Buffer): AllowedMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) return "image/png";

  // WEBP: RIFF????WEBP  (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50
  ) return "image/webp";

  // ICO: 00 00 01 00
  if (
    buffer[0] === 0x00 && buffer[1] === 0x00 &&
    buffer[2] === 0x01 && buffer[3] === 0x00
  ) return "image/x-icon";

  // SVG: starts with optional BOM/whitespace then '<'
  const text = buffer.slice(0, 512).toString("utf-8").trimStart();
  if (
    text.startsWith("<?xml") ||
    text.startsWith("<svg") ||
    text.startsWith("<!DOCTYPE svg")
  ) return "image/svg+xml";

  // SVG with UTF-8 BOM (EF BB BF)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    const after = buffer.slice(3, 515).toString("utf-8").trimStart();
    if (after.startsWith("<?xml") || after.startsWith("<svg"))
      return "image/svg+xml";
  }

  return null;
}

/**
 * رسالة خطأ الحجم بالعربية — تُعرض للمستخدم مباشرة.
 */
export function fileSizeErrorMessage(bytes: number, maxBytes: number): string {
  const mb = (bytes / 1024 / 1024).toFixed(2);
  return `حجم الملف (${mb} MB) يتجاوز الحد المسموح (${maxBytes / 1024 / 1024} MB)`;
}

/**
 * Sanitize SVG content — removes script tags, JS event handlers, and javascript: URIs.
 */
export function sanitizeSvg(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    .replace(/xlink:href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'xlink:href="#"')
    .replace(/<use[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi, "")
    .replace(/data:(?!image\/(png|jpeg|gif|webp))[^;]*;base64[^"']*/gi, "");
}

/**
 * Sanitize filename — prevent path traversal, normalize to safe slug.
 */
export function sanitizeFilename(
  name: string,
  ext: "svg" | "png" | "webp" | "ico"
): string {
  const base = path
    .basename(name)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase()
    .slice(0, 64);
  const slug = base || "icon";
  return `${slug}_${Date.now()}.${ext}`;
}

/** MD5 hash of buffer for ETag / change detection */
export function hashBuffer(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

// ── MIME → extension helper ────────────────────────────────────────────────

function mimeToExt(mime: AllowedMime): "svg" | "png" | "webp" | "ico" {
  const map: Record<AllowedMime, "svg" | "png" | "webp" | "ico"> = {
    "image/svg+xml": "svg",
    "image/png":     "png",
    "image/webp":    "webp",
    "image/x-icon":  "ico",
  };
  return map[mime];
}

// ── Local storage (default) ────────────────────────────────────────────────

const LOCAL_ICONS_DIR = path.join(process.cwd(), "public", "icons");
const LOCAL_BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "";

async function ensureIconsDir(): Promise<void> {
  await fs.mkdir(LOCAL_ICONS_DIR, { recursive: true });
}

async function uploadLocal(buffer: Buffer, filename: string): Promise<string> {
  await ensureIconsDir();
  const dest = path.join(LOCAL_ICONS_DIR, filename);
  if (!dest.startsWith(LOCAL_ICONS_DIR + path.sep) && dest !== LOCAL_ICONS_DIR) {
    throw new Error("Path traversal detected");
  }
  await fs.writeFile(dest, buffer);
  return `${LOCAL_BASE_URL}/icons/${filename}`;
}

async function deleteLocal(url: string): Promise<void> {
  const filename = path.basename(url.split("?")[0]);
  const target   = path.join(LOCAL_ICONS_DIR, filename);
  if (!target.startsWith(LOCAL_ICONS_DIR + path.sep)) return;
  try { await fs.unlink(target); } catch { /* already gone */ }
}

// ── S3 storage ─────────────────────────────────────────────────────────────

async function uploadS3(
  buffer: Buffer,
  filename: string,
  mime: AllowedMime
): Promise<string> {
  // @ts-expect-error optional peer dependency
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new (S3Client as any)({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.AWS_S3_BUCKET!;
  const key    = `icons/${filename}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.send(new (PutObjectCommand as any)({
    Bucket:       bucket,
    Key:          key,
    Body:         buffer,
    ContentType:  mime,
    CacheControl: "public, max-age=31536000, immutable",
    ACL: process.env.AWS_S3_PUBLIC === "true" ? "public-read" : undefined,
  }));
  const cdnBase = process.env.CLOUDFRONT_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
  return `${cdnBase}/${key}`;
}

async function deleteS3(url: string): Promise<void> {
  // @ts-expect-error optional peer dependency
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new (S3Client as any)({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const bucket  = process.env.AWS_S3_BUCKET!;
  const cdnBase = process.env.CLOUDFRONT_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
  const key     = url.replace(`${cdnBase}/`, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.send(new (DeleteObjectCommand as any)({ Bucket: bucket, Key: key }));
}

// ── Cloudinary storage ─────────────────────────────────────────────────────

async function uploadCloudinary(buffer: Buffer, filename: string): Promise<string> {
  // @ts-expect-error optional peer dependency
  const { v2: cloudinary } = await import("cloudinary");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cld = cloudinary as any;
  cld.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  const publicId = `icons/${filename.replace(/\.[^.]+$/, "")}`;
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

async function deleteCloudinary(url: string): Promise<void> {
  // @ts-expect-error optional peer dependency
  const { v2: cloudinary } = await import("cloudinary");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cld = cloudinary as any;
  cld.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  const match = url.match(/\/icons\/([^/.]+)/);
  if (match) await cld.uploader.destroy(`icons/${match[1]}`);
}

// ── Public API ─────────────────────────────────────────────────────────────

const PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

/**
 * Validate, sanitize, and upload a raw file buffer.
 *
 * بدلاً من throw مباشر، يرجع دائماً UploadIconResult.
 * الـ caller مسؤول عن التحقق من success قبل استخدام data.
 *
 * الأخطاء المتوقعة (نوع ملف خاطئ، حجم كبير) → success: false + error string عربي.
 * الأخطاء غير المتوقعة (شبكة، disk full) → success: false + رسالة عامة.
 */
export async function uploadIcon(
  buffer: Buffer,
  originalName: string
): Promise<UploadIconResult> {
  try {
    // 1. Detect MIME from magic bytes
    const mime = detectMime(buffer);
    if (!mime) {
      return {
        success: false,
        error: "نوع الملف غير مدعوم. الأنواع المقبولة: SVG، PNG، WEBP، ICO.",
      };
    }

    // 2. Unified size limit: 10 MB for all types
    if (buffer.length > MAX_FILE_BYTES) {
      return {
        success: false,
        error: fileSizeErrorMessage(buffer.length, MAX_FILE_BYTES),
      };
    }

    const ext = mimeToExt(mime);

    // 3. Sanitize SVG content
    let finalBuffer = buffer;
    if (ext === "svg") {
      const sanitized = sanitizeSvg(buffer.toString("utf-8"));
      finalBuffer = Buffer.from(sanitized, "utf-8");
    }

    // 4. Sanitize filename
    const filename = sanitizeFilename(originalName, ext);

    // 5. Hash
    const hash = hashBuffer(finalBuffer);

    // 6. Upload to configured provider
    let url: string;
    if (PROVIDER === "s3") {
      url = await uploadS3(finalBuffer, filename, mime);
    } else if (PROVIDER === "cloudinary") {
      url = await uploadCloudinary(finalBuffer, filename);
    } else {
      url = await uploadLocal(finalBuffer, filename);
    }

    return {
      success: true,
      data: { url, hash, sizeBytes: finalBuffer.length, mimeType: mime },
    };
  } catch (err) {
    // أخطاء غير متوقعة (I/O, network, etc.)
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع أثناء الرفع";
    console.error("[uploadIcon]", err);
    return { success: false, error: msg };
  }
}

/**
 * Delete a previously uploaded icon file.
 * Silently succeeds if the file is already gone.
 */
export async function deleteIcon(url: string): Promise<StorageDeleteResult> {
  if (!url) return { deleted: false };
  try {
    if (PROVIDER === "s3") {
      await deleteS3(url);
    } else if (PROVIDER === "cloudinary") {
      await deleteCloudinary(url);
    } else {
      await deleteLocal(url);
    }
    return { deleted: true };
  } catch {
    return { deleted: false };
  }
}
