"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { vipApi } from "@/lib/api-client";

export async function grantVip(formData: FormData) {
  await requireRole("ADMIN");
  const userId      = String(formData.get("userId"));
  const level       = parseInt(String(formData.get("level") || "1"), 10);
  const durationRaw = formData.get("durationDays");
  const durationDays = durationRaw ? parseInt(String(durationRaw), 10) : undefined;
  await vipApi.grant(userId, level, durationDays);
  revalidatePath("/vip");
}

export async function revokeVip(formData: FormData) {
  await requireRole("ADMIN");
  const userId = String(formData.get("userId"));
  await vipApi.revoke(userId);
  revalidatePath("/vip");
}
