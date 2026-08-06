import 'package:flutter/material.dart';
import 'features/icons/icons.dart';
import 'features/assets/assets.dart';
import 'features/realtime/admin_event_listener.dart';

/// ─────────────────────────────────────────────────────────────────────────────
/// App Entry Point
///
/// Bootstrap sequence:
///   1. Flutter bindings initialised
///   2. IconProvider created and disk cache warmed
///   3. AdminEventListener wired — on icon:cache_cleared → force-refresh icons
///   4. App wrapped in IconProviderScope
///   5. IconLoadingGate ensures icons ready before first user-visible frame
///
/// Realtime updates:
///   The AdminEventListener listens to Socket.IO events from the Express
///   backend. When the admin uploads a new icon or clears the cache from
///   the Next.js dashboard, Flutter updates immediately without a restart.
///
/// Configuration:
///   Pass the Express server URL via --dart-define:
///     flutter run --dart-define=ICONS_API_BASE_URL=https://your-domain.com
///     flutter run --dart-define=EXPRESS_SOCKET_URL=https://your-domain.com
/// ─────────────────────────────────────────────────────────────────────────────

/// Socket.IO server URL — defaults to same host as icon API.
const String _socketUrl = String.fromEnvironment(
  'EXPRESS_SOCKET_URL',
  defaultValue: 'http://localhost:4000',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── 1. Icon system ─────────────────────────────────────────────────────────
  final iconProvider = IconProvider();
  await iconProvider.initialize();

  // ── 2. AppAsset system ─────────────────────────────────────────────────────
  final assetProvider = AssetProvider();
  await assetProvider.initialize();

  // ── 3. Realtime admin event listener ───────────────────────────────────────
  // Icon catalog changes
  AdminEventListener.instance.onIconCatalogChanged(() {
    iconProvider.refresh();
  });
  // AppAsset catalog changes — all asset:* events trigger a refresh
  AdminEventListener.instance.onAssetCatalogChanged(() {
    assetProvider.refresh();
  });

  await AdminEventListener.instance.connect(
    serverUrl: _socketUrl,
  );

  // ── 4. Run app ─────────────────────────────────────────────────────────────
  runApp(
    AssetProviderScope(
      provider: assetProvider,
      child: IconProviderScope(
        provider: iconProvider,
        child: const AppRoot(),
      ),
    ),
  );
}

class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  @override
  void dispose() {
    AdminEventListener.instance.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Voice App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE8B75B)),
        useMaterial3: true,
      ),
      home: const IconLoadingGate(
        splashWidget: _SplashScreen(),
        child: _HomeScreen(),
      ),
    );
  }
}

// ── Home screen ───────────────────────────────────────────────────────────────

class _HomeScreen extends StatelessWidget {
  const _HomeScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Voice App'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: DynamicIcon(
              iconKey:       IconKeys.toolbarSearch,
              size:          22,
              color:         Theme.of(context).colorScheme.onSurface,
              semanticLabel: 'بحث',
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: DynamicIcon(
              iconKey:       IconKeys.toolbarNotify,
              size:          22,
              color:         Theme.of(context).colorScheme.onSurface,
              semanticLabel: 'الإشعارات',
            ),
          ),
        ],
      ),
      body: const _IconShowcase(),
      bottomNavigationBar: _BottomNav(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => IconProviderScope.of(context).refresh(),
        tooltip: 'تحديث الأيقونات',
        child: DynamicIcon(
          iconKey: IconKeys.btnRefresh,
          size:    26,
          color:   Colors.white,
        ),
      ),
    );
  }
}

class _BottomNav extends StatefulWidget {
  @override
  State<_BottomNav> createState() => _BottomNavState();
}

class _BottomNavState extends State<_BottomNav> {
  int _selected = 0;

  static const _items = [
    (key: IconKeys.navHome,     label: 'الرئيسية'),
    (key: IconKeys.navRooms,    label: 'الغرف'),
    (key: IconKeys.navMessages, label: 'الرسائل'),
    (key: IconKeys.navFriends,  label: 'الأصدقاء'),
    (key: IconKeys.navProfile,  label: 'حسابي'),
  ];

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme;
    return BottomNavigationBar(
      currentIndex: _selected,
      onTap: (i) => setState(() => _selected = i),
      type: BottomNavigationBarType.fixed,
      items: _items.asMap().entries.map((e) {
        final isActive = e.key == _selected;
        return BottomNavigationBarItem(
          icon: DynamicIcon(
            iconKey:       e.value.key,
            size:          IconConstants.navIconSize,
            color:         isActive ? color.primary : color.outline,
            semanticLabel: e.value.label,
          ),
          label: e.value.label,
        );
      }).toList(),
    );
  }
}

// ── Icon showcase ─────────────────────────────────────────────────────────────

class _IconShowcase extends StatelessWidget {
  const _IconShowcase();

  static const _groups = [
    ('الغرف الحية',    [IconKeys.roomMic, IconKeys.roomMicMuted, IconKeys.roomHost, IconKeys.roomLeave, IconKeys.roomShare]),
    ('الهدايا',        [IconKeys.giftRose, IconKeys.giftHeart, IconKeys.giftDiamond, IconKeys.giftCrown, IconKeys.giftRocket]),
    ('حالات الواجهة', [IconKeys.stateLoading, IconKeys.stateEmpty, IconKeys.stateError, IconKeys.stateSuccess, IconKeys.stateNoInternet]),
    ('الاقتصاد',      [IconKeys.economyCoins, IconKeys.economyDiamonds, IconKeys.economyWallet, IconKeys.economyRecharge, IconKeys.economyWithdraw]),
    ('VIP / SVIP',    [IconKeys.vipBadge, IconKeys.svipBadge, IconKeys.vipCrown, IconKeys.svipCrown, IconKeys.vipStar]),
    ('الشارات',        [IconKeys.badgeVerified, IconKeys.badgeHost, IconKeys.badgeAgent, IconKeys.badgeNew, IconKeys.badgeHot]),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _groups.length,
      separatorBuilder: (_, __) => const Divider(height: 32),
      itemBuilder: (context, i) {
        final (groupName, keys) = _groups[i];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              groupName,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 12,
              children: keys.map((key) => _IconTile(iconKey: key)).toList(),
            ),
          ],
        );
      },
    );
  }
}

class _IconTile extends StatelessWidget {
  const _IconTile({required this.iconKey});
  final String iconKey;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: DynamicIcon(
              iconKey: iconKey,
              size:    32,
              color:   Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(height: 4),
        SizedBox(
          width: 64,
          child: Text(
            iconKey,
            textAlign:  TextAlign.center,
            maxLines:   2,
            overflow:   TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 9,
              color: Theme.of(context).colorScheme.outline,
            ),
          ),
        ),
      ],
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF0F1320),
      body: Center(
        child: CircularProgressIndicator(color: Color(0xFFE8B75B)),
      ),
    );
  }
}
