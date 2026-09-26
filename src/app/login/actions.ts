"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth-mutations";
import { authApi, ApiError } from "@/lib/api-client";

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

  if (!email)    return { error: "البريد الإلكتروني مطلوب", field: "email" };
  if (!password) return { error: "كلمة المرور مطلوبة",      field: "password" };

  // ── Dev-only tracing ─────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    console.log("[login] attempt:", email);
    console.log("[login] EXPRESS_API_URL:", process.env.EXPRESS_API_URL || "http://localhost:4000 (fallback)");
  }

  try {
    // Authenticate against Express backend
    const response = await authApi.login(email, password);

    if (process.env.NODE_ENV !== "production") {
      console.log("[login] success — admin:", response.admin?.email, "role:", response.admin?.role);
    }

    // Store tokens + profile in signed session cookie
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
      if (process.env.NODE_ENV !== "production") {
        console.error("[login] ApiError status:", err.status, "message:", err.message);
      }

      // status 0 = network error (ECONNREFUSED etc.) — wrapped by fetchExpress
      if (err.status === 0) {
        return {
          error: `تعذّر الاتصال بالخادم — تأكد من تشغيل Express Backend على ${process.env.EXPRESS_API_URL || "http://localhost:4000"}`,
          field: "general",
        };
      }
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
          error: "خطأ في الخادم — يرجى المحاولة لاحقًا",
          field: "general",
        };
      }
      return { error: err.message, field: "general" };
    }

    // ── Unexpected non-ApiError ───────────────────────────────────────────
    if (process.env.NODE_ENV !== "production") {
      console.error("[login] unexpected error:", (err as Error)?.message);
    }
    return {
      error: "حدث خطأ غير متوقع — يرجى المحاولة مرة أخرى",
      field: "general",
    };
  }

  // Redirect happens outside try/catch — redirect() throws internally in Next.js
  redirect("/dashboard");
}
