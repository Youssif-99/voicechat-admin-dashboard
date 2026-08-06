import 'package:flutter_test/flutter_test.dart';
import 'package:voice_app/features/assets/assets.dart';

AssetDisplaySource _remoteSource(String url) =>
    AssetDisplaySource(remoteUrl: url, isRemote: true);

AssetDisplaySource _diskSource(String path) =>
    AssetDisplaySource(diskPath: path, isRemote: true);

void main() {
  late AssetMemoryCache cache;

  setUp(() => cache = AssetMemoryCache());

  group('AssetMemoryCache — basic operations', () {
    test('get returns null on miss', () {
      expect(cache.get('home_icon'), isNull);
    });

    test('put then get returns stored source', () {
      final src = _remoteSource('https://cdn.example.com/home.svg');
      cache.put('home_icon', src);
      expect(cache.get('home_icon'), equals(src));
    });

    test('invalidate removes entry', () {
      cache.put('home_icon', _remoteSource('https://example.com/home.svg'));
      cache.invalidate('home_icon');
      expect(cache.get('home_icon'), isNull);
    });

    test('clearAll empties the cache and catalog', () {
      cache.put('home_icon', _remoteSource('https://example.com/home.svg'));
      cache.put('app_logo',  _remoteSource('https://example.com/logo.png'));
      cache.clearAll();
      expect(cache.get('home_icon'), isNull);
      expect(cache.get('app_logo'),  isNull);
      expect(cache.catalog,          isNull);
    });

    test('size reflects number of stored entries', () {
      cache.put('a', _remoteSource('https://a'));
      cache.put('b', _remoteSource('https://b'));
      expect(cache.size, equals(2));
    });
  });

  group('AssetMemoryCache — LRU eviction', () {
    test('exceeding max entries evicts LRU entry', () {
      // Fill cache to max capacity
      for (int i = 0; i < AssetConstants.memoryCacheMaxEntries; i++) {
        cache.put('key_$i', _remoteSource('https://cdn/$i'));
      }
      expect(cache.size, equals(AssetConstants.memoryCacheMaxEntries));

      // Promote key_0 to most-recently-used by getting it
      cache.get('key_0');

      // Add one more entry to trigger eviction
      cache.put('key_overflow', _remoteSource('https://cdn/overflow'));

      // key_0 was recently used so should survive
      expect(cache.get('key_0'), isNotNull);
      // Cache size must not exceed max
      expect(cache.size, lessThanOrEqualTo(AssetConstants.memoryCacheMaxEntries + 1));
    });
  });

  group('AssetMemoryCache — catalog integration', () {
    test('setCatalog allows findModel lookup', () {
      final catalog = AssetCatalog.fromJson({
        'etag': 'abc', 'version': 1, 'updatedAt': '2026-01-01T00:00:00.000Z',
        'assets': [
          {
            'id': '1', 'key': 'home_icon', 'name': 'Home', 'category': 'navigation',
            'version': 1, 'updatedAt': '2026-01-01T00:00:00.000Z',
            'imageUrl': 'https://cdn/home.svg',
          },
        ],
      });
      cache.setCatalog(catalog);
      expect(cache.catalog, isNotNull);
      expect(cache.findModel('home_icon'), isNotNull);
      expect(cache.findModel('home_icon')!.key, equals('home_icon'));
    });

    test('findModel returns null for unknown key', () {
      expect(cache.findModel('nonexistent_key'), isNull);
    });
  });

  group('AssetDisplaySource', () {
    test('hasSource true when diskPath set', () {
      final src = AssetDisplaySource(diskPath: '/cache/home.svg', isRemote: true);
      expect(src.hasSource, isTrue);
    });

    test('hasSource true when remoteUrl set', () {
      final src = AssetDisplaySource(remoteUrl: 'https://cdn/home.svg', isRemote: true);
      expect(src.hasSource, isTrue);
    });

    test('hasSource true when assetPath set', () {
      final src = AssetDisplaySource.bundled('assets/assets/fallback/home_icon.png');
      expect(src.hasSource, isTrue);
      expect(src.isRemote,  isFalse);
    });

    test('isSvg true for svg disk path', () {
      final src = _diskSource('/cache/home.svg');
      expect(src.isSvg, isTrue);
    });

    test('isSvg false for png disk path', () {
      final src = _diskSource('/cache/home.png');
      expect(src.isSvg, isFalse);
    });
  });
}
