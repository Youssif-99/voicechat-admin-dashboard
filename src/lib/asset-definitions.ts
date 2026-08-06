/**
 * Canonical AppAsset key registry.
 *
 * Key format: snake_case — e.g. "home_icon", "app_logo"
 * These are the keys Flutter's AssetService uses to look up remote assets.
 * Do NOT rename existing keys without a migration — Flutter cache uses these as identifiers.
 */

export type AssetDefinition = {
  key:           string;
  name:          string;
  category:      string;
  categoryLabel: string;
};

export const ASSET_CATEGORIES: Record<string, string> = {
  navigation:    "أيقونات التنقل",
  branding:      "العلامة التجارية",
  social:        "الاجتماعيات والهدايا",
  economy:       "الاقتصاد والمحفظة",
  vip:           "VIP / SVIP",
  agency:        "الوكالات",
  notifications: "الإشعارات",
};

export const ASSET_DEFINITIONS: AssetDefinition[] = [
  // ── Navigation Icons (bottom nav bar) ──────────────────────────────────
  { key: "home_icon",         name: "أيقونة الرئيسية",        category: "navigation",    categoryLabel: "أيقونات التنقل" },
  { key: "moments_icon",      name: "أيقونة اللحظات",         category: "navigation",    categoryLabel: "أيقونات التنقل" },
  { key: "chat_icon",         name: "أيقونة الدردشة",         category: "navigation",    categoryLabel: "أيقونات التنقل" },
  { key: "rooms_icon",        name: "أيقونة الغرف الصوتية",   category: "navigation",    categoryLabel: "أيقونات التنقل" },
  { key: "profile_icon",      name: "أيقونة الملف الشخصي",   category: "navigation",    categoryLabel: "أيقونات التنقل" },
  { key: "settings_icon",     name: "أيقونة الإعدادات",       category: "navigation",    categoryLabel: "أيقونات التنقل" },

  // ── Branding / App Identity ─────────────────────────────────────────────
  { key: "app_logo",          name: "شعار التطبيق",           category: "branding",      categoryLabel: "العلامة التجارية" },
  { key: "splash_logo",       name: "شعار شاشة البداية",      category: "branding",      categoryLabel: "العلامة التجارية" },
  { key: "auth_logo",         name: "شعار شاشة المصادقة",     category: "branding",      categoryLabel: "العلامة التجارية" },
  { key: "app_icon",          name: "أيقونة التطبيق الرئيسية", category: "branding",     categoryLabel: "العلامة التجارية" },
  { key: "dark_logo",         name: "شعار الوضع الداكن",      category: "branding",      categoryLabel: "العلامة التجارية" },
  { key: "light_logo",        name: "شعار الوضع الفاتح",      category: "branding",      categoryLabel: "العلامة التجارية" },

  // ── Social / Gifts ──────────────────────────────────────────────────────
  { key: "gift_icon",         name: "أيقونة الهدايا",         category: "social",        categoryLabel: "الاجتماعيات والهدايا" },
  { key: "notification_icon", name: "أيقونة الإشعارات",       category: "notifications", categoryLabel: "الإشعارات" },

  // ── Economy / Wallet ────────────────────────────────────────────────────
  { key: "wallet_icon",       name: "أيقونة المحفظة",         category: "economy",       categoryLabel: "الاقتصاد والمحفظة" },
  { key: "coins_icon",        name: "أيقونة العملات",         category: "economy",       categoryLabel: "الاقتصاد والمحفظة" },
  { key: "diamonds_icon",     name: "أيقونة الماس",           category: "economy",       categoryLabel: "الاقتصاد والمحفظة" },
  { key: "recharge_icon",     name: "أيقونة الشحن",           category: "economy",       categoryLabel: "الاقتصاد والمحفظة" },

  // ── VIP / SVIP ──────────────────────────────────────────────────────────
  { key: "vip_icon",          name: "أيقونة VIP",             category: "vip",           categoryLabel: "VIP / SVIP" },
  { key: "svip_icon",         name: "أيقونة SVIP",            category: "vip",           categoryLabel: "VIP / SVIP" },
  { key: "vip_badge",         name: "شارة VIP",               category: "vip",           categoryLabel: "VIP / SVIP" },
  { key: "svip_badge",        name: "شارة SVIP",              category: "vip",           categoryLabel: "VIP / SVIP" },
  { key: "vip_crown",         name: "تاج VIP",                category: "vip",           categoryLabel: "VIP / SVIP" },
  { key: "svip_crown",        name: "تاج SVIP",               category: "vip",           categoryLabel: "VIP / SVIP" },

  // ── Agency ──────────────────────────────────────────────────────────────
  { key: "agency_icon",       name: "أيقونة الوكالة",         category: "agency",        categoryLabel: "الوكالات" },
  { key: "agency_badge",      name: "شارة الوكالة",           category: "agency",        categoryLabel: "الوكالات" },
  { key: "agency_verified",   name: "وكالة موثقة",            category: "agency",        categoryLabel: "الوكالات" },
];

/** Returns definitions grouped by category */
export function getAssetsByCategory(): Record<string, AssetDefinition[]> {
  return ASSET_DEFINITIONS.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<string, AssetDefinition[]>);
}
