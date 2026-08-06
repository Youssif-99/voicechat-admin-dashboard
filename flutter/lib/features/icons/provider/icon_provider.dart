import 'package:flutter/foundation.dart';

import '../cache/icon_memory_cache.dart';
import '../service/icon_service.dart';

/// [ChangeNotifier] that bridges [IconService] to the Flutter widget tree.
///
/// Lifecycle:
///   1. Created by [IconProviderScope] at app startup
///   2. [initialize()] loads disk cache → fetches remote in background
///   3. [notifyListeners()] is called whenever the catalog changes
///   4. Widgets use [resolveSource] / [resolveSourceSync] to render icons
///
/// The provider NEVER causes a layout error. On any failure it returns
/// a [IconDisplaySource.bundled] fallback instead of throwing.
class IconProvider extends ChangeNotifier {
  IconProvider({IconService? service})
      : _service = service ?? IconService() {
    _service.addListener(_onCatalogChanged);
  }

  final IconService _service;

  bool _isInitialized = false;
  bool _isLoading     = false;
  String? _error;

  bool   get isInitialized => _isInitialized;
  bool   get isLoading     => _isLoading;
  String? get error        => _error;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /// Initialize the icon system. Call once from your app's startup sequence.
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

  /// Force-refresh the catalog (e.g. after the admin publishes a change).
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

  // ── Icon resolution ───────────────────────────────────────────────────────

  /// Async resolution — always returns a valid source (never null).
  Future<IconDisplaySource> resolveSource(String key) =>
      _service.resolveSource(key);

  /// Synchronous resolution from memory cache — may return null on cold start.
  IconDisplaySource? resolveSourceSync(String key) =>
      _service.resolveSourceSync(key);

  // ── Private ───────────────────────────────────────────────────────────────

  void _onCatalogChanged() => notifyListeners();

  @override
  void dispose() {
    _service.removeListener(_onCatalogChanged);
    _service.dispose();
    super.dispose();
  }
}
