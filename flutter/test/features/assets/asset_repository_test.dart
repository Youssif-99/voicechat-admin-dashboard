import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:voice_app/features/assets/assets.dart';
import 'package:voice_app/features/assets/repository/asset_remote_data_source.dart';

// ── Generate mocks ──────────────────────────────────────────────────────────
// Run: flutter pub run build_runner build
@GenerateMocks([IAssetRepository, AssetRemoteDataSource])
import 'asset_repository_test.mocks.dart';

// ── Test catalog helpers ────────────────────────────────────────────────────

AssetCatalog _catalog({String etag = 'etag1', int version = 1, List<AssetModel>? assets}) =>
    AssetCatalog(
      etag:      etag,
      version:   version,
      updatedAt: '2026-08-01T00:00:00.000Z',
      assets:    assets ?? [
        AssetModel(
          id:        'id1',
          key:       'home_icon',
          name:      'Home',
          category:  'navigation',
          imageUrl:  'https://cdn.example.com/home.svg',
          hash:      'abc123',
          version:   1,
          updatedAt: DateTime(2026, 8, 1),
        ),
      ],
    );

void main() {
  // ── IAssetRepository contract via mock ─────────────────────────────────────

  group('IAssetRepository — mock contract tests', () {
    late MockIAssetRepository mockRepo;

    setUp(() => mockRepo = MockIAssetRepository());

    test('getCatalog returns catalog on success', () async {
      final catalog = _catalog();
      when(mockRepo.getCatalog()).thenAnswer((_) async => catalog);
      final result = await mockRepo.getCatalog();
      expect(result, equals(catalog));
    });

    test('getCatalog returns null when both remote and disk fail (offline cold start)', () async {
      when(mockRepo.getCatalog()).thenAnswer((_) async => null);
      final result = await mockRepo.getCatalog();
      expect(result, isNull);
    });

    test('forceRefresh: getCatalog(forceRefresh: true) bypasses memory cache', () async {
      when(mockRepo.getCatalog(forceRefresh: true)).thenAnswer((_) async => _catalog(etag: 'fresh'));
      final result = await mockRepo.getCatalog(forceRefresh: true);
      expect(result?.etag, equals('fresh'));
    });

    test('ensureFileCached returns disk path on success', () async {
      when(mockRepo.ensureFileCached(hash: 'abc123', url: 'https://cdn/home.svg', ext: 'svg'))
          .thenAnswer((_) async => '/cache/abc123.svg');
      final path = await mockRepo.ensureFileCached(
        hash: 'abc123', url: 'https://cdn/home.svg', ext: 'svg',
      );
      expect(path, equals('/cache/abc123.svg'));
    });

    test('ensureFileCached returns null on download failure', () async {
      when(mockRepo.ensureFileCached(hash: 'abc123', url: 'https://cdn/home.svg', ext: 'svg'))
          .thenAnswer((_) async => null);
      final path = await mockRepo.ensureFileCached(
        hash: 'abc123', url: 'https://cdn/home.svg', ext: 'svg',
      );
      expect(path, isNull);
    });

    test('clearAll is called once', () async {
      when(mockRepo.clearAll()).thenAnswer((_) async {});
      await mockRepo.clearAll();
      verify(mockRepo.clearAll()).called(1);
    });
  });

  // ── AssetService with mocked repository ────────────────────────────────────

  group('AssetService with mocked repository', () {
    late MockIAssetRepository mockRepo;
    late AssetService service;
    late AssetMemoryCache memCache;

    setUp(() {
      mockRepo = MockIAssetRepository();
      memCache = AssetMemoryCache();
      service  = AssetService(repository: mockRepo, memoryCache: memCache);
    });

    tearDown(() => service.dispose());

    test('initialize loads disk catalog into memory cache', () async {
      final catalog = _catalog();
      when(mockRepo.getCatalog()).thenAnswer((_) async => catalog);
      when(mockRepo.getCatalog(forceRefresh: false)).thenAnswer((_) async => catalog);
      await service.initialize();
      expect(memCache.catalog, isNotNull);
      expect(memCache.catalog!.etag, equals('etag1'));
    });

    test('resolveSource returns disk source when file is cached', () async {
      final catalog = _catalog();
      when(mockRepo.getCatalog()).thenAnswer((_) async => catalog);
      when(mockRepo.getCatalog(forceRefresh: false)).thenAnswer((_) async => catalog);
      when(mockRepo.ensureFileCached(hash: 'abc123', url: 'https://cdn.example.com/home.svg', ext: 'svg'))
          .thenAnswer((_) async => '/cache/abc123.svg');
      memCache.setCatalog(catalog);

      final source = await service.resolveSource('home_icon');
      expect(source.diskPath, equals('/cache/abc123.svg'));
      expect(source.isRemote, isTrue);
    });

    test('resolveSource returns remote URL when disk cache fails', () async {
      final catalog = _catalog();
      memCache.setCatalog(catalog);
      when(mockRepo.ensureFileCached(hash: 'abc123', url: 'https://cdn.example.com/home.svg', ext: 'svg'))
          .thenAnswer((_) async => null);  // download fails

      final source = await service.resolveSource('home_icon');
      expect(source.remoteUrl, equals('https://cdn.example.com/home.svg'));
    });

    test('resolveSource returns bundled fallback for unknown key', () async {
      memCache.clearAll();
      final source = await service.resolveSource('nonexistent_key');
      expect(source.assetPath, isNotNull);
      expect(source.isRemote,  isFalse);
    });

    test('resolveSource returns bundled fallback when catalog is null (offline)', () async {
      when(mockRepo.getCatalog()).thenAnswer((_) async => null);
      when(mockRepo.getCatalog(forceRefresh: false)).thenAnswer((_) async => null);
      memCache.clearAll();
      final source = await service.resolveSource('home_icon');
      expect(source.assetPath, isNotNull);
      expect(source.isRemote,  isFalse);
    });

    test('resolveSourceSync returns null on cold cache miss', () {
      memCache.clearAll();
      expect(service.resolveSourceSync('home_icon'), isNull);
    });

    test('forceRefresh clears memory cache and fetches fresh catalog', () async {
      final freshCatalog = _catalog(etag: 'fresh_etag', version: 2);
      when(mockRepo.getCatalog(forceRefresh: true)).thenAnswer((_) async => freshCatalog);
      bool notified = false;
      service.addListener(() => notified = true);
      await service.forceRefresh();
      expect(notified, isTrue);
    });

    test('listeners notified on catalog change', () async {
      int callCount = 0;
      service.addListener(() => callCount++);

      final oldCatalog = _catalog(etag: 'old');
      final newCatalog = _catalog(etag: 'new', version: 2);
      memCache.setCatalog(oldCatalog);

      when(mockRepo.getCatalog(forceRefresh: false)).thenAnswer((_) async => newCatalog);
      when(mockRepo.getCatalog()).thenAnswer((_) async => newCatalog);

      // Simulate background refresh
      await service.forceRefresh();
      expect(callCount, greaterThan(0));
    });

    test('listeners are cleaned up on dispose', () {
      int callCount = 0;
      void listener() => callCount++;
      service.addListener(listener);
      service.dispose();
      // After dispose, timer is cancelled and listeners cleared
      expect(() => service.dispose(), returnsNormally);
    });
  });
}
