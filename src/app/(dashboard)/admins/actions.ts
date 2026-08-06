"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { adminsApi } from "@/lib/api-client";
import type { AdminRole } from "@/lib/auth";

export async function createAdmin(formData: FormData) {
  await requireSuperAdmin();

  const name     = String(formData.get("name")     || "").trim();
  const email    = String(formData.get("email")    || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role     = String(formData.get("role")     || "ADMIN") as AdminRole;

  if (!name || !email || password.length < 6) return;

  await adminsApi.create({ name, email, password, role });
  revalidatePath("/admins");
}

export async function updateAdminRole(formData: FormData) {
  await requireSuperAdmin();
  const id   = String(formData.get("id"));
  const role = String(formData.get("role")) as AdminRole;
  await adminsApi.update(id, { role });
  revalidatePath("/admins");
}

export async function deleteAdmin(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id"));
  await adminsApi.delete(id);
  revalidatePath("/admins");
}

export async function resetAdminPassword(formData: FormData) {
  await requireSuperAdmin();
  const id          = String(formData.get("id"));
  const newPassword = String(formData.get("newPassword") || "");
  if (newPassword.length < 6) return;
  await adminsApi.resetPassword(id, newPassword);
  revalidatePath("/admins");
}
