import 'dart:async';

import '../cache/icon_disk_cache.dart';
import '../cache/icon_memory_cache.dart';
import '../data/models/icon_catalog.dart';
import 'icon_remote_data_source.dart';

/// Abstract contract — enables easy mocking in tests.
abstract interface class IIconRepository {
  /// Loads the icon catalog. Tries remote first, falls back to disk cache.
  /// Never throws — returns null only if both remote and disk fail.
  Future<IconCatalog?> getCatalog({bool forceRefresh = false});

  /// Downloads and caches a single icon file identified by [hash] and [url].
  /// Returns the local disk path on success, null on failure.
  Future<String?> ensureIconFileCached({
    required String hash,
    required String url,
    required String ext,
  });

  /// Clears all caches (memory + disk). Triggers a re-download on next access.
  Future<void> clearAll();
}

/// Production implementation of [IIconRepository].
///
/// Cache hierarchy (read):
///   1. Memory cache (fastest)
///   2. Disk cache (fast, survives restarts)
///   3. Remote API (conditional GET with ETag)
///
/// On a successful remote fetch:
///   - Catalog is written to disk
///   - Memory cache is updated
///   - Stale icon files are evicted
///
/// On any remote failure:
///   - Disk cache is used if available
///   - Memory cache is used if warm
///   - Neither available → returns null (caller uses bundled fallback)
class IconRepository implements IIconRepository {
  IconRepository({
    IconRemoteDataSource? remote,
    IconDiskCache? disk,
    IconMemoryCache? memory,
  })  : _remote = remote ?? IconRemoteDataSource(),
        _disk   = disk   ?? IconDiskCache.instance,
        _memory = memory ?? IconMemoryCache.instance;

  final IconRemoteDataSource _remote;
  final IconDiskCache        _disk;
  final IconMemoryCache      _memory;

  // Prevent concurrent catalog fetches
  Completer<IconCatalog?>? _inflight;

  @override
  Future<IconCatalog?> getCatalog({bool forceRefresh = false}) async {
    // ── 1. Memory hit (only when not forcing refresh) ──────────────────────
    if (!forceRefresh && _memory.catalog != null) {
      return _memory.catalog;
    }

    // ── Coalesce concurrent callers ────────────────────────────────────────
    if (_inflight != null) return _inflight!.future;
    _inflight = Completer<IconCatalog?>();

    try {
      final result = await _fetchAndCache(forceRefresh: forceRefresh);
      _inflight!.complete(result);
      return result;
    } catch (e) {
      _inflight!.completeError(e);
      return null;
    } finally {
      _inflight = null;
    }
  }

  Future<IconCatalog?> _fetchAndCache({required bool forceRefresh}) async {
    // ── 2. Load cached ETag for conditional request ────────────────────────
    final cachedEtag = forceRefresh ? null : await _disk.loadEtag();

    // ── 3. Remote fetch ────────────────────────────────────────────────────
    final fetchResult = await _remote.fetchCatalog(cachedEtag: cachedEtag);

    if (fetchResult is CatalogFetched) {
      // Persist to disk and populate memory cache
      await _disk.saveCatalog(fetchResult.catalog);
      _memory.setCatalog(fetchResult.catalog);

      // Evict icon files that are no longer in the catalog
      final activeHashes = _collectActiveHashes(fetchResult.catalog);
      unawaited(_disk.evictStaleFiles(activeHashes));

      return fetchResult.catalog;
    }

    if (fetchResult is CatalogNotModified) {
      // Use disk cache — it's still valid
      final diskCatalog = await _disk.loadCatalog();
      if (diskCatalog != null) _memory.setCatalog(diskCatalog);
      return diskCatalog ?? _memory.catalog;
    }

    // CatalogFetchError → fall back to disk, then memory
    final diskCatalog = await _disk.loadCatalog();
    if (diskCatalog != null) {
      _memory.setCatalog(diskCatalog);
      return diskCatalog;
    }
    return _memory.catalog; // may be null if cold start with no network
  }

  @override
  Future<String?> ensureIconFileCached({
    required String hash,
    required String url,
    required String ext,
  }) async {
    // Already on disk?
    final existing = await _disk.getIconFilePath(hash, ext);
    if (existing != null) return existing;

    // Download
    final bytes = await _remote.downloadIconFile(url);
    if (bytes == null) return null;

    return _disk.saveIconFile(hash, ext, bytes);
  }

  @override
  Future<void> clearAll() async {
    _memory.clearAll();
    await _disk.clearAll();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Set<String> _collectActiveHashes(IconCatalog catalog) {
    final hashes = <String>{};
    for (final icon in catalog.icons) {
      if (icon.svgHash != null) hashes.add(icon.svgHash!);
      if (icon.pngHash != null) hashes.add(icon.pngHash!);
    }
    return hashes;
  }
}
