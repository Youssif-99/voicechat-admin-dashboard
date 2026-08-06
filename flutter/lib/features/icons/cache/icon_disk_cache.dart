import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/icon_constants.dart';
import '../data/models/icon_catalog.dart';

/// Persisted disk cache for the icon catalog and ETag metadata.
///
/// Layout inside getTemporaryDirectory():
///   dynamic_icons/
///     icon_catalog.json   — full catalog (icons list + etag + version)
///     icon_etag.json      — lightweight {etag, version, savedAt}
///     files/<hash>.svg    — individual downloaded SVG bytes
///     files/<hash>.png    — individual downloaded PNG bytes
///
/// Thread-safety: all public methods are async and operate on isolated
/// file handles; do not share a single instance across isolates.
class IconDiskCache {
  IconDiskCache._();
  static final IconDiskCache instance = IconDiskCache._();

  Directory? _cacheDir;

  /// Resolves and lazily creates the cache directory.
  Future<Directory> _dir() async {
    if (_cacheDir != null) return _cacheDir!;
    final tmp = await getTemporaryDirectory();
    final dir = Directory(p.join(tmp.path, IconConstants.cacheDir));
    await dir.create(recursive: true);
    final filesDir = Directory(p.join(dir.path, 'files'));
    await filesDir.create(recursive: true);
    _cacheDir = dir;
    return dir;
  }

  // ── Catalog ──────────────────────────────────────────────────────────────

  /// Saves the full catalog to disk. Called after a successful remote fetch.
  Future<void> saveCatalog(IconCatalog catalog) async {
    final dir  = await _dir();
    final file = File(p.join(dir.path, IconConstants.catalogCacheFile));
    await file.writeAsString(jsonEncode(catalog.toJson()), flush: true);
    await _saveEtagMeta(catalog.etag, catalog.version);
  }

  /// Loads the catalog from disk, or returns null if none exists / parse fails.
  Future<IconCatalog?> loadCatalog() async {
    try {
      final dir  = await _dir();
      final file = File(p.join(dir.path, IconConstants.catalogCacheFile));
      if (!await file.exists()) return null;
      final raw  = await file.readAsString();
      return IconCatalog.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  // ── ETag metadata ─────────────────────────────────────────────────────────

  Future<void> _saveEtagMeta(String etag, int version) async {
    final dir  = await _dir();
    final file = File(p.join(dir.path, IconConstants.etagCacheFile));
    await file.writeAsString(
      jsonEncode({'etag': etag, 'version': version, 'savedAt': DateTime.now().toIso8601String()}),
      flush: true,
    );
  }

  /// Returns the persisted ETag string, or null if none cached.
  Future<String?> loadEtag() async {
    try {
      final dir  = await _dir();
      final file = File(p.join(dir.path, IconConstants.etagCacheFile));
      if (!await file.exists()) return null;
      final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      return json['etag'] as String?;
    } catch (_) {
      return null;
    }
  }

  // ── Individual icon files ─────────────────────────────────────────────────

  /// Returns the path where a file with [hash] and [ext] would be stored.
  Future<String> _iconFilePath(String hash, String ext) async {
    final dir = await _dir();
    return p.join(dir.path, 'files', '$hash.$ext');
  }

  /// Returns true if a file with this hash is already cached on disk.
  Future<bool> hasIconFile(String hash, String ext) async {
    final path = await _iconFilePath(hash, ext);
    final file = File(path);
    if (!await file.exists()) return false;
    // Staleness guard — remove if too old
    final stat = await file.stat();
    if (DateTime.now().difference(stat.modified) > IconConstants.diskCacheMaxAge) {
      await file.delete();
      return false;
    }
    return true;
  }

  /// Saves downloaded icon bytes. Returns the file path for reading.
  Future<String> saveIconFile(String hash, String ext, List<int> bytes) async {
    final path = await _iconFilePath(hash, ext);
    await File(path).writeAsBytes(bytes, flush: true);
    return path;
  }

  /// Returns the file path if the icon is cached, otherwise null.
  Future<String?> getIconFilePath(String hash, String ext) async {
    final path = await _iconFilePath(hash, ext);
    final file = File(path);
    return (await file.exists()) ? path : null;
  }

  // ── Eviction ──────────────────────────────────────────────────────────────

  /// Removes all cached files. Called on forced cache invalidation.
  Future<void> clearAll() async {
    try {
      final dir = await _dir();
      if (await dir.exists()) await dir.delete(recursive: true);
      _cacheDir = null; // Force re-create on next access
    } catch (_) {}
  }

  /// Removes icon files whose hashes are not in [activeHashes].
  /// Keeps catalog and etag files. Called after a successful refresh
  /// to evict stale entries and reclaim disk space.
  Future<void> evictStaleFiles(Set<String> activeHashes) async {
    try {
      final dir      = await _dir();
      final filesDir = Directory(p.join(dir.path, 'files'));
      if (!await filesDir.exists()) return;
      await for (final entity in filesDir.list()) {
        if (entity is File) {
          final nameNoExt = p.basenameWithoutExtension(entity.path);
          if (!activeHashes.contains(nameNoExt)) {
            await entity.delete();
          }
        }
      }
    } catch (_) {}
  }
}
