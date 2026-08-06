import '../core/icon_constants.dart';
import '../data/models/icon_catalog.dart';

/// In-memory LRU cache for icon widget data.
///
/// Stores the resolved "display source" for each icon key so the widget
/// tree never waits on disk I/O after the first render.
///
/// Entry lifecycle:
///   1. Widget requests key K
///   2. Miss → IconService resolves from disk/network, stores result here
///   3. Hit  → return immediately, bump access time (LRU promotion)
///   4. Eviction when size > [IconConstants.memoryCacheMaxEntries]
class IconMemoryCache {
  IconMemoryCache._();
  static final IconMemoryCache instance = IconMemoryCache._();

  // Ordered map — insertion order tracks LRU (oldest first)
  final Map<String, _CacheEntry> _store = {};

  // ── Catalog ───────────────────────────────────────────────────────────────

  /// The currently active catalog — stored here for fast O(1) key lookup.
  IconCatalog? _catalog;
  Map<String, IconModel>? _keyMap;

  void setCatalog(IconCatalog catalog) {
    _catalog = catalog;
    _keyMap  = catalog.toKeyMap();
  }

  IconCatalog? get catalog => _catalog;

  /// Returns the IconModel for [key], or null if not in the loaded catalog.
  IconModel? findModel(String key) => _keyMap?[key];

  // ── Resolved display source ───────────────────────────────────────────────

  /// Returns the cached [IconDisplaySource] for [key], or null on miss.
  IconDisplaySource? get(String key) {
    final entry = _store[key];
    if (entry == null) return null;
    // LRU promotion: remove + re-insert so it becomes most-recent
    _store.remove(key);
    _store[key] = entry.touch();
    return entry.source;
  }

  /// Stores [source] for [key]. Evicts LRU entry if over capacity.
  void put(String key, IconDisplaySource source) {
    // Remove existing entry (avoids duplicate key with old position)
    _store.remove(key);
    _store[key] = _CacheEntry(source: source, accessedAt: DateTime.now());

    if (_store.length > IconConstants.memoryCacheMaxEntries) {
      // Remove the first (least recently used) entry
      _store.remove(_store.keys.first);
    }
  }

  /// Removes the entry for [key].
  void invalidate(String key) => _store.remove(key);

  /// Clears the entire in-memory cache. Called on forced cache invalidation.
  void clearAll() {
    _store.clear();
    _catalog = null;
    _keyMap  = null;
  }

  int get size => _store.length;
}

// ── Supporting types ──────────────────────────────────────────────────────

/// Describes where and how an icon should be rendered.
///
/// Priority: remoteDiskPath > remoteUrl > assetPath > (generic fallback)
class IconDisplaySource {
  /// Absolute path to a locally cached file on disk (highest priority).
  final String? diskPath;

  /// Remote CDN URL (used when diskPath is null).
  final String? remoteUrl;

  /// Bundled asset path (Flutter asset, used as offline fallback).
  final String? assetPath;

  /// True when the source came from the remote catalog (not fallback).
  final bool isRemote;

  const IconDisplaySource({
    this.diskPath,
    this.remoteUrl,
    this.assetPath,
    required this.isRemote,
  });

  /// Bundled-only fallback constructor.
  const IconDisplaySource.bundled(String path)
      : diskPath   = null,
        remoteUrl  = null,
        assetPath  = path,
        isRemote   = false;

  /// Whether there is any source to render.
  bool get hasSource => diskPath != null || remoteUrl != null || assetPath != null;
}

class _CacheEntry {
  final IconDisplaySource source;
  final DateTime accessedAt;

  const _CacheEntry({required this.source, required this.accessedAt});

  _CacheEntry touch() => _CacheEntry(source: source, accessedAt: DateTime.now());
}
