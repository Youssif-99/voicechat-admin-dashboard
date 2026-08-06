"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { authApi } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";

export type LoginState = {
  error?: string;
  field?: "email" | "password" | "general";
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email    = String(formData.get("email")    || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email) return { error: "البريد الإلكتروني مطلوب", field: "email" };
  if (!password) return { error: "كلمة المرور مطلوبة", field: "password" };

  try {
    // ── Authenticate against Express backend ──────────────────────────────
    const response = await authApi.login(email, password);

    // ── Store tokens + profile in signed session cookie ──────────────────
    await createSession({
      accessToken:  response.accessToken,
      refreshToken: response.refreshToken,
      adminId:      response.admin.id,
      name:         response.admin.name,
      email:        response.admin.email,
      role:         response.admin.role,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return { error: "بيانات الدخول غير صحيحة", field: "general" };
      }
      if (err.status === 429) {
        return {
          error: "محاولات كثيرة — يرجى الانتظار دقيقة ثم المحاولة مرة أخرى",
          field: "general",
        };
      }
      if (err.status >= 500) {
        return {
          error: "تعذّر الاتصال بالخادم — يرجى المحاولة لاحقًا",
          field: "general",
        };
      }
      return { error: err.message, field: "general" };
    }
    // Network error
    return {
      error: "تعذّر الاتصال بالخادم — تأكد من اتصالك بالإنترنت",
      field: "general",
    };
  }

  redirect("/dashboard");
}
