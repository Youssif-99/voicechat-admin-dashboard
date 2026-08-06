import 'dart:async';

import '../cache/icon_memory_cache.dart';
import '../core/icon_constants.dart';
import '../data/models/icon_catalog.dart';
import '../repository/icon_repository.dart';

/// The public API of the icon system.
///
/// Responsibilities:
///   - Orchestrate startup loading (catalog + file pre-warm)
///   - Provide [resolveSource] for individual icon keys
///   - Schedule background refresh at [IconConstants.refreshInterval]
///   - Notify listeners when the catalog changes
///   - Guarantee the app never crashes from a missing icon
///
/// Dependency injection: construct with a custom [IIconRepository] for tests.
class IconService {
  IconService({IIconRepository? repository})
      : _repo   = repository ?? IconRepository(),
        _memory = IconMemoryCache.instance;

  final IIconRepository _repo;
  final IconMemoryCache _memory;

  Timer? _refreshTimer;
  bool   _initialized = false;

  // ── Listeners ─────────────────────────────────────────────────────────────

  final List<void Function()> _listeners = [];

  void addListener(void Function() l)    => _listeners.add(l);
  void removeListener(void Function() l) => _listeners.remove(l);
  void _notify() { for (final l in _listeners) l(); }

  // ── Initialisation ────────────────────────────────────────────────────────

  /// Must be called once at app startup, before the widget tree mounts.
  ///
  /// 1. Load any disk-cached catalog immediately (zero-flicker first frame)
  /// 2. Fetch from remote in background
  /// 3. Schedule periodic refresh
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // Fast path: warm memory cache from disk so widgets have data on first frame
    await _warmFromDisk();

    // Background remote fetch — don't block app startup
    unawaited(_refresh(silent: true));

    // Schedule periodic background refresh
    _refreshTimer = Timer.periodic(IconConstants.refreshInterval, (_) {
      unawaited(_refresh(silent: true));
    });
  }

  /// Warms the in-memory catalog from the disk cache without hitting the network.
  Future<void> _warmFromDisk() async {
    final catalog = await _repo.getCatalog(forceRefresh: false);
    if (catalog != null) _memory.setCatalog(catalog);
  }

  /// Refreshes the catalog from the remote API.
  /// [silent] = true: swallow errors and notify listeners only on actual change.
  Future<void> _refresh({bool silent = false}) async {
    try {
      final before = _memory.catalog?.etag;
      final catalog = await _repo.getCatalog(forceRefresh: false);
      final after   = catalog?.etag;
      if (catalog != null && after != before) {
        _memory.setCatalog(catalog);
        _notify();
        unawaited(_prewarmIconFiles(catalog));
      }
    } catch (e) {
      if (!silent) rethrow;
    }
  }

  /// Force-refresh: bypasses ETag and downloads a fresh catalog.
  Future<void> forceRefresh() async {
    await _repo.getCatalog(forceRefresh: true);
    _notify();
  }

  // ── Icon resolution ───────────────────────────────────────────────────────

  /// Resolves the [IconDisplaySource] for [key].
  ///
  /// Resolution order:
  ///   1. Memory cache hit
  ///   2. Look up model in catalog → check disk for file
  ///   3. Look up model in catalog → return remote URL (lazy download)
  ///   4. Bundled fallback asset
  ///   5. Generic fallback
  Future<IconDisplaySource> resolveSource(String key) async {
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

  /// Synchronous variant — only checks memory cache.
  /// Returns null on miss (widget will show placeholder while async resolves).
  IconDisplaySource? resolveSourceSync(String key) => _memory.get(key);

  // ── Private helpers ───────────────────────────────────────────────────────

  Future<IconDisplaySource> _resolveFromModel(IconModel model) async {
    // Prefer SVG, fall back to PNG
    final preferSvg = model.type == 'svg' || model.type == 'both';

    if (preferSvg && model.svgUrl != null && model.svgHash != null) {
      final diskPath = await _repo.ensureIconFileCached(
        hash: model.svgHash!,
        url:  model.svgUrl!,
        ext:  'svg',
      );
      if (diskPath != null) {
        return IconDisplaySource(diskPath: diskPath, isRemote: true);
      }
      // File download failed — return URL for NetworkImage fallback
      return IconDisplaySource(remoteUrl: model.svgUrl, isRemote: true);
    }

    if (model.pngUrl != null && model.pngHash != null) {
      final diskPath = await _repo.ensureIconFileCached(
        hash: model.pngHash!,
        url:  model.pngUrl!,
        ext:  'png',
      );
      if (diskPath != null) {
        return IconDisplaySource(diskPath: diskPath, isRemote: true);
      }
      return IconDisplaySource(remoteUrl: model.pngUrl, isRemote: true);
    }

    // No file uploaded yet → bundled fallback
    return _bundledFallback(model.key);
  }

  IconDisplaySource _bundledFallback(String key) {
    final slug = key.replaceAll('.', '_');
    return IconDisplaySource.bundled(
      '${IconConstants.fallbackAssetPrefix}$slug.svg',
    );
  }

  /// Pre-warms the disk cache for all icons in the catalog in the background.
  Future<void> _prewarmIconFiles(IconCatalog catalog) async {
    for (final model in catalog.icons) {
      try {
        if (model.svgHash != null && model.svgUrl != null) {
          final alreadyCached = await _repo.ensureIconFileCached(
            hash: model.svgHash!,
            url:  model.svgUrl!,
            ext:  'svg',
          );
          if (alreadyCached != null) {
            // Update memory entry to use disk path
            _memory.put(
              model.key,
              IconDisplaySource(diskPath: alreadyCached, isRemote: true),
            );
          }
        } else if (model.pngHash != null && model.pngUrl != null) {
          final alreadyCached = await _repo.ensureIconFileCached(
            hash: model.pngHash!,
            url:  model.pngUrl!,
            ext:  'png',
          );
          if (alreadyCached != null) {
            _memory.put(
              model.key,
              IconDisplaySource(diskPath: alreadyCached, isRemote: true),
            );
          }
        }
      } catch (_) {
        // Per-icon failure must not affect the rest
      }
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  void dispose() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
    _listeners.clear();
  }
}
