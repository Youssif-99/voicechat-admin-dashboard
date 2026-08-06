// ignore_for_file: constant_identifier_names

/// Runtime configuration constants for the icon management system.
/// Override via environment / build config as needed.
abstract final class IconConstants {
  // ── Network ────────────────────────────────────────────────────────────────

  /// Base URL of the admin dashboard API.
  /// Set via --dart-define=ICONS_API_BASE_URL=https://your-domain.com
  static const String apiBaseUrl = String.fromEnvironment(
    'ICONS_API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Public endpoint — no auth required.
  static const String iconsEndpoint = '$apiBaseUrl/api/icons';

  /// How often to poll for catalog changes in the background (while app is open).
  static const Duration refreshInterval = Duration(minutes: 15);

  /// Network timeout for the catalog fetch.
  static const Duration fetchTimeout = Duration(seconds: 15);

  /// Max retries on transient network errors before giving up and using cache.
  static const int maxRetries = 3;

  /// Delay between retries (exponential back-off base).
  static const Duration retryBaseDelay = Duration(seconds: 2);

  // ── Cache ──────────────────────────────────────────────────────────────────

  /// Directory name inside the app's cache directory for stored icon files.
  static const String cacheDir = 'dynamic_icons';

  /// Filename for the persisted catalog JSON (icons list + etag/version).
  static const String catalogCacheFile = 'icon_catalog.json';

  /// Filename for the persisted ETag / version metadata.
  static const String etagCacheFile = 'icon_etag.json';

  /// Maximum number of icon data entries in memory cache (LRU eviction).
  static const int memoryCacheMaxEntries = 200;

  /// Maximum age of a disk-cached icon file before it is re-validated
  /// (even if ETag hasn't changed — safety net for CDN URL rotations).
  static const Duration diskCacheMaxAge = Duration(days: 30);

  // ── Fallback assets ────────────────────────────────────────────────────────
  /// Asset path prefix for bundled fallback SVG icons.
  /// These must be declared in pubspec.yaml: assets/icons/fallback/
  static const String fallbackAssetPrefix = 'assets/icons/fallback/';

  /// Generic fallback icon shown when neither remote nor bundled asset exists.
  static const String genericFallbackAsset = 'assets/icons/fallback/generic.svg';

  // ── Sizing defaults ────────────────────────────────────────────────────────
  static const double defaultIconSize = 24.0;
  static const double navIconSize     = 26.0;
  static const double badgeIconSize   = 16.0;
  static const double giftIconSize    = 48.0;
}
