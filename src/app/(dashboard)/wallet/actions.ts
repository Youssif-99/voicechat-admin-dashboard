"use server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { walletApi } from "@/lib/api-client";

export async function adjustWallet(formData: FormData) {
  await requireSuperAdmin();
  const userId = String(formData.get("userId"));
  const amount = parseFloat(String(formData.get("amount") || "0"));
  const reason = String(formData.get("reason") || "").trim();
  if (!amount || !reason) return;
  await walletApi.adjustCoins(userId, amount, reason);
  revalidatePath("/wallet");
}
