import 'package:flutter/widgets.dart';

import 'icon_provider.dart';

export 'icon_provider.dart';

/// Injects [IconProvider] into the widget tree using [InheritedNotifier].
///
/// Place this at the root of your app, above [MaterialApp]:
///
/// ```dart
/// void main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///   final iconProvider = IconProvider();
///   await iconProvider.initialize();          // loads disk cache + starts bg fetch
///   runApp(
///     IconProviderScope(
///       provider: iconProvider,
///       child: MyApp(),
///     ),
///   );
/// }
/// ```
///
/// Then anywhere in the tree:
/// ```dart
/// final icons = IconProviderScope.of(context);
/// ```
class IconProviderScope extends StatefulWidget {
  const IconProviderScope({
    super.key,
    required this.provider,
    required this.child,
  });

  final IconProvider provider;
  final Widget       child;

  /// Returns the nearest [IconProvider] from the tree.
  /// Throws a [FlutterError] if none is found.
  static IconProvider of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<_IconProviderInherited>();
    assert(
      scope != null,
      'No IconProviderScope found in the widget tree. '
      'Wrap your app root with IconProviderScope.',
    );
    return scope!.notifier!;
  }

  /// Like [of], but returns null instead of throwing.
  static IconProvider? maybeOf(BuildContext context) => context
      .dependOnInheritedWidgetOfExactType<_IconProviderInherited>()
      ?.notifier;

  @override
  State<IconProviderScope> createState() => _IconProviderScopeState();
}

class _IconProviderScopeState extends State<IconProviderScope> {
  @override
  void dispose() {
    widget.provider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _IconProviderInherited(
        notifier: widget.provider,
        child:    widget.child,
      );
}

class _IconProviderInherited extends InheritedNotifier<IconProvider> {
  const _IconProviderInherited({
    required super.notifier,
    required super.child,
  });
}
