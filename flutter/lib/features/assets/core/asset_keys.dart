// ignore_for_file: constant_identifier_names

/// Typed registry of every AppAsset key used in the application.
/// Mirrors ASSET_DEFINITIONS in asset-definitions.ts — update both when adding keys.
///
/// Key format: snake_case — e.g. "home_icon", "app_logo"
///
/// Usage:
///   DynamicAsset(assetKey: AssetKeys.homeIcon)
abstract final class AssetKeys {
  // ── Navigation Icons ───────────────────────────────────────────────────────
  static const String homeIcon     = 'home_icon';
  static const String momentsIcon  = 'moments_icon';
  static const String chatIcon     = 'chat_icon';
  static const String roomsIcon    = 'rooms_icon';
  static const String profileIcon  = 'profile_icon';
  static const String settingsIcon = 'settings_icon';

  // ── Branding / App Identity ────────────────────────────────────────────────
  static const String appLogo    = 'app_logo';
  static const String splashLogo = 'splash_logo';
  static const String authLogo   = 'auth_logo';
  static const String appIcon    = 'app_icon';
  static const String darkLogo   = 'dark_logo';
  static const String lightLogo  = 'light_logo';

  // ── Social / Gifts ─────────────────────────────────────────────────────────
  static const String giftIcon         = 'gift_icon';
  static const String notificationIcon = 'notification_icon';

  // ── Economy / Wallet ───────────────────────────────────────────────────────
  static const String walletIcon   = 'wallet_icon';
  static const String coinsIcon    = 'coins_icon';
  static const String diamondsIcon = 'diamonds_icon';
  static const String rechargeIcon = 'recharge_icon';

  // ── VIP / SVIP ─────────────────────────────────────────────────────────────
  static const String vipIcon   = 'vip_icon';
  static const String svipIcon  = 'svip_icon';
  static const String vipBadge  = 'vip_badge';
  static const String svipBadge = 'svip_badge';
  static const String vipCrown  = 'vip_crown';
  static const String svipCrown = 'svip_crown';

  // ── Agency ─────────────────────────────────────────────────────────────────
  static const String agencyIcon     = 'agency_icon';
  static const String agencyBadge    = 'agency_badge';
  static const String agencyVerified = 'agency_verified';

  /// All defined keys — used for pre-warming and validation.
  static const List<String> all = [
    homeIcon, momentsIcon, chatIcon, roomsIcon, profileIcon, settingsIcon,
    appLogo, splashLogo, authLogo, appIcon, darkLogo, lightLogo,
    giftIcon, notificationIcon,
    walletIcon, coinsIcon, diamondsIcon, rechargeIcon,
    vipIcon, svipIcon, vipBadge, svipBadge, vipCrown, svipCrown,
    agencyIcon, agencyBadge, agencyVerified,
  ];
}
