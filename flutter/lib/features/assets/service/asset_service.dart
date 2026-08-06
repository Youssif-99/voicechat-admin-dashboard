import 'dart:async';

import '../cache/asset_memory_cache.dart';
import '../core/asset_constants.dart';
import '../data/models/asset_model.dart';
import '../repository/asset_repository.dart';

/// The public API of the AppAsset system.
///
/// Responsibilities:
///   - Orchestrate startup loading (catalog + background file pre-warm)
///   - Resolve [AssetDisplaySource] for any asset key
///   - Schedule periodic background refresh
///   - Notify listeners on catalog change
///   - NEVER crash — always returns a valid fallback source
///
/// Dependency-injection friendly: pass a custom [IAssetRepository] for tests.
class AssetService {
  AssetService({IAssetRepository? repository, AssetMemoryCache? memoryCache})
      : _repo   = repository ?? AssetRepository(),
        _memory = memoryCache ?? AssetMemoryCache.instance;

  final IAssetRepository _repo;
  final AssetMemoryCache _memory;

  Timer? _refreshTimer;
  bool   _initialized = false;

  // ── Listeners ─────────────────────────────────────────────────────────────

  final List<void Function()> _listeners = [];
  void addListener(void Function() l)    => _listeners.add(l);
  void removeListener(void Function() l) => _listeners.remove(l);
  void _notify() { for (final l in _listeners) { try { l(); } catch (_) {} } }

  // ── Initialisation ────────────────────────────────────────────────────────

  /// Call once at app startup (before widget tree mounts).
  ///
  /// 1. Warm memory cache from disk immediately (zero-flicker first frame)
  /// 2. Kick off background remote fetch
  /// 3. Start periodic background refresh timer
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // Fast path — disk cache → memory (no network, instant)
    await _warmFromDisk();

    // Background remote fetch — non-blocking
    _refresh(silent: true).then((_) {}).catchError((_) {});

    // Periodic refresh
    _refreshTimer = Timer.periodic(AssetConstants.refreshInterval, (_) {
      _refresh(silent: true).then((_) {}).catchError((_) {});
    });
  }

  Future<void> _warmFromDisk() async {
    final catalog = await _repo.getCatalog(forceRefresh: false);
    if (catalog != null) _memory.setCatalog(catalog);
  }

  Future<void> _refresh({bool silent = false}) async {
    try {
      final before  = _memory.catalog?.etag;
      final catalog = await _repo.getCatalog(forceRefresh: false);
      final after   = catalog?.etag;
      if (catalog != null && after != before) {
        _memory.setCatalog(catalog);
        _notify();
        // Pre-warm files in the background
        _prewarmFiles(catalog).then((_) {}).catchError((_) {});
      }
    } catch (e) {
      if (!silent) rethrow;
    }
  }

  /// Force-refresh: bypasses ETag and downloads a fresh catalog.
  /// Called when Socket.IO emits asset:updated or asset:cache_cleared.
  Future<void> forceRefresh() async {
    // Clear memory entries so fresh sources are resolved
    _memory.clearAll();
    await _repo.getCatalog(forceRefresh: true);
    _notify();
  }

  // ── Asset resolution ───────────────────────────────────────────────────────

  /// Returns the [AssetDisplaySource] for [key].
  ///
  /// Resolution order:
  ///   1. Memory cache hit (instant)
  ///   2. Catalog lookup → disk file
  ///   3. Catalog lookup → remote URL (lazy download)
  ///   4. Bundled fallback asset (app bundle)
  ///   5. Generic fallback
  Future<AssetDisplaySource> resolveSource(String key) async {
    // 1. Memory hit
    final cached = _memory.get(key);
    if (cached != null) return cached;

    // 2 & 3. Catalog lookup
    final model = _memory.findModel(key);
    if (model != null) {
      final source = await _resolveFromModel(model);
      _memory.put(key, source);
      return source;
    }

    // 4. Bundled fallback
    final bundled = _bundledFallback(key);
    _memory.put(key, bundled);
    return bundled;
  }

  /// Synchronous variant — only memory cache.
  /// Returns null on miss (widget shows placeholder while async resolves).
  AssetDisplaySource? resolveSourceSync(String key) => _memory.get(key);

  // ── Private helpers ────────────────────────────────────────────────────────

  Future<AssetDisplaySource> _resolveFromModel(AssetModel model) async {
    if (model.imageUrl == null || model.hash == null) {
      return _bundledFallback(model.key);
    }

    final ext = _extFromMime(model.mimeType);

    final diskPath = await _repo.ensureFileCached(
      hash: model.hash!,
      url:  model.imageUrl!,
      ext:  ext,
    );

    if (diskPath != null) {
      return AssetDisplaySource(diskPath: diskPath, isRemote: true);
    }

    // File download failed — use remote URL directly
    return AssetDisplaySource(remoteUrl: model.imageUrl, isRemote: true);
  }

  AssetDisplaySource _bundledFallback(String key) {
    return AssetDisplaySource.bundled(
      '${AssetConstants.fallbackAssetPrefix}$key.png',
    );
  }

  Future<void> _prewarmFiles(AssetCatalog catalog) async {
    for (final model in catalog.assets) {
      if (model.imageUrl == null || model.hash == null) continue;
      try {
        final ext      = _extFromMime(model.mimeType);
        final diskPath = await _repo.ensureFileCached(
          hash: model.hash!,
          url:  model.imageUrl!,
          ext:  ext,
        );
        if (diskPath != null) {
          _memory.put(model.key, AssetDisplaySource(diskPath: diskPath, isRemote: true));
        }
      } catch (_) {
        // Per-asset failure must not affect others
      }
    }
  }

  String _extFromMime(String? mime) {
    if (mime == null) return 'png';
    if (mime.contains('svg'))  return 'svg';
    if (mime.contains('webp')) return 'webp';
    if (mime.contains('jpeg') || mime.contains('jpg')) return 'jpg';
    return 'png';
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  void dispose() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
    _listeners.clear();
  }
}
