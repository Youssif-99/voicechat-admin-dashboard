"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { agenciesApi, ApiError } from "@/lib/api-client";
import { notifyAgency } from "@/lib/notify";

// ── Guards ─────────────────────────────────────────────────────────────────

async function requireAgencyAdmin() {
  return requireRole("ADMIN");
}

async function requireAgencyViewer() {
  return requireRole("SUPPORT");
}

// ── Helper ─────────────────────────────────────────────────────────────────

function revalidate() {
  revalidatePath("/agencies");
  revalidatePath("/dashboard");
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function approveAgency(formData: FormData) {
  await requireAgencyAdmin();
  const id    = String(formData.get("id"));
  const notes = String(formData.get("notes") || "").trim() || undefined;
  await agenciesApi.approve(id, notes);
  await notifyAgency(id, "APPROVED");
  revalidate();
}

export async function rejectAgency(formData: FormData) {
  await requireAgencyAdmin();
  const id     = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim() || undefined;
  await agenciesApi.reject(id, reason);
  await notifyAgency(id, "REJECTED");
  revalidate();
}

export async function suspendAgency(formData: FormData) {
  await requireAgencyAdmin();
  const id     = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim() || undefined;
  await agenciesApi.suspend(id, reason);
  await notifyAgency(id, "SUSPENDED");
  revalidatePath("/agencies");
}

export async function banAgency(formData: FormData) {
  await requireAgencyAdmin();
  const id     = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim() || undefined;
  await agenciesApi.ban(id, reason);
  await notifyAgency(id, "BANNED");
  revalidatePath("/agencies");
}

export async function restoreAgency(formData: FormData) {
  await requireAgencyAdmin();
  const id = String(formData.get("id"));
  await agenciesApi.restore(id);
  await notifyAgency(id, "APPROVED");
  revalidatePath("/agencies");
}

// Alias for backwards compat (previously called reactivateAgency)
export const reactivateAgency = restoreAgency;

export async function updateAgencyLevel(formData: FormData) {
  await requireAgencyAdmin();
  const id             = String(formData.get("id"));
  const level          = String(formData.get("level"));
  const commissionRate = Number(formData.get("commissionRate"));
  await agenciesApi.updateLevel(id, { level, commissionRate });
  revalidatePath("/agencies");
}

export async function createAgencyRequest(formData: FormData) {
  await requireAgencyAdmin();
  const name      = String(formData.get("name")      || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const phone     = String(formData.get("phone")     || "").trim();
  const email     = String(formData.get("email")     || "").trim() || undefined;
  const notes     = String(formData.get("notes")     || "").trim() || undefined;

  if (!name || !ownerName || !phone) return;
  await agenciesApi.create({ name, ownerName, phone, email, notes });
  revalidatePath("/agencies");
}
