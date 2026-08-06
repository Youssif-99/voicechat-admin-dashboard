import '../core/asset_constants.dart';
import '../data/models/asset_model.dart';

/// Where and how to render a single asset.
class AssetDisplaySource {
  /// Absolute path to a locally-cached file (highest priority).
  final String? diskPath;

  /// Remote CDN URL — used when diskPath is null.
  final String? remoteUrl;

  /// Bundled Flutter asset path — offline fallback.
  final String? assetPath;

  /// True when the source came from the remote catalog.
  final bool isRemote;

  const AssetDisplaySource({
    this.diskPath,
    this.remoteUrl,
    this.assetPath,
    required this.isRemote,
  });

  const AssetDisplaySource.bundled(String path)
      : diskPath  = null,
        remoteUrl = null,
        assetPath = path,
        isRemote  = false;

  bool get hasSource =>
      diskPath != null || remoteUrl != null || assetPath != null;

  bool get isSvg =>
      (diskPath?.endsWith('.svg') ?? false) ||
      (remoteUrl?.contains('.svg') ?? false) ||
      (assetPath?.endsWith('.svg') ?? false);
}

class _CacheEntry {
  final AssetDisplaySource source;
  final DateTime accessedAt;
  const _CacheEntry({required this.source, required this.accessedAt});
  _CacheEntry touch() => _CacheEntry(source: source, accessedAt: DateTime.now());
}

/// In-memory LRU cache for resolved AssetDisplaySource objects.
class AssetMemoryCache {
  /// Default constructor creates an independent instance for testing.
  AssetMemoryCache();

  // Singleton accessor for production code
  static final AssetMemoryCache instance = AssetMemoryCache._singleton();
  AssetMemoryCache._singleton();

  final Map<String, _CacheEntry> _store = {};

  AssetCatalog?        _catalog;
  Map<String, AssetModel>? _keyMap;

  void setCatalog(AssetCatalog catalog) {
    _catalog = catalog;
    _keyMap  = catalog.toKeyMap();
  }

  AssetCatalog? get catalog => _catalog;

  AssetModel? findModel(String key) => _keyMap?[key];

  AssetDisplaySource? get(String key) {
    final entry = _store[key];
    if (entry == null) return null;
    _store.remove(key);
    _store[key] = entry.touch();
    return entry.source;
  }

  void put(String key, AssetDisplaySource source) {
    _store.remove(key);
    _store[key] = _CacheEntry(source: source, accessedAt: DateTime.now());
    if (_store.length > AssetConstants.memoryCacheMaxEntries) {
      _store.remove(_store.keys.first);
    }
  }

  void invalidate(String key) => _store.remove(key);

  void clearAll() {
    _store.clear();
    _catalog = null;
    _keyMap  = null;
  }

  int get size => _store.length;
}
