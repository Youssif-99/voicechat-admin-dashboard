"use server";

/**
 * Server Actions for Icon Management — works with app_icons backend API
 *
 * All actions call the backend /api/admin/icons endpoints.
 * Returns ActionResult to prevent page crashes.
 */

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";

// ── Shared Result Type ─────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { success: true; data?: T; error?: never }
  | { success: false; error: string; data?: never };

// ── UPLOAD ─────────────────────────────────────────────────────────────────
// Upload or replace an icon

export async function uploadIconAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();

    // Upload via backend API
    await IconRepository.uploadIcon(formData);

    revalidatePath("/icons");
    return { success: true };
  } catch (err) {
    console.error("[uploadIconAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "فشل رفع الأيقونة",
    };
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────
// Soft delete (marks isActive=false)

export async function deleteIconAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { success: false, error: "معرّف الأيقونة مطلوب" };

    await IconRepository.softDelete(id);

    revalidatePath("/icons");
    return { success: true };
  } catch (err) {
    console.error("[deleteIconAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "فشل حذف الأيقونة",
    };
  }
}

// ── RESTORE TO DEFAULT ─────────────────────────────────────────────────────
// Restore icon to its default URL

export async function restoreToDefaultAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireSuperAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { success: false, error: "معرّف الأيقونة مطلوب" };

    await IconRepository.restoreToDefault(id);

    revalidatePath("/icons");
    return { success: true };
  } catch (err) {
    console.error("[restoreToDefaultAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "فشل استعادة الأيقونة الافتراضية",
    };
  }
}

// ── PUBLISH PENDING ────────────────────────────────────────────────────────
// Publish all pending icons

export async function publishPendingAction(): Promise<ActionResult<{ published: number }>> {
  try {
    await requireSuperAdmin();

    const result = await IconRepository.publishPending();

    revalidatePath("/icons");
    return { success: true, data: result };
  } catch (err) {
    console.error("[publishPendingAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "فشل نشر الأيقونات",
    };
  }
}
