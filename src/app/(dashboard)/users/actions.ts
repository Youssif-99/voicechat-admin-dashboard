"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { usersApi } from "@/lib/api-client";
import { notifyUserBanned, notifyUserUnbanned, notifyVipChange } from "@/lib/notify";

function revalidate() {
  revalidatePath("/users");
  revalidatePath("/dashboard");
}

export async function banUser(formData: FormData) {
  await requireRole("MODERATOR");
  const id        = String(formData.get("id"));
  const banType   = String(formData.get("banType"));
  const banReason = String(formData.get("banReason") || "").trim() || undefined;
  await usersApi.ban(id, { banType, banReason });
  await notifyUserBanned(id, banType);
  revalidate();
}

export async function unbanUser(formData: FormData) {
  await requireRole("MODERATOR");
  const id = String(formData.get("id"));
  await usersApi.unban(id);
  await notifyUserUnbanned(id);
  revalidate();
}

export async function updateUserProfile(formData: FormData) {
  await requireRole("MODERATOR");
  const id          = String(formData.get("id"));
  const displayName = String(formData.get("displayName") || "").trim();
  const avatarUrl   = String(formData.get("avatarUrl")   || "").trim() || undefined;
  if (!displayName) return;
  await usersApi.update(id, { displayName, avatarUrl });
  revalidatePath("/users");
}

export async function setUserVip(formData: FormData) {
  await requireRole("ADMIN");
  const id       = String(formData.get("id"));
  const vipLevel = parseInt(String(formData.get("vipLevel") || "0"), 10);
  await usersApi.setVip(id, vipLevel);
  await notifyVipChange(id, vipLevel);
  revalidatePath("/users");
}

export async function setUserSvip(formData: FormData) {
  await requireRole("ADMIN");
  const id        = String(formData.get("id"));
  const svipLevel = parseInt(String(formData.get("svipLevel") || "0"), 10);
  await usersApi.setSvip(id, svipLevel);
  revalidatePath("/users");
}
