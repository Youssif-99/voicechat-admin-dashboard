import 'package:flutter_test/flutter_test.dart';
import 'package:voice_app/features/assets/core/asset_keys.dart';

void main() {
  group('AssetKeys', () {
    test('all required nav icon keys are defined', () {
      expect(AssetKeys.homeIcon,     equals('home_icon'));
      expect(AssetKeys.momentsIcon,  equals('moments_icon'));
      expect(AssetKeys.chatIcon,     equals('chat_icon'));
      expect(AssetKeys.roomsIcon,    equals('rooms_icon'));
      expect(AssetKeys.profileIcon,  equals('profile_icon'));
      expect(AssetKeys.settingsIcon, equals('settings_icon'));
    });

    test('all required branding keys are defined', () {
      expect(AssetKeys.appLogo,    equals('app_logo'));
      expect(AssetKeys.splashLogo, equals('splash_logo'));
      expect(AssetKeys.authLogo,   equals('auth_logo'));
      expect(AssetKeys.appIcon,    equals('app_icon'));
    });

    test('all required social/economy keys are defined', () {
      expect(AssetKeys.giftIcon,         equals('gift_icon'));
      expect(AssetKeys.notificationIcon, equals('notification_icon'));
      expect(AssetKeys.walletIcon,       equals('wallet_icon'));
    });

    test('all required VIP keys are defined', () {
      expect(AssetKeys.vipIcon,   equals('vip_icon'));
      expect(AssetKeys.svipIcon,  equals('svip_icon'));
      expect(AssetKeys.vipBadge,  equals('vip_badge'));
      expect(AssetKeys.svipBadge, equals('svip_badge'));
      expect(AssetKeys.vipCrown,  equals('vip_crown'));
      expect(AssetKeys.svipCrown, equals('svip_crown'));
    });

    test('agency key is defined', () {
      expect(AssetKeys.agencyIcon, equals('agency_icon'));
    });

    test('all keys use snake_case format', () {
      for (final key in AssetKeys.all) {
        expect(key, matches(RegExp(r'^[a-z][a-z0-9_]*$')),
            reason: "'$key' must be snake_case (lowercase + digits + underscores)");
      }
    });

    test('all keys in .all list are unique', () {
      final seen = <String>{};
      for (final key in AssetKeys.all) {
        expect(seen.contains(key), isFalse, reason: "'$key' is duplicated in AssetKeys.all");
        seen.add(key);
      }
    });

    test('all list contains all 27 defined keys', () {
      expect(AssetKeys.all.length, equals(27),
          reason: 'Expected 27 asset keys to match ASSET_DEFINITIONS in TypeScript');
    });

    test('no key contains uppercase letters', () {
      for (final key in AssetKeys.all) {
        expect(key, equals(key.toLowerCase()),
            reason: "'$key' must not contain uppercase letters");
      }
    });

    test('no key contains spaces or special chars', () {
      for (final key in AssetKeys.all) {
        expect(key.contains(' '), isFalse, reason: "'$key' must not contain spaces");
        expect(key.contains('.'), isFalse, reason: "'$key' must use _ not . (unlike IconKeys)");
        expect(key.contains('-'), isFalse, reason: "'$key' must not contain hyphens");
      }
    });
  });
}
