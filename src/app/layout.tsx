import type { Metadata } from "next";
import "./globals.css";
import { FontLoader } from "@/components/FontLoader";

export const metadata: Metadata = {
  title:       "لوحة تحكم التطبيق",
  description: "لوحة إدارة غرف الدردشة الصوتية، الوكالات، المستخدمين والمدفوعات",
  // Next.js 14 App Router serves /app/favicon.ico automatically at /favicon.ico.
  // Declaring it in metadata generates the correct <link rel="icon"> in <head>.
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-body antialiased">
        {/*
          FontLoader MUST live in <body>, not <head>.

          Why:
            In Next.js 14 App Router, JSX inside the literal <head> element is
            server-rendered but NOT hydrated by React. This means any Client
            Component placed inside <head> has its event handlers stripped —
            React receives a plain DOM attribute string (e.g. onload="...") and
            fires the warning:
              "Expected `onLoad` listener to be a function, instead got string."

            Moving FontLoader to <body> keeps it in the React hydration tree so
            onLoad={(e) => {...}} works correctly as a proper function handler.

            The <link> and <preconnect> tags that FontLoader renders are
            automatically hoisted into <head> by React/Next.js — they do not
            need to be placed inside the JSX <head> element explicitly.
        */}
        <FontLoader />
        {children}
      </body>
    </html>
  );
}
