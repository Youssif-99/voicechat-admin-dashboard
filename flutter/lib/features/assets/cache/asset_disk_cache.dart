import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/asset_constants.dart';
import '../data/models/asset_model.dart';

/// Persisted disk cache for the AppAsset catalog and individual asset files.
///
/// Layout inside getTemporaryDirectory():
///   dynamic_assets/
///     asset_catalog.json   — full catalog (assets list + etag + version)
///     asset_etag.json      — lightweight {etag, version, savedAt}
///     files/<hash>.<ext>   — individual downloaded asset files
class AssetDiskCache {
  AssetDiskCache._();
  static final AssetDiskCache instance = AssetDiskCache._();

  Directory? _cacheDir;

  Future<Directory> _dir() async {
    if (_cacheDir != null) return _cacheDir!;
    final tmp = await getTemporaryDirectory();
    final dir = Directory(p.join(tmp.path, AssetConstants.cacheDir));
    await dir.create(recursive: true);
    await Directory(p.join(dir.path, 'files')).create(recursive: true);
    _cacheDir = dir;
    return dir;
  }

  // ── Catalog ──────────────────────────────────────────────────────────────

  Future<void> saveCatalog(AssetCatalog catalog) async {
    final dir  = await _dir();
    final file = File(p.join(dir.path, AssetConstants.catalogCacheFile));
    await file.writeAsString(jsonEncode(catalog.toJson()), flush: true);
    await _saveEtagMeta(catalog.etag, catalog.version);
  }

  Future<AssetCatalog?> loadCatalog() async {
    try {
      final dir  = await _dir();
      final file = File(p.join(dir.path, AssetConstants.catalogCacheFile));
      if (!await file.exists()) return null;
      final raw = await file.readAsString();
      return AssetCatalog.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  // ── ETag ──────────────────────────────────────────────────────────────────

  Future<void> _saveEtagMeta(String etag, int version) async {
    final dir  = await _dir();
    final file = File(p.join(dir.path, AssetConstants.etagCacheFile));
    await file.writeAsString(
      jsonEncode({'etag': etag, 'version': version, 'savedAt': DateTime.now().toIso8601String()}),
      flush: true,
    );
  }

  Future<String?> loadEtag() async {
    try {
      final dir  = await _dir();
      final file = File(p.join(dir.path, AssetConstants.etagCacheFile));
      if (!await file.exists()) return null;
      final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      return json['etag'] as String?;
    } catch (_) {
      return null;
    }
  }

  // ── Individual asset files ────────────────────────────────────────────────

  Future<String> _filePath(String hash, String ext) async {
    final dir = await _dir();
    return p.join(dir.path, 'files', '$hash.$ext');
  }

  Future<bool> hasFile(String hash, String ext) async {
    final path = await _filePath(hash, ext);
    final file = File(path);
    if (!await file.exists()) return false;
    final stat = await file.stat();
    if (DateTime.now().difference(stat.modified) > AssetConstants.diskCacheMaxAge) {
      await file.delete();
      return false;
    }
    return true;
  }

  Future<String> saveFile(String hash, String ext, List<int> bytes) async {
    final path = await _filePath(hash, ext);
    await File(path).writeAsBytes(bytes, flush: true);
    return path;
  }

  Future<String?> getFilePath(String hash, String ext) async {
    final path = await _filePath(hash, ext);
    return (await File(path).exists()) ? path : null;
  }

  // ── Eviction ──────────────────────────────────────────────────────────────

  Future<void> clearAll() async {
    try {
      final dir = await _dir();
      if (await dir.exists()) await dir.delete(recursive: true);
      _cacheDir = null;
    } catch (_) {}
  }

  Future<void> evictStaleFiles(Set<String> activeHashes) async {
    try {
      final dir      = await _dir();
      final filesDir = Directory(p.join(dir.path, 'files'));
      if (!await filesDir.exists()) return;
      await for (final entity in filesDir.list()) {
        if (entity is File) {
          final nameNoExt = p.basenameWithoutExtension(entity.path);
          if (!activeHashes.contains(nameNoExt)) await entity.delete();
        }
      }
    } catch (_) {}
  }
}
