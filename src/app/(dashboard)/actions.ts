"use server";

import { redirect } from "next/navigation";
import { destroySession, getSession } from "@/lib/auth";
import { authApi } from "@/lib/api-client";

export async function logoutAction() {
  // Tell Express to invalidate the refresh token server-side
  try {
    await authApi.logout();
  } catch {
    // Ignore — we always clear local session
  }
  await destroySession();
  redirect("/login");
}
