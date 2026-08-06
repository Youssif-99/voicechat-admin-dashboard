// ignore_for_file: constant_identifier_names

/// Runtime configuration for the AppAsset management system.
/// Override via --dart-define at build time.
abstract final class AssetConstants {
  // ── Network ────────────────────────────────────────────────────────────────

  /// Base URL of the admin dashboard (Next.js).
  /// Set via --dart-define=ASSETS_API_BASE_URL=https://your-domain.com
  static const String apiBaseUrl = String.fromEnvironment(
    'ASSETS_API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Public endpoint — no auth required.
  static const String assetsEndpoint = '$apiBaseUrl/api/assets';

  /// Per-key endpoint prefix.
  static const String assetKeyEndpoint = '$apiBaseUrl/api/assets';

  /// How often to poll for catalog changes while the app is open.
  static const Duration refreshInterval = Duration(minutes: 15);

  /// Network timeout for the catalog fetch.
  static const Duration fetchTimeout = Duration(seconds: 15);

  /// Max retries on transient network errors before falling back to cache.
  static const int maxRetries = 3;

  /// Exponential back-off base delay.
  static const Duration retryBaseDelay = Duration(seconds: 2);

  // ── Cache ──────────────────────────────────────────────────────────────────

  /// Directory name inside getTemporaryDirectory() for stored asset files.
  static const String cacheDir = 'dynamic_assets';

  /// Filename for the persisted catalog JSON.
  static const String catalogCacheFile = 'asset_catalog.json';

  /// Filename for the persisted ETag metadata.
  static const String etagCacheFile = 'asset_etag.json';

  /// Max in-memory cache entries (LRU eviction).
  static const int memoryCacheMaxEntries = 100;

  /// Max age of a disk-cached asset file before forced re-validation.
  static const Duration diskCacheMaxAge = Duration(days: 30);

  // ── Fallback assets ────────────────────────────────────────────────────────

  /// Bundled fallback image path prefix.
  /// Key "home_icon" → assets/assets/fallback/home_icon.png
  static const String fallbackAssetPrefix = 'assets/assets/fallback/';

  /// Generic fallback shown when neither remote nor bundled asset is found.
  static const String genericFallbackAsset = 'assets/assets/fallback/generic.png';

  // ── Display defaults ───────────────────────────────────────────────────────

  static const double defaultAssetSize = 24.0;
  static const double navAssetSize     = 26.0;
  static const double logoAssetSize    = 64.0;
  static const double splashAssetSize  = 120.0;
}
