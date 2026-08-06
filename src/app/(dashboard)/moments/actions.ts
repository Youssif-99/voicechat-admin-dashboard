"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { momentsApi } from "@/lib/api-client";

export async function hideMoment(formData: FormData) {
  await requireRole("MODERATOR");
  const id     = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim() || undefined;
  await momentsApi.hide(id, reason);
  revalidatePath("/moments");
}

export async function restoreMoment(formData: FormData) {
  await requireRole("MODERATOR");
  const id = String(formData.get("id"));
  await momentsApi.restore(id);
  revalidatePath("/moments");
}

export async function deleteMoment(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  await momentsApi.delete(id);
  revalidatePath("/moments");
}
