"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { uploadIcon, deleteIcon } from "@/lib/storage";
import { ICON_DEFINITIONS } from "@/lib/icon-groups";
import { notifyIconChange } from "@/lib/notify";

// ── Auth helper ────────────────────────────────────────────────────────────

async function buildAudit(session: Awaited<ReturnType<typeof requireSuperAdmin>>) {
  return {
    adminId:    session.adminId,
    adminName:  session.name,
    adminEmail: session.email,
  };
}

// ── Icon CRUD ──────────────────────────────────────────────────────────────

export async function createIconAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);

  const key         = String(formData.get("key")         || "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const category    = String(formData.get("category")    || "").trim();
  const type        = String(formData.get("type")        || "svg") as "svg" | "png" | "both";
  const changeNote  = String(formData.get("changeNote")  || "").trim() || undefined;

  if (!key || !displayName || !category) throw new Error("المفتاح والاسم والتصنيف مطلوبة");
  if (!/^[a-z0-9_.]+$/.test(key))        throw new Error("المفتاح يجب أن يحتوي أحرف صغيرة ونقاط وأرقام فقط");

  let svgUrl: string | undefined, pngUrl: string | undefined;
  let svgHash: string | undefined, pngHash: string | undefined;

  const svgFile = formData.get("svg") as File | null;
  const pngFile = formData.get("png") as File | null;

  if (svgFile && svgFile.size > 0) {
    const r = await uploadIcon(Buffer.from(await svgFile.arrayBuffer()), svgFile.name);
    svgUrl = r.url; svgHash = r.hash;
  }
  if (pngFile && pngFile.size > 0) {
    const r = await uploadIcon(Buffer.from(await pngFile.arrayBuffer()), pngFile.name);
    pngUrl = r.url; pngHash = r.hash;
  }

  const icon = await IconRepository.create(
    { key, displayName, category, type, svgUrl, pngUrl, svgHash, pngHash, changeNote },
    audit
  );

  // Notify Flutter via Socket.IO
  await notifyIconChange({ type: "icon:updated", payload: { iconId: icon.id, key: icon.key } });

  revalidatePath("/icons");
}

export async function updateIconAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);

  const id          = String(formData.get("id")          || "");
  const displayName = String(formData.get("displayName") || "").trim() || undefined;
  const category    = String(formData.get("category")    || "").trim() || undefined;
  const type        = (formData.get("type") as "svg" | "png" | "both") || undefined;
  const changeNote  = String(formData.get("changeNote")  || "").trim() || undefined;

  if (!id) throw new Error("معرّف الأيقونة مطلوب");

  const existing = await IconRepository.findById(id);
  if (!existing) throw new Error("الأيقونة غير موجودة");

  let svgUrl  = existing.svgUrl  ?? undefined;
  let pngUrl  = existing.pngUrl  ?? undefined;
  let svgHash = existing.svgHash ?? undefined;
  let pngHash = existing.pngHash ?? undefined;

  const svgFile = formData.get("svg") as File | null;
  const pngFile = formData.get("png") as File | null;

  if (svgFile && svgFile.size > 0) {
    if (existing.svgUrl) await deleteIcon(existing.svgUrl);
    const r = await uploadIcon(Buffer.from(await svgFile.arrayBuffer()), svgFile.name);
    svgUrl = r.url; svgHash = r.hash;
  }
  if (pngFile && pngFile.size > 0) {
    if (existing.pngUrl) await deleteIcon(existing.pngUrl);
    const r = await uploadIcon(Buffer.from(await pngFile.arrayBuffer()), pngFile.name);
    pngUrl = r.url; pngHash = r.hash;
  }

  const icon = await IconRepository.update(
    id,
    { displayName, category, type, svgUrl, pngUrl, svgHash, pngHash, changeNote },
    audit
  );

  await notifyIconChange({ type: "icon:updated", payload: { iconId: icon.id, key: icon.key } });

  revalidatePath("/icons");
}

export async function deleteIconAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  const id      = String(formData.get("id") || "");
  if (!id) throw new Error("معرّف الأيقونة مطلوب");
  const icon = await IconRepository.softDelete(id, audit);
  await notifyIconChange({ type: "icon:updated", payload: { iconId: icon.id, key: icon.key } });
  revalidatePath("/icons");
}

export async function restoreIconAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  const id      = String(formData.get("id") || "");
  if (!id) throw new Error("معرّف الأيقونة مطلوب");
  await IconRepository.restore(id, audit);
  revalidatePath("/icons");
}

export async function setEnabledAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  const id      = String(formData.get("id") || "");
  const enabled = formData.get("enabled") === "true";
  if (!id) throw new Error("معرّف الأيقونة مطلوب");
  const icon = await IconRepository.setEnabled(id, enabled, audit);
  await notifyIconChange({ type: "icon:updated", payload: { iconId: icon.id, key: icon.key } });
  revalidatePath("/icons");
}

export async function rollbackIconAction(formData: FormData) {
  const session       = await requireSuperAdmin();
  const audit         = await buildAudit(session);
  const id            = String(formData.get("id")            || "");
  const targetVersion = parseInt(String(formData.get("targetVersion") || "0"), 10);
  if (!id || !targetVersion) throw new Error("معرّف الأيقونة ورقم الإصدار مطلوبان");
  const icon = await IconRepository.rollback(id, targetVersion, audit);
  await notifyIconChange({ type: "icon:updated", payload: { iconId: icon.id, key: icon.key } });
  revalidatePath("/icons");
}

export async function invalidateCacheAction() {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);
  const result  = await IconRepository.invalidateCache(audit);
  // Notify all Flutter clients — they will re-fetch the catalog
  await notifyIconChange({ type: "icon:cache_cleared", payload: result });
  revalidatePath("/icons");
}

export async function seedDefaultIconsAction() {
  const session = await requireSuperAdmin();
  const audit   = await buildAudit(session);

  await IconRepository.bulkCreate(
    ICON_DEFINITIONS.map((def) => ({
      key:         def.key,
      displayName: def.displayName,
      category:    def.category,
      type:        "svg" as const,
      changeNote:  "بذر أولي من الكتالوج",
    })),
    audit
  );

  await notifyIconChange({ type: "icon:cache_cleared", payload: { version: 0, etag: "bulk-seed" } });
  revalidatePath("/icons");
}

export async function bulkUploadAction(formData: FormData) {
  const session  = await requireSuperAdmin();
  const audit    = await buildAudit(session);
  const metaRaw  = String(formData.get("meta") || "[]");

  let metaArray: {
    key: string; displayName: string; category: string;
    type: "svg" | "png" | "both"; changeNote?: string;
  }[];

  try {
    metaArray = JSON.parse(metaRaw);
  } catch {
    throw new Error("بيانات meta ليست JSON صالحًا");
  }

  const inputs = [];
  for (const meta of metaArray) {
    let svgUrl: string | undefined, pngUrl: string | undefined;
    let svgHash: string | undefined, pngHash: string | undefined;

    const svgFile = formData.get(`svg_${meta.key}`) as File | null;
    const pngFile = formData.get(`png_${meta.key}`) as File | null;

    if (svgFile && svgFile.size > 0) {
      const r = await uploadIcon(Buffer.from(await svgFile.arrayBuffer()), svgFile.name);
      svgUrl = r.url; svgHash = r.hash;
    }
    if (pngFile && pngFile.size > 0) {
      const r = await uploadIcon(Buffer.from(await pngFile.arrayBuffer()), pngFile.name);
      pngUrl = r.url; pngHash = r.hash;
    }
    inputs.push({ ...meta, svgUrl, pngUrl, svgHash, pngHash });
  }

  await IconRepository.bulkCreate(inputs, audit);
  await notifyIconChange({ type: "icon:cache_cleared", payload: { version: 0, etag: "bulk-upload" } });
  revalidatePath("/icons");
}
