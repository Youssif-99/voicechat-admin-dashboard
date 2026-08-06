import 'dart:async';

import '../cache/asset_disk_cache.dart';
import '../cache/asset_memory_cache.dart';
import '../data/models/asset_model.dart';
import 'asset_remote_data_source.dart';

/// Abstract contract — enables easy mocking in tests.
abstract interface class IAssetRepository {
  /// Loads the asset catalog. Tries remote first, falls back to disk cache.
  /// Never throws — returns null only if both remote and disk fail.
  Future<AssetCatalog?> getCatalog({bool forceRefresh = false});

  /// Downloads and caches a single asset file.
  /// Returns local disk path on success, null on failure.
  Future<String?> ensureFileCached({
    required String hash,
    required String url,
    required String ext,
  });

  /// Clears all caches (memory + disk). Forces re-download on next access.
  Future<void> clearAll();
}

/// Production implementation.
///
/// Cache hierarchy (read order):
///   1. Memory cache (instant)
///   2. Disk cache (fast, survives restarts)
///   3. Remote API (conditional GET with ETag — 304 means disk cache still valid)
///
/// On remote success: persists catalog to disk, updates memory, evicts stale files.
/// On remote failure: uses disk cache → memory cache → returns null (widget shows fallback).
class AssetRepository implements IAssetRepository {
  AssetRepository({
    AssetRemoteDataSource? remote,
    AssetDiskCache?        disk,
    AssetMemoryCache?      memory,
  })  : _remote = remote ?? AssetRemoteDataSource(),
        _disk   = disk   ?? AssetDiskCache.instance,
        _memory = memory ?? AssetMemoryCache.instance;

  final AssetRemoteDataSource _remote;
  final AssetDiskCache        _disk;
  final AssetMemoryCache      _memory;

  // Prevent concurrent catalog fetches
  Completer<AssetCatalog?>? _inflight;

  @override
  Future<AssetCatalog?> getCatalog({bool forceRefresh = false}) async {
    // Memory hit (skip when forcing refresh)
    if (!forceRefresh && _memory.catalog != null) return _memory.catalog;

    // Coalesce concurrent callers
    if (_inflight != null) return _inflight!.future;
    _inflight = Completer<AssetCatalog?>();
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

  Future<AssetCatalog?> _fetchAndCache({required bool forceRefresh}) async {
    final cachedEtag  = forceRefresh ? null : await _disk.loadEtag();
    final fetchResult = await _remote.fetchCatalog(cachedEtag: cachedEtag);

    if (fetchResult is CatalogFetched) {
      await _disk.saveCatalog(fetchResult.catalog);
      _memory.setCatalog(fetchResult.catalog);

      // Evict stale files in background — non-blocking
      final activeHashes = _collectHashes(fetchResult.catalog);
      unawaited(_disk.evictStaleFiles(activeHashes));

      return fetchResult.catalog;
    }

    if (fetchResult is CatalogNotModified) {
      final diskCatalog = await _disk.loadCatalog();
      if (diskCatalog != null) _memory.setCatalog(diskCatalog);
      return diskCatalog ?? _memory.catalog;
    }

    // Error — fall back
    final diskCatalog = await _disk.loadCatalog();
    if (diskCatalog != null) {
      _memory.setCatalog(diskCatalog);
      return diskCatalog;
    }
    return _memory.catalog; // null on cold start with no network
  }

  @override
  Future<String?> ensureFileCached({
    required String hash,
    required String url,
    required String ext,
  }) async {
    final existing = await _disk.getFilePath(hash, ext);
    if (existing != null) return existing;

    final bytes = await _remote.downloadFile(url);
    if (bytes == null) return null;

    return _disk.saveFile(hash, ext, bytes);
  }

  @override
  Future<void> clearAll() async {
    _memory.clearAll();
    await _disk.clearAll();
  }

  Set<String> _collectHashes(AssetCatalog catalog) {
    final hashes = <String>{};
    for (final asset in catalog.assets) {
      if (asset.hash != null) hashes.add(asset.hash!);
    }
    return hashes;
  }
}

// Dart 2.x compat helper
void unawaited(Future<void> future) {
  future.then((_) {}).catchError((_) {});
}
