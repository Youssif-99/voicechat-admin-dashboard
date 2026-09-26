/**
 * /icons — Complete Icon Management System
 *
 * Manages all 52 real application icons organized by feature:
 * - Navigation (4 icons)
 * - Home (3 icons)
 * - Voice Rooms (4 icons)
 * - Room (4 icons)
 * - Profile (5 icons)
 * - Notifications (7 icons)
 * - Agency (5 icons)
 * - Auth (6 icons)
 * - Store (7 icons)
 *
 * All data comes from Prisma via IconRepository.
 * If the DB has no record for an icon → shows empty state with upload option.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { IconRepository } from "@/lib/icon-repository";
import { Header } from "@/components/Header";
import { FeatureSection, PublishButton } from "./components";

export const dynamic = "force-dynamic";

/** All 52 application icons organized by feature */
const ICON_REGISTRY = {
  Navigation: [
    { key: "nav.home", label: "الرئيسية / Home", category: "NAVIGATION" },
    { key: "nav.rooms", label: "الغرف الصوتية / Voice Rooms", category: "NAVIGATION" },
    { key: "nav.moments", label: "اللحظات / Moments", category: "NAVIGATION" },
    { key: "nav.profile", label: "الملف الشخصي / Profile", category: "NAVIGATION" },
  ],
  Home: [
    { key: "home.search", label: "بحث / Search", category: "ACTIONS" },
    { key: "home.notifications", label: "الإشعارات / Notifications", category: "ACTIONS" },
    { key: "home.settings", label: "الإعدادات / Settings", category: "SETTINGS" },
  ],
  "Voice Rooms": [
    { key: "rooms.search", label: "بحث / Search", category: "ACTIONS" },
    { key: "rooms.refresh", label: "تحديث / Refresh", category: "ACTIONS" },
    { key: "rooms.mic", label: "مايكروفون / Microphone", category: "VOICE" },
    { key: "rooms.empty", label: "لا توجد غرف / No Rooms", category: "STATUS" },
  ],
  Room: [
    { key: "room.mic", label: "مايكروفون / Microphone", category: "VOICE" },
    { key: "room.mic_off", label: "كتم / Mute", category: "VOICE" },
    { key: "room.speaker", label: "طلب متحدث / Request Speaker", category: "VOICE" },
    { key: "room.audience", label: "انضم كمستمع / Join Audience", category: "VOICE" },
  ],
  Profile: [
    { key: "profile.copy", label: "نسخ المعرف / Copy ID", category: "ACTIONS" },
    { key: "profile.diamond", label: "ماسة / Diamond", category: "VIP" },
    { key: "profile.level", label: "مستواي / My Level", category: "VIP" },
    { key: "profile.income", label: "دخلي / My Income", category: "WALLET" },
    { key: "profile.badge", label: "شارة / Badge", category: "STATUS" },
  ],
  Notifications: [
    { key: "notifications.back", label: "رجوع / Back", category: "NAVIGATION" },
    { key: "notifications.refresh", label: "تحديث / Refresh", category: "ACTIONS" },
    { key: "notifications.empty", label: "لا توجد إشعارات / No Notifications", category: "STATUS" },
    { key: "notifications.error", label: "خطأ / Error", category: "STATUS" },
    { key: "notifications.gift", label: "هدية / Gift", category: "SOCIAL" },
    { key: "notifications.follow", label: "متابعة / Follow", category: "SOCIAL" },
    { key: "notifications.room_invite", label: "دعوة غرفة / Room Invite", category: "VOICE" },
  ],
  Agency: [
    { key: "agency.back", label: "رجوع / Back", category: "NAVIGATION" },
    { key: "agency.refresh", label: "تحديث / Refresh", category: "ACTIONS" },
    { key: "agency.error", label: "خطأ / Error", category: "STATUS" },
    { key: "agency.empty", label: "لا توجد وكالة / No Agency", category: "STATUS" },
    { key: "agency.create", label: "إنشاء وكالة / Create Agency", category: "ACTIONS" },
  ],
  Auth: [
    { key: "auth.person", label: "الاسم الكامل / Full Name", category: "ACTIONS" },
    { key: "auth.email", label: "البريد الإلكتروني / Email", category: "ACTIONS" },
    { key: "auth.password", label: "كلمة المرور / Password", category: "ACTIONS" },
    { key: "auth.confirm", label: "تأكيد كلمة المرور / Confirm Password", category: "ACTIONS" },
    { key: "auth.google", label: "جوجل / Google", category: "SOCIAL" },
    { key: "auth.apple", label: "أبل / Apple", category: "SOCIAL" },
  ],
  Store: [
    { key: "store.rose", label: "وردة / Rose", category: "STORE" },
    { key: "store.crown", label: "تاج / Crown", category: "STORE" },
    { key: "store.diamond", label: "ماسة / Diamond", category: "STORE" },
    { key: "store.rocket", label: "صاروخ / Rocket", category: "STORE" },
    { key: "store.castle", label: "قصر / Castle", category: "STORE" },
    { key: "store.galaxy", label: "مجرة / Galaxy", category: "STORE" },
    { key: "store.piano", label: "بيانو / Piano", category: "STORE" },
  ],
} as const;

export default async function IconsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  // Load all icons from backend API
  const { icons } = await IconRepository.listAdmin({
    pageSize: 100, // cover all 67+ icons
  });

  // Build lookup map: key → AppIcon
  const iconByKey = Object.fromEntries(icons.map((i) => [i.key, i]));

  // Build sections with their icons
  const sections = Object.entries(ICON_REGISTRY).map(([feature, iconDefs]) => ({
    feature,
    icons: iconDefs.map((def) => ({
      key: def.key,
      label: def.label,
      category: def.category,
      icon: iconByKey[def.key] ?? null,
    })),
  }));

  // Calculate stats
  const totalIcons = Object.values(ICON_REGISTRY).flat().length;
  const uploadedCount = icons.filter(i => i.isActive && i.url && i.url !== i.defaultUrl).length;
  const defaultCount = totalIcons - uploadedCount;
  const pendingCount = icons.filter(i => i.isPending).length;

  return (
    <>
      <Header
        title="إدارة الأيقونات / Icon Management"
        subtitle={`${totalIcons} أيقونة حقيقية منظمة حسب الميزات / ${totalIcons} real icons organized by features`}
        adminName={session.name}
      />

      <div className="p-6 space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-base-surface border border-base-border rounded-xl p-4">
            <p className="text-sm text-text-muted mb-1">إجمالي الأيقونات</p>
            <p className="text-2xl font-bold text-text-primary">{totalIcons}</p>
            <p className="text-xs text-text-muted mt-1">Total Icons</p>
          </div>
          <div className="bg-base-surface border border-base-border rounded-xl p-4">
            <p className="text-sm text-text-muted mb-1">مخصصة</p>
            <p className="text-2xl font-bold text-success">{uploadedCount}</p>
            <p className="text-xs text-text-muted mt-1">Custom</p>
          </div>
          <div className="bg-base-surface border border-base-border rounded-xl p-4">
            <p className="text-sm text-text-muted mb-1">افتراضية</p>
            <p className="text-2xl font-bold text-gold">{defaultCount}</p>
            <p className="text-xs text-text-muted mt-1">Using Default</p>
          </div>
          <div className="bg-base-surface border border-base-border rounded-xl p-4">
            <p className="text-sm text-text-muted mb-1">قيد النشر</p>
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-text-muted mt-1">Pending Publish</p>
          </div>
        </div>

        {/* Publish Pending Button */}
        {pendingCount > 0 && <PublishButton pendingCount={pendingCount} />}

        {/* Icon Sections */}
        {sections.map((section) => (
          <FeatureSection
            key={section.feature}
            feature={section.feature}
            icons={section.icons}
          />
        ))}
      </div>
    </>
  );
}

