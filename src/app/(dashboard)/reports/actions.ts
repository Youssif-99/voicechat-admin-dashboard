"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { reportsApi } from "@/lib/api-client";

export async function resolveReport(formData: FormData) {
  await requireRole("MODERATOR");
  const id         = String(formData.get("id"));
  const resolution = String(formData.get("resolution") || "تم اتخاذ الإجراء المناسب");
  await reportsApi.resolve(id, resolution);
  revalidatePath("/reports");
}

export async function dismissReport(formData: FormData) {
  await requireRole("MODERATOR");
  const id     = String(formData.get("id"));
  const reason = String(formData.get("reason") || "البلاغ لا يستوفي المعايير").trim();
  await reportsApi.dismiss(id, reason);
  revalidatePath("/reports");
}
