/// Dynamic App Asset Management System — Flutter client
///
/// Single import for the entire feature:
///
/// ```dart
/// import 'package:your_app/features/assets/assets.dart';
/// ```
///
/// Usage:
///   - [AssetKeys]            — typed key constants (snake_case)
///   - [AssetConstants]       — runtime configuration
///   - [AssetProvider]        — ChangeNotifier state layer
///   - [AssetProviderScope]   — root InheritedNotifier scope
///   - [DynamicAsset]         — drop-in image/icon widget
///   - [AssetLoadingGate]     — startup gate widget
///   - [AssetModel]           — data model for a single asset
///   - [AssetCatalog]         — full catalog from GET /api/assets
///   - [AssetService]         — service layer (for DI / testing)
///   - [AssetRepository]      — repository layer (for DI / testing)
library assets;

export 'cache/asset_disk_cache.dart';
export 'cache/asset_memory_cache.dart' show AssetDisplaySource, AssetMemoryCache;
export 'core/asset_constants.dart';
export 'core/asset_keys.dart';
export 'data/models/asset_model.dart';
export 'provider/asset_provider.dart';
export 'provider/asset_provider_scope.dart';
export 'repository/asset_remote_data_source.dart';
export 'repository/asset_repository.dart';
export 'service/asset_service.dart';
export 'widgets/dynamic_asset.dart';
export 'widgets/asset_loading_gate.dart';
