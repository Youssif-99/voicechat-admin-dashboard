"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { AssetRepository } from "@/lib/asset-repository";
import { uploadAsset, deleteAsset } from "@/lib/asset-storage";
import { ASSET_DEFINITIONS } from "@/lib/asset-definitions";
import { notifyAssetChange } from "@/lib/notify";

// ── Auth helper ────────────────────────────────────────────────────────────

async function buildAudit(session: Awaited<ReturnType<typeof requireSuperAdmin>>) {
  return {
    adminId:    session.adminId,
    adminName:  session.name,
    adminEmail: session.email,
  };
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createAssetAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);

  const key        = String(formData.get("key")        || "").trim().toLowerCase();
  const name       = String(formData.get("name")       || "").trim();
  const category   = String(formData.get("category")   || "").trim();
  const changeNote = String(formData.get("changeNote") || "").trim() || undefined;

  if (!key || !name || !category) throw new Error("المفتاح والاسم والتصنيف مطلوبة");
  if (!/^[a-z0-9_]+$/.test(key))  throw new Error("المفتاح: أحرف صغيرة، أرقام، شرطة سفلية فقط");

  let imageUrl: string | undefined, thumbnailUrl: string | undefined;
  let mimeType: string | undefined, hash: string | undefined;
  let sizeBytes: number | undefined, width: number | undefined, height: number | undefined;

  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const r   = await uploadAsset(Buffer.from(await file.arrayBuffer()), file.name);
    imageUrl    = r.imageUrl;
    thumbnailUrl = r.thumbnailUrl;
    mimeType    = r.mimeType;
    hash        = r.hash;
    sizeBytes   = r.sizeBytes;
    width       = r.width;
    height      = r.height;
  }

  const asset = await AssetRepository.create(
    { key, name, category, imageUrl, thumbnailUrl, mimeType, hash, sizeBytes, width, height, changeNote },
    audit
  );

  await notifyAssetChange({ type: "asset:created", payload: { assetId: asset.id, key: asset.key, category: asset.category } });
  revalidatePath("/assets");
}

// ── Update (replace file / edit metadata) ─────────────────────────────────

export async function updateAssetAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);

  const id         = String(formData.get("id")         || "");
  const name       = String(formData.get("name")       || "").trim() || undefined;
  const category   = String(formData.get("category")   || "").trim() || undefined;
  const changeNote = String(formData.get("changeNote") || "").trim() || undefined;

  if (!id) throw new Error("معرّف الأصل مطلوب");

  const existing = await AssetRepository.findById(id);
  if (!existing) throw new Error("الأصل غير موجود");

  let imageUrl     = existing.imageUrl     ?? undefined;
  let thumbnailUrl = existing.thumbnailUrl ?? undefined;
  let mimeType     = existing.mimeType     ?? undefined;
  let hash         = existing.hash         ?? undefined;
  let sizeBytes    = existing.sizeBytes    ?? undefined;
  let width        = existing.width        ?? undefined;
  let height       = existing.height       ?? undefined;

  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    // Delete old files before uploading new ones
    await deleteAsset(existing.imageUrl, existing.thumbnailUrl);
    const r  = await uploadAsset(Buffer.from(await file.arrayBuffer()), file.name);
    imageUrl     = r.imageUrl;
    thumbnailUrl = r.thumbnailUrl;
    mimeType     = r.mimeType;
    hash         = r.hash;
    sizeBytes    = r.sizeBytes;
    width        = r.width;
    height       = r.height;
  }

  const asset = await AssetRepository.update(
    id,
    { name, category, imageUrl, thumbnailUrl, mimeType, hash, sizeBytes, width, height, changeNote },
    audit
  );

  await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
  revalidatePath("/assets");
}

// ── Delete (soft) ──────────────────────────────────────────────────────────

export async function deleteAssetAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  const id      = String(formData.get("id") || "");
  if (!id) throw new Error("معرّف الأصل مطلوب");
  const asset = await AssetRepository.softDelete(id, audit);
  await notifyAssetChange({ type: "asset:deleted", payload: { assetId: asset.id, key: asset.key } });
  revalidatePath("/assets");
}

// ── Restore ────────────────────────────────────────────────────────────────

export async function restoreAssetAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  const id      = String(formData.get("id") || "");
  if (!id) throw new Error("معرّف الأصل مطلوب");
  const asset = await AssetRepository.restore(id, audit);
  await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
  revalidatePath("/assets");
}

// ── Enable / Disable ───────────────────────────────────────────────────────

export async function setAssetActiveAction(formData: FormData) {
  const session  = await requireSuperAdmin();
  const audit    = await buildAudit(session);
  const id       = String(formData.get("id")       || "");
  const isActive = formData.get("isActive") === "true";
  if (!id) throw new Error("معرّف الأصل مطلوب");
  const asset = await AssetRepository.setActive(id, isActive, audit);
  await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
  revalidatePath("/assets");
}

// ── Rollback ───────────────────────────────────────────────────────────────

export async function rollbackAssetAction(formData: FormData) {
  const session       = await requireSuperAdmin();
  const audit         = await buildAudit(session);
  const id            = String(formData.get("id")            || "");
  const targetVersion = parseInt(String(formData.get("targetVersion") || "0"), 10);
  if (!id || !targetVersion) throw new Error("معرّف الأصل ورقم الإصدار مطلوبان");
  const asset = await AssetRepository.rollback(id, targetVersion, audit);
  await notifyAssetChange({ type: "asset:updated", payload: { assetId: asset.id, key: asset.key, version: asset.version } });
  revalidatePath("/assets");
}

// ── Invalidate Cache ───────────────────────────────────────────────────────

export async function invalidateAssetCacheAction() {
  const session = await requireSuperAdmin();
  const result  = await AssetRepository.invalidateCache({
    adminId:    session.adminId,
    adminName:  session.name,
    adminEmail: session.email,
  });
  await notifyAssetChange({ type: "asset:cache_cleared", payload: result });
  revalidatePath("/assets");
}

// ── Seed Defaults ──────────────────────────────────────────────────────────

export async function seedDefaultAssetsAction() {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  await AssetRepository.seedDefaults(ASSET_DEFINITIONS, audit);
  await notifyAssetChange({ type: "asset:cache_cleared", payload: { version: 0, etag: "seed" } });
  revalidatePath("/assets");
}
