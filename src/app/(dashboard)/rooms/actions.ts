"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { roomsApi } from "@/lib/api-client";
import { notifyRoomBanned, notifyRoomDeleted } from "@/lib/notify";

export async function banRoom(formData: FormData) {
  await requireRole("MODERATOR");
  const id     = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim() || undefined;
  await roomsApi.ban(id, reason);
  await notifyRoomBanned(id);
  revalidatePath("/rooms");
}

export async function unbanRoom(formData: FormData) {
  await requireRole("MODERATOR");
  const id = String(formData.get("id"));
  await roomsApi.unban(id);
  revalidatePath("/rooms");
}

export async function updateRoomProfile(formData: FormData) {
  await requireRole("MODERATOR");
  const id       = String(formData.get("id"));
  const name     = String(formData.get("name")     || "").trim();
  const coverUrl = String(formData.get("coverUrl") || "").trim() || undefined;
  if (!name) return;
  await roomsApi.update(id, { name, coverUrl });
  revalidatePath("/rooms");
}

export async function deleteRoom(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  await roomsApi.delete(id);
  await notifyRoomDeleted(id);
  revalidatePath("/rooms");
}

export async function kickUserFromRoom(formData: FormData) {
  await requireRole("MODERATOR");
  const roomId = String(formData.get("roomId"));
  const userId = String(formData.get("userId"));
  await roomsApi.kick(roomId, userId);
  revalidatePath("/rooms");
}
