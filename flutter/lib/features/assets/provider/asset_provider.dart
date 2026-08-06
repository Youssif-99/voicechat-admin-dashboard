import 'package:flutter/foundation.dart';

import '../cache/asset_memory_cache.dart';
import '../service/asset_service.dart';

export '../cache/asset_memory_cache.dart' show AssetDisplaySource;

/// [ChangeNotifier] that bridges [AssetService] to the Flutter widget tree.
///
/// - Created at app startup
/// - [initialize()] warms disk cache and starts background fetch
/// - [notifyListeners()] fires whenever the catalog changes (remote update or Socket.IO event)
/// - All widgets use [resolveSource] / [resolveSourceSync] — never crash, always fallback
class AssetProvider extends ChangeNotifier {
  AssetProvider({AssetService? service})
      : _service = service ?? AssetService() {
    _service.addListener(_onCatalogChanged);
  }

  final AssetService _service;

  bool    _isInitialized = false;
  bool    _isLoading     = false;
  String? _error;

  bool    get isInitialized => _isInitialized;
  bool    get isLoading     => _isLoading;
  String? get error         => _error;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  Future<void> initialize() async {
    if (_isInitialized) return;
    _isLoading = true;
    notifyListeners();
    try {
      await _service.initialize();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading     = false;
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Force-refresh the catalog (called on Socket.IO asset:updated / asset:cache_cleared).
  Future<void> refresh() async {
    _isLoading = true;
    notifyListeners();
    try {
      await _service.forceRefresh();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Resolution ─────────────────────────────────────────────────────────────

  Future<AssetDisplaySource> resolveSource(String key) =>
      _service.resolveSource(key);

  AssetDisplaySource? resolveSourceSync(String key) =>
      _service.resolveSourceSync(key);

  // ── Private ────────────────────────────────────────────────────────────────

  void _onCatalogChanged() => notifyListeners();

  @override
  void dispose() {
    _service.removeListener(_onCatalogChanged);
    _service.dispose();
    super.dispose();
  }
}
