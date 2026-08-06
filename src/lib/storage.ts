/**
 * Storage Service — Production-grade icon file handling.
 *
 * Strategy (in priority order):
 *   1. If STORAGE_PROVIDER=s3 → upload to AWS S3, return CDN URL via CLOUDFRONT_BASE_URL
 *   2. If STORAGE_PROVIDER=cloudinary → upload to Cloudinary
 *   3. Default (local) → write to /public/icons/, serve from Next.js
 *
 * Security:
 *   - MIME-type validation (magic bytes, not just extension)
 *   - Filename sanitization & path-traversal prevention
 *   - Max size: 512 KB for SVG, 1 MB for PNG
 *   - SVG content sanitization (strip <script>, event handlers, JS URIs)
 */

import { createHash } from "crypto";
import path from "path";
import fs from "fs/promises";

// ── Constants ──────────────────────────────────────────────────────────────

export const MAX_SVG_BYTES = 512 * 1024;   // 512 KB
export const MAX_PNG_BYTES = 1024 * 1024;  // 1 MB
export const ALLOWED_MIME = ["image/svg+xml", "image/png"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

// ── Types ──────────────────────────────────────────────────────────────────

export type UploadResult = {
  url: string;
  hash: string;
  sizeBytes: number;
  mimeType: AllowedMime;
};

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
  ) {
    return "image/png";
  }
  // SVG: starts with optional BOM/whitespace then '<'
  const text = buffer.slice(0, 512).toString("utf-8").trimStart();
  if (text.startsWith("<?xml") || text.startsWith("<svg") || text.startsWith("<!DOCTYPE svg")) {
    return "image/svg+xml";
  }
  // SVG with UTF-8 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    const after = buffer.slice(3, 515).toString("utf-8").trimStart();
    if (after.startsWith("<?xml") || after.startsWith("<svg")) return "image/svg+xml";
  }
  return null;
}

/**
 * Sanitize SVG content — removes script tags, JS event handlers, and javascript: URIs.
 * This is a defence-in-depth measure on top of Content-Security-Policy headers.
 */
export function sanitizeSvg(content: string): string {
  return content
    // Remove <script> blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // Remove event handler attributes (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    // Remove javascript: URIs
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    .replace(/xlink:href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'xlink:href="#"')
    // Remove <use> with external references (potential SSRF)
    .replace(/<use[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi, "")
    // Remove embedded base64 data URIs for non-images
    .replace(/data:(?!image\/(png|jpeg|gif|webp))[^;]*;base64[^"']*/gi, "");
}

/**
 * Sanitize filename — prevent path traversal, normalize to safe slug.
 */
export function sanitizeFilename(name: string, ext: "svg" | "png"): string {
  const base = path
    .basename(name)                        // strip any directory parts
    .replace(/\.[^.]+$/, "")              // remove extension
    .replace(/[^a-zA-Z0-9_\-]/g, "_")     // replace unsafe chars
    .replace(/_{2,}/g, "_")               // collapse underscores
    .toLowerCase()
    .slice(0, 64);                         // cap length
  const slug = base || "icon";
  const ts = Date.now();
  return `${slug}_${ts}.${ext}`;
}

/** MD5 hash of buffer for ETag / change detection */
export function hashBuffer(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

// ── Local storage (default) ────────────────────────────────────────────────

const LOCAL_ICONS_DIR = path.join(process.cwd(), "public", "icons");
const LOCAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

async function ensureIconsDir(): Promise<void> {
  await fs.mkdir(LOCAL_ICONS_DIR, { recursive: true });
}

async function uploadLocal(
  buffer: Buffer,
  filename: string
): Promise<string> {
  await ensureIconsDir();
  const dest = path.join(LOCAL_ICONS_DIR, filename);
  // Final path-traversal guard — dest must be inside LOCAL_ICONS_DIR
  if (!dest.startsWith(LOCAL_ICONS_DIR + path.sep) && dest !== LOCAL_ICONS_DIR) {
    throw new Error("Path traversal detected");
  }
  await fs.writeFile(dest, buffer);
  return `${LOCAL_BASE_URL}/icons/${filename}`;
}

async function deleteLocal(url: string): Promise<void> {
  const filename = path.basename(url.split("?")[0]);
  const target = path.join(LOCAL_ICONS_DIR, filename);
  if (!target.startsWith(LOCAL_ICONS_DIR + path.sep)) return; // silently skip
  try {
    await fs.unlink(target);
  } catch {
    // File already gone — not an error
  }
}

// ── S3 storage ─────────────────────────────────────────────────────────────

async function uploadS3(buffer: Buffer, filename: string, mime: AllowedMime): Promise<string> {
  // Dynamic import — @aws-sdk/client-s3 is an optional peer dependency.
  // Install it when STORAGE_PROVIDER=s3: npm install @aws-sdk/client-s3
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
  const key = `icons/${filename}`;
  await client.send(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (PutObjectCommand as any)({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: process.env.AWS_S3_PUBLIC === "true" ? "public-read" : undefined,
    })
  );
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
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.AWS_S3_BUCKET!;
  const cdnBase = process.env.CLOUDFRONT_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
  const key = url.replace(`${cdnBase}/`, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.send(new (DeleteObjectCommand as any)({ Bucket: bucket, Key: key }));
}

// ── Cloudinary storage ─────────────────────────────────────────────────────

async function uploadCloudinary(buffer: Buffer, filename: string): Promise<string> {
  // Dynamic import — cloudinary is an optional peer dependency.
  // Install it when STORAGE_PROVIDER=cloudinary: npm install cloudinary
  // @ts-expect-error optional peer dependency
  const { v2: cloudinary } = await import("cloudinary");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cld = cloudinary as any;
  cld.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
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
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  const match = url.match(/\/icons\/([^/.]+)/);
  if (match) await cld.uploader.destroy(`icons/${match[1]}`);
}

// ── Public API ─────────────────────────────────────────────────────────────

const PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

/**
 * Validate, sanitize, and upload a raw file buffer.
 * Returns the public URL and metadata, or throws a descriptive Error.
 */
export async function uploadIcon(
  buffer: Buffer,
  originalName: string
): Promise<UploadResult> {
  // 1. Detect MIME from magic bytes
  const mime = detectMime(buffer);
  if (!mime) {
    throw new Error("نوع الملف غير مدعوم. يُقبل فقط SVG أو PNG.");
  }

  // 2. Size limits
  const ext = mime === "image/svg+xml" ? "svg" : "png";
  const maxBytes = ext === "svg" ? MAX_SVG_BYTES : MAX_PNG_BYTES;
  if (buffer.length > maxBytes) {
    throw new Error(
      `حجم الملف (${(buffer.length / 1024).toFixed(1)} KB) يتجاوز الحد المسموح (${maxBytes / 1024} KB).`
    );
  }

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

  return { url, hash, sizeBytes: finalBuffer.length, mimeType: mime };
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
