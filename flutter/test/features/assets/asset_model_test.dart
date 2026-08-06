import 'package:flutter_test/flutter_test.dart';
import 'package:voice_app/features/assets/assets.dart';

void main() {
  group('AssetModel', () {
    final sampleJson = {
      'id':          'asset_001',
      'key':         'home_icon',
      'name':        'أيقونة الرئيسية',
      'category':    'navigation',
      'imageUrl':    'https://cdn.example.com/assets/home.svg',
      'thumbnailUrl':'https://cdn.example.com/assets/thumb_home.webp',
      'mimeType':    'image/svg+xml',
      'hash':        'abc123def456abc123def456abc12345',
      'width':       24,
      'height':      24,
      'version':     3,
      'updatedAt':   '2026-08-01T12:00:00.000Z',
    };

    test('fromJson parses all fields correctly', () {
      final model = AssetModel.fromJson(sampleJson);
      expect(model.id,           equals('asset_001'));
      expect(model.key,          equals('home_icon'));
      expect(model.name,         equals('أيقونة الرئيسية'));
      expect(model.category,     equals('navigation'));
      expect(model.imageUrl,     equals('https://cdn.example.com/assets/home.svg'));
      expect(model.thumbnailUrl, equals('https://cdn.example.com/assets/thumb_home.webp'));
      expect(model.mimeType,     equals('image/svg+xml'));
      expect(model.hash,         equals('abc123def456abc123def456abc12345'));
      expect(model.width,        equals(24));
      expect(model.height,       equals(24));
      expect(model.version,      equals(3));
    });

    test('toJson round-trips without data loss', () {
      final model  = AssetModel.fromJson(sampleJson);
      final json   = model.toJson();
      final model2 = AssetModel.fromJson(json);
      expect(model2, equals(model));
    });

    test('fromJson handles null optional fields', () {
      final minJson = {
        'id': 'x', 'key': 'home_icon', 'name': 'Home',
        'category': 'navigation', 'version': 1,
        'updatedAt': '2026-01-01T00:00:00.000Z',
      };
      final model = AssetModel.fromJson(minJson);
      expect(model.imageUrl,    isNull);
      expect(model.thumbnailUrl,isNull);
      expect(model.mimeType,    isNull);
      expect(model.hash,        isNull);
      expect(model.width,       isNull);
      expect(model.height,      isNull);
    });

    test('hasFile returns true when imageUrl is set', () {
      final model = AssetModel.fromJson(sampleJson);
      expect(model.hasFile, isTrue);
    });

    test('hasFile returns false when imageUrl is null', () {
      final model = AssetModel.fromJson({
        'id': 'x', 'key': 'k', 'name': 'n', 'category': 'c',
        'version': 1, 'updatedAt': '2026-01-01T00:00:00.000Z',
      });
      expect(model.hasFile, isFalse);
    });

    test('isSvg returns true for svg mimeType', () {
      final model = AssetModel.fromJson(sampleJson);
      expect(model.isSvg, isTrue);
    });

    test('equality by key + version', () {
      final a = AssetModel.fromJson(sampleJson);
      final b = AssetModel.fromJson({...sampleJson, 'version': 3});
      final c = AssetModel.fromJson({...sampleJson, 'version': 4});
      expect(a, equals(b));
      expect(a, isNot(equals(c)));
    });

    test('copyWith replaces only specified fields', () {
      final original = AssetModel.fromJson(sampleJson);
      final updated  = original.copyWith(version: 99, imageUrl: 'https://new.url/img.png');
      expect(updated.version,  equals(99));
      expect(updated.imageUrl, equals('https://new.url/img.png'));
      expect(updated.key,      equals(original.key));   // unchanged
      expect(updated.name,     equals(original.name));  // unchanged
    });
  });

  // ── AssetCatalog ────────────────────────────────────────────────────────────

  group('AssetCatalog', () {
    final catalogJson = {
      'etag':      'aabbccdd11223344aabbccdd11223344',
      'version':   7,
      'updatedAt': '2026-08-01T12:00:00.000Z',
      'assets': [
        {
          'id': '1', 'key': 'home_icon', 'name': 'Home', 'category': 'navigation',
          'version': 1, 'updatedAt': '2026-08-01T00:00:00.000Z',
        },
        {
          'id': '2', 'key': 'app_logo', 'name': 'Logo', 'category': 'branding',
          'version': 2, 'updatedAt': '2026-08-01T00:00:00.000Z',
        },
      ],
    };

    test('fromJson parses catalog with nested assets', () {
      final catalog = AssetCatalog.fromJson(catalogJson);
      expect(catalog.etag,           equals('aabbccdd11223344aabbccdd11223344'));
      expect(catalog.version,        equals(7));
      expect(catalog.assets.length,  equals(2));
    });

    test('toKeyMap returns O(1) lookup map', () {
      final catalog = AssetCatalog.fromJson(catalogJson);
      final map     = catalog.toKeyMap();
      expect(map.containsKey('home_icon'), isTrue);
      expect(map.containsKey('app_logo'),  isTrue);
      expect(map.containsKey('chat_icon'), isFalse);
    });

    test('findByKey returns correct model', () {
      final catalog = AssetCatalog.fromJson(catalogJson);
      final model   = catalog.findByKey('app_logo');
      expect(model, isNotNull);
      expect(model!.key, equals('app_logo'));
    });

    test('findByKey returns null for missing key', () {
      final catalog = AssetCatalog.fromJson(catalogJson);
      expect(catalog.findByKey('does_not_exist'), isNull);
    });

    test('isEmpty returns false for non-empty catalog', () {
      final catalog = AssetCatalog.fromJson(catalogJson);
      expect(catalog.isEmpty, isFalse);
    });

    test('toJson → fromJson round-trip preserves all data', () {
      final original = AssetCatalog.fromJson(catalogJson);
      final restored = AssetCatalog.fromJson(original.toJson());
      expect(restored.etag,          equals(original.etag));
      expect(restored.version,       equals(original.version));
      expect(restored.assets.length, equals(original.assets.length));
    });
  });
}
