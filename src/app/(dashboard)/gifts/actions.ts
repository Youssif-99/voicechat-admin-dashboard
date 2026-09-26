"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { giftsApi } from "@/lib/api-client";
import { uploadAsset } from "@/lib/asset-storage";

export async function createGift(formData: FormData) {
  await requireRole("ADMIN");
  const name         = String(formData.get("name")         || "").trim();
  const nameAr       = String(formData.get("nameAr")       || "").trim() || name;
  const category     = String(formData.get("category")     || "regular").trim();
  const coinValue    = parseInt(String(formData.get("coinValue") || "0"), 10);
  const isVipOnly    = formData.get("isVipOnly") === "true";
  const isLegendary  = formData.get("isLegendary") === "true";
  const comboCount   = parseInt(String(formData.get("comboCount") || "3"), 10);
  const minTier      = String(formData.get("minTier") || "").trim() || undefined;
  const durationMs   = parseInt(String(formData.get("durationMs") || "3000"), 10);
  const scale        = parseFloat(String(formData.get("scale") || "1.0"));
  const sortOrder    = parseInt(String(formData.get("sortOrder") || "0"), 10);

  let animationUrl   = String(formData.get("animationUrl") || "").trim();
  let imageUrl       = String(formData.get("imageUrl")     || "").trim();

  // Handle uploaded animation file if provided
  const animationFile = formData.get("animationFile") as File | null;
  if (animationFile && animationFile.size > 0) {
    try {
      const buffer = Buffer.from(await animationFile.arrayBuffer());
      const uploadRes = await uploadAsset(buffer, animationFile.name);
      animationUrl = uploadRes.imageUrl;
    } catch (err) {
      console.error("[createGift] Failed to upload animation file:", err);
    }
  }

  // Handle uploaded thumbnail file if provided
  const thumbnailFile = formData.get("thumbnailFile") as File | null;
  if (thumbnailFile && thumbnailFile.size > 0) {
    try {
      const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const uploadRes = await uploadAsset(buffer, thumbnailFile.name);
      imageUrl = uploadRes.thumbnailUrl || uploadRes.imageUrl;
    } catch (err) {
      console.error("[createGift] Failed to upload thumbnail file:", err);
    }
  }

  if (!name || coinValue <= 0) return;

  await giftsApi.create({
    name,
    nameAr,
    category,
    coinValue,
    imageUrl,
    thumbnailUrl: imageUrl,
    animationUrl,
    enabled: true,
    isVipOnly,
    isLegendary,
    comboCount,
    minTier,
    durationMs,
    scale,
    sortOrder,
  });

  revalidatePath("/gifts");
}

export async function updateGift(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const name        = formData.has("name") ? String(formData.get("name") || "").trim() : undefined;
  const nameAr      = formData.has("nameAr") ? String(formData.get("nameAr") || "").trim() : undefined;
  const category    = formData.has("category") ? String(formData.get("category") || "").trim() : undefined;
  const coinValue   = formData.has("coinValue") ? parseInt(String(formData.get("coinValue") || "0"), 10) : undefined;
  const isVipOnly   = formData.has("isVipOnly") ? formData.get("isVipOnly") === "true" : undefined;
  const isLegendary = formData.has("isLegendary") ? formData.get("isLegendary") === "true" : undefined;
  const comboCount  = formData.has("comboCount") ? parseInt(String(formData.get("comboCount") || "3"), 10) : undefined;
  const minTier     = formData.has("minTier") ? (String(formData.get("minTier") || "").trim() || null) : undefined;
  const durationMs  = formData.has("durationMs") ? parseInt(String(formData.get("durationMs") || "3000"), 10) : undefined;
  const scale       = formData.has("scale") ? parseFloat(String(formData.get("scale") || "1.0")) : undefined;
  const sortOrder   = formData.has("sortOrder") ? parseInt(String(formData.get("sortOrder") || "0"), 10) : undefined;
  const enabled     = formData.has("enabled") ? formData.get("enabled") === "true" : undefined;

  let animationUrl = formData.has("animationUrl") ? String(formData.get("animationUrl") || "").trim() : undefined;
  let imageUrl     = formData.has("imageUrl") ? String(formData.get("imageUrl") || "").trim() : undefined;

  const animationFile = formData.get("animationFile") as File | null;
  if (animationFile && animationFile.size > 0) {
    try {
      const buffer = Buffer.from(await animationFile.arrayBuffer());
      const uploadRes = await uploadAsset(buffer, animationFile.name);
      animationUrl = uploadRes.imageUrl;
    } catch (err) {
      console.error("[updateGift] Failed to upload animation file:", err);
    }
  }

  const thumbnailFile = formData.get("thumbnailFile") as File | null;
  if (thumbnailFile && thumbnailFile.size > 0) {
    try {
      const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
      const uploadRes = await uploadAsset(buffer, thumbnailFile.name);
      imageUrl = uploadRes.thumbnailUrl || uploadRes.imageUrl;
    } catch (err) {
      console.error("[updateGift] Failed to upload thumbnail file:", err);
    }
  }

  await giftsApi.update(id, {
    name,
    nameAr,
    category,
    coinValue,
    imageUrl,
    thumbnailUrl: imageUrl,
    animationUrl,
    enabled,
    isVipOnly,
    isLegendary,
    comboCount,
    minTier,
    durationMs,
    scale,
    sortOrder,
  });

  revalidatePath("/gifts");
}

export async function deleteGift(formData: FormData) {
  await requireRole("ADMIN");
  await giftsApi.delete(String(formData.get("id")));
  revalidatePath("/gifts");
}

export async function toggleGiftEnabled(formData: FormData) {
  await requireRole("ADMIN");
  const id      = String(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  await giftsApi.update(id, { enabled });
  revalidatePath("/gifts");
}
