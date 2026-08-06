import 'package:flutter/widgets.dart';
import 'asset_provider.dart';
export 'asset_provider.dart';

/// Injects [AssetProvider] into the widget tree via [InheritedNotifier].
///
/// ```dart
/// runApp(
///   AssetProviderScope(
///     provider: assetProvider,
///     child: MyApp(),
///   ),
/// );
/// ```
///
/// Then anywhere:
/// ```dart
/// final assets = AssetProviderScope.of(context);
/// ```
class AssetProviderScope extends StatefulWidget {
  const AssetProviderScope({
    super.key,
    required this.provider,
    required this.child,
  });

  final AssetProvider provider;
  final Widget        child;

  static AssetProvider of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<_AssetProviderInherited>();
    assert(
      scope != null,
      'No AssetProviderScope found. Wrap your app root with AssetProviderScope.',
    );
    return scope!.notifier!;
  }

  static AssetProvider? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_AssetProviderInherited>()?.notifier;

  @override
  State<AssetProviderScope> createState() => _AssetProviderScopeState();
}

class _AssetProviderScopeState extends State<AssetProviderScope> {
  @override
  void dispose() {
    widget.provider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _AssetProviderInherited(
        notifier: widget.provider,
        child:    widget.child,
      );
}

class _AssetProviderInherited extends InheritedNotifier<AssetProvider> {
  const _AssetProviderInherited({required super.notifier, required super.child});
}
