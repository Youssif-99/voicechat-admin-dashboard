"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { storeApi } from "@/lib/api-client";

export async function createStoreItem(formData: FormData) {
  await requireRole("ADMIN");
  const name        = String(formData.get("name") || "").trim();
  const type        = String(formData.get("type") || "") as "FRAME" | "BUBBLE" | "ENTRANCE" | "COIN_BUNDLE" | "GIFT" | "BADGE";
  const price       = parseFloat(String(formData.get("price") || "0"));
  const currency    = String(formData.get("currency") || "COIN") as "COIN" | "USD";
  const imageUrl    = String(formData.get("imageUrl") || "").trim() || undefined;
  const iconKey     = String(formData.get("iconKey") || "").trim() || undefined;
  const description = String(formData.get("description") || "").trim() || undefined;
  if (!name || !type || !price) return;
  await storeApi.create({ name, type, price, currency, imageUrl, iconKey, description, enabled: true, featured: false, sortOrder: 9999 });
  revalidatePath("/store");
}

export async function deleteStoreItem(formData: FormData) {
  await requireRole("ADMIN");
  await storeApi.delete(String(formData.get("id")));
  revalidatePath("/store");
}

export async function toggleItemEnabled(formData: FormData) {
  await requireRole("ADMIN");
  const id      = String(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  await storeApi.update(id, { enabled });
  revalidatePath("/store");
}
