"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-gold text-base-bg font-bold py-3 transition hover:bg-gold-soft disabled:opacity-60"
    >
      {pending ? "جاري الدخول..." : "تسجيل الدخول"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-info/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="seat-ring w-24 mb-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`seat-dot ${i < 14 ? "filled" : ""}`} />
            ))}
          </div>
          <h1 className="font-display font-extrabold text-2xl text-text-primary">
            لوحة تحكم التطبيق
          </h1>
          <p className="text-text-muted text-sm mt-1">
            إدارة الوكالات، الغرف، المستخدمين والمدفوعات
          </p>
        </div>

        <form
          action={formAction}
          className="bg-base-surface border border-base-border rounded-card shadow-card p-6 space-y-4"
        >
          {state?.error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              name="email"
              required
              dir="ltr"
              placeholder="admin@example.com"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              كلمة المرور
            </label>
            <input
              type="password"
              name="password"
              required
              dir="ltr"
              placeholder="••••••••"
              className="w-full rounded-lg bg-base-surface2 border border-base-border px-3 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>

          <SubmitButton />

          <p className="text-xs text-text-muted text-center pt-2">
            يتم التحقق من بيانات الدخول عبر الخادم الرئيسي (Express Backend)
          </p>
        </form>
      </div>
    </div>
  );
}
