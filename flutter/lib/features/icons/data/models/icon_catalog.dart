import 'icon_model.dart';

export 'icon_model.dart';

/// Re-export the catalog model for convenience.
/// The actual [IconCatalog] class lives in icon_model.dart.
///
/// This file also adds helper extensions on [IconCatalog].
extension IconCatalogX on IconCatalog {
  /// True if this catalog has no icons.
  bool get isEmpty => icons.isEmpty;

  /// Returns the icon with [key], or null if not found.
  IconModel? findByKey(String key) {
    try {
      return icons.firstWhere((i) => i.key == key);
    } catch (_) {
      return null;
    }
  }

  /// Returns all icons belonging to [category].
  List<IconModel> byCategory(String category) =>
      icons.where((i) => i.category == category).toList();

  /// Returns a flat map of key → IconModel for O(1) lookup.
  Map<String, IconModel> toKeyMap() => {for (final i in icons) i.key: i};
}
