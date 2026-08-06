"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { notificationsApi } from "@/lib/api-client";

export async function sendNotification(formData: FormData) {
  await requireRole("ADMIN");
  const title      = String(formData.get("title") || "").trim();
  const body       = String(formData.get("body") || "").trim();
  const targetType = String(formData.get("targetType") || "ALL") as "ALL" | "USER" | "ROLE" | "AGENCY";
  const targetId   = String(formData.get("targetId") || "").trim() || undefined;

  if (!title || !body) return;

  await notificationsApi.send({ title, body, targetType, targetId });
  revalidatePath("/notifications");
}
