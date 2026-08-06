import 'package:flutter/material.dart';

import '../provider/icon_provider_scope.dart';

/// Wraps [child] and ensures the icon catalog is initialized before rendering.
///
/// Shows a transparent (zero-size) placeholder during the async initialization
/// so the first frame renders correctly with icons available. The gate is
/// intentionally lightweight — disk cache is typically ready in < 50 ms.
///
/// If initialization takes longer than [splashDuration], the [splashWidget]
/// is shown instead. If not provided, the app just renders with whatever
/// icons are already in the disk cache.
///
/// Usage — wrap your MaterialApp's home page or the root route:
///
/// ```dart
/// home: IconLoadingGate(child: MyHomePage()),
/// ```
///
/// Or wrap your entire app before showing content:
///
/// ```dart
/// runApp(
///   IconProviderScope(
///     provider: iconProvider,
///     child: MaterialApp(
///       home: IconLoadingGate(child: MyHomePage()),
///     ),
///   ),
/// );
/// ```
class IconLoadingGate extends StatefulWidget {
  const IconLoadingGate({
    super.key,
    required this.child,
    this.splashWidget,
    this.splashDuration = const Duration(milliseconds: 300),
  });

  /// The widget to show once icons are ready.
  final Widget child;

  /// Optional splash/loading widget shown while icons initialize.
  /// If null, renders [child] immediately (icons will appear as they resolve).
  final Widget? splashWidget;

  /// How long to wait before showing [splashWidget].
  /// This avoids flashing the splash for fast disk-cache loads.
  final Duration splashDuration;

  @override
  State<IconLoadingGate> createState() => _IconLoadingGateState();
}

class _IconLoadingGateState extends State<IconLoadingGate> {
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
    final provider = IconProviderScope.maybeOf(context);
    if (provider == null || provider.isInitialized) {
      _markReady();
      return;
    }
    provider.addListener(_onProviderChange);
    if (!provider.isLoading) {
      await provider.initialize();
    }
  }

  void _onProviderChange() {
    final provider = IconProviderScope.maybeOf(context);
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
    // Icons not yet ready but no splash — render the child anyway.
    // DynamicIcon widgets will show placeholders until resolved.
    return widget.child;
  }
}
