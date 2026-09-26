"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { bannersApi } from "@/lib/api-client";

export async function createBanner(formData: FormData) {
  await requireRole("ADMIN");
  const title    = String(formData.get("title") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const linkUrl  = String(formData.get("linkUrl") || "").trim() || undefined;
  const screen   = String(formData.get("screen") || "").trim() || undefined;
  const startAt  = String(formData.get("startAt") || "").trim() || undefined;
  const endAt    = String(formData.get("endAt") || "").trim() || undefined;

  if (!title || !imageUrl) return;

  await bannersApi.create({
    title, imageUrl, linkUrl, screen,
    position: 9999, // backend will normalize
    enabled: true,
    startAt, endAt,
  });
  revalidatePath("/banners");
}

export async function updateBanner(formData: FormData) {
  await requireRole("ADMIN");
  const id      = String(formData.get("id")      || "");
  const title   = String(formData.get("title")   || "").trim() || undefined;
  const linkUrl = String(formData.get("linkUrl") || "").trim() || undefined;
  const screen  = String(formData.get("screen")  || "").trim() || undefined;
  if (!id) return;
  await bannersApi.update(id, { title, linkUrl, screen });
  revalidatePath("/banners");
}

export async function deleteBanner(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  await bannersApi.delete(id);
  revalidatePath("/banners");
}

export async function toggleBanner(formData: FormData) {
  await requireRole("ADMIN");
  const id      = String(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  await bannersApi.update(id, { enabled });
  revalidatePath("/banners");
}

export async function reorderBanners(formData: FormData) {
  await requireRole("ADMIN");
  const idsRaw = String(formData.get("ids") || "");
  const ids = idsRaw.split(",").filter(Boolean);
  await bannersApi.reorder(ids);
  revalidatePath("/banners");
}
