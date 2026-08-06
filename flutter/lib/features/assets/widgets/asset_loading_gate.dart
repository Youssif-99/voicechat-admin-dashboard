import 'package:flutter/material.dart';
import '../provider/asset_provider_scope.dart';

/// Ensures [AssetProvider] is initialized before rendering [child].
///
/// Disk cache is typically warm in < 50 ms.
/// After [splashDuration] with no warm cache, shows [splashWidget].
class AssetLoadingGate extends StatefulWidget {
  const AssetLoadingGate({
    super.key,
    required this.child,
    this.splashWidget,
    this.splashDuration = const Duration(milliseconds: 300),
  });

  final Widget  child;
  final Widget? splashWidget;
  final Duration splashDuration;

  @override
  State<AssetLoadingGate> createState() => _AssetLoadingGateState();
}

class _AssetLoadingGateState extends State<AssetLoadingGate> {
  bool _initialized = false;
  bool _showSplash  = false;

  @override
  void initState() {
    super.initState();
    _startSplashTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
  }

  void _startSplashTimer() {
    if (widget.splashWidget == null) return;
    Future.delayed(widget.splashDuration, () {
      if (mounted && !_initialized) setState(() => _showSplash = true);
    });
  }

  Future<void> _initialize() async {
    final provider = AssetProviderScope.maybeOf(context);
    if (provider == null || provider.isInitialized) { _markReady(); return; }
    provider.addListener(_onProviderChange);
    if (!provider.isLoading) await provider.initialize();
  }

  void _onProviderChange() {
    final provider = AssetProviderScope.maybeOf(context);
    if (provider != null && provider.isInitialized) {
      provider.removeListener(_onProviderChange);
      _markReady();
    }
  }

  void _markReady() {
    if (mounted) setState(() { _initialized = true; _showSplash = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_initialized) return widget.child;
    if (_showSplash && widget.splashWidget != null) return widget.splashWidget!;
    // Render child anyway — DynamicAsset widgets show placeholders until resolved
    return widget.child;
  }
}
