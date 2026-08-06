/// Dynamic Icon Management System — Flutter client
///
/// Single import for the entire feature:
///
/// ```dart
/// import 'package:your_app/features/icons/icons.dart';
/// ```
///
/// Then use:
///   - [IconKeys]            — typed key constants
///   - [IconConstants]       — runtime configuration
///   - [IconProvider]        — ChangeNotifier state layer
///   - [IconProviderScope]   — root InheritedNotifier scope
///   - [DynamicIcon]         — drop-in icon widget
///   - [IconLoadingGate]     — startup gate widget
///   - [IconModel]           — data model
///   - [IconCatalog]         — catalog model
///   - [IconService]         — service layer (for DI / testing)
///   - [IconRepository]      — repository layer (for DI / testing)
library icons;

export 'cache/icon_disk_cache.dart';
export 'cache/icon_memory_cache.dart' show IconDisplaySource, IconMemoryCache;
export 'core/icon_constants.dart';
export 'core/icon_keys.dart';
export 'data/models/icon_catalog.dart';
export 'data/models/icon_model.dart';
export 'provider/icon_provider.dart';
export 'provider/icon_provider_scope.dart';
export 'repository/icon_remote_data_source.dart';
export 'repository/icon_repository.dart';
export 'service/icon_service.dart';
export 'widgets/dynamic_icon.dart';
export 'widgets/icon_loading_gate.dart';
