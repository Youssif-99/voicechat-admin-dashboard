"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { giftsApi } from "@/lib/api-client";

export async function createGift(formData: FormData) {
  await requireRole("ADMIN");
  const name         = String(formData.get("name")         || "").trim();
  const category     = String(formData.get("category")     || "").trim();
  const coinValue    = parseInt(String(formData.get("coinValue") || "0"), 10);
  const iconKey      = String(formData.get("iconKey")      || "").trim() || undefined;
  const imageUrl     = String(formData.get("imageUrl")     || "").trim() || undefined;
  const animationUrl = String(formData.get("animationUrl") || "").trim() || undefined;
  if (!name || !category || !coinValue) return;
  await giftsApi.create({ name, category, coinValue, iconKey, imageUrl, animationUrl, enabled: true, sortOrder: 9999 });
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
