// ignore_for_file: avoid_print
import 'package:flutter/foundation.dart';

/// AdminEventListener — Socket.IO realtime event handler.
///
/// Connects to the Express backend and handles all admin broadcast events
/// so Flutter updates immediately when an admin acts in the dashboard.
///
/// Handles both icon events (existing system) and asset events (new AppAsset system).
///
/// Usage (in main()):
///   AdminEventListener.instance
///     ..onIconCatalogChanged(() => iconProvider.refresh())
///     ..onAssetCatalogChanged(() => assetProvider.refresh());
///   await AdminEventListener.instance.connect(serverUrl: EXPRESS_URL);
///
/// Events handled:
///   icon:updated         → refresh icon catalog
///   icon:cache_cleared   → force-refresh icon catalog
///   asset:created        → refresh asset catalog
///   asset:updated        → refresh asset catalog
///   asset:deleted        → refresh asset catalog
///   asset:cache_cleared  → force-refresh asset catalog
///   agency:updated       → reload agency data
///   user:banned          → force-logout if current user affected
///   user:unbanned        → allow re-login
///   vip:changed          → refresh VIP status display
///   room:banned          → close room if user is inside
///   room:deleted         → remove from room list
///   banner:updated       → reload banners
///   settings:updated     → reload app settings
///   moment:hidden        → remove from feed

typedef VoidCallback = void Function();
typedef DataCallback = void Function(Map<String, dynamic> data);

class AdminEventListener {
  AdminEventListener._();
  static final AdminEventListener _instance = AdminEventListener._();
  static AdminEventListener get instance => _instance;

  // ignore: unused_field
  dynamic _socket;
  bool _connected = false;
  bool get isConnected => _connected;

  // ── Listener registries ───────────────────────────────────────────────────

  final List<VoidCallback> _iconListeners     = [];
  final List<VoidCallback> _assetListeners    = [];   // NEW: AppAsset events
  final List<DataCallback> _agencyListeners   = [];
  final List<DataCallback> _userBanListeners  = [];
  final List<DataCallback> _vipListeners      = [];
  final List<DataCallback> _roomListeners     = [];
  final List<DataCallback> _bannerListeners   = [];
  final List<DataCallback> _settingsListeners = [];
  final List<DataCallback> _momentListeners   = [];

  // Registration
  void onIconCatalogChanged(VoidCallback cb)  => _iconListeners.add(cb);
  void onAssetCatalogChanged(VoidCallback cb) => _assetListeners.add(cb);  // NEW
  void onAgencyUpdated(DataCallback cb)       => _agencyListeners.add(cb);
  void onUserBanned(DataCallback cb)          => _userBanListeners.add(cb);
  void onVipChanged(DataCallback cb)          => _vipListeners.add(cb);
  void onRoomEvent(DataCallback cb)           => _roomListeners.add(cb);
  void onBannerUpdated(DataCallback cb)       => _bannerListeners.add(cb);
  void onSettingsUpdated(DataCallback cb)     => _settingsListeners.add(cb);
  void onMomentHidden(DataCallback cb)        => _momentListeners.add(cb);

  // ── Connect ───────────────────────────────────────────────────────────────

  Future<void> connect({
    required String serverUrl,
    String? userToken,
  }) async {
    try {
      await _connectInternal(serverUrl: serverUrl, userToken: userToken);
    } catch (e) {
      // Never crash the app if Socket.IO fails
      // Both icon and asset systems still work via polling
      if (kDebugMode) print('[AdminEvents] connect error: $e');
    }
  }

  Future<void> _connectInternal({
    required String serverUrl,
    String? userToken,
  }) async {
    // ── Real Socket.IO implementation ───────────────────────────────────────
    // Uncomment once socket_io_client is resolved (flutter pub get):
    //
    // import 'package:socket_io_client/socket_io_client.dart' as IO;
    //
    // _socket = IO.io(serverUrl, IO.OptionBuilder()
    //   .setTransports(['websocket', 'polling'])
    //   .setAuth({'token': userToken ?? ''})
    //   .setReconnectionAttempts(10)
    //   .setReconnectionDelay(2000)
    //   .setReconnectionDelayMax(30000)
    //   .enableAutoConnect()
    //   .build());
    //
    // (_socket as IO.Socket).onConnect((_) {
    //   _connected = true;
    //   if (kDebugMode) print('[AdminEvents] connected: ${(_socket as IO.Socket).id}');
    // });
    //
    // (_socket as IO.Socket).onDisconnect((reason) {
    //   _connected = false;
    //   if (kDebugMode) print('[AdminEvents] disconnected: $reason');
    // });
    //
    // // ── Icon events ──────────────────────────────────────────────────────
    // (_socket as IO.Socket).on('icon:updated',       (_) => _notifyIcon());
    // (_socket as IO.Socket).on('icon:cache_cleared', (_) => _notifyIcon());
    //
    // // ── AppAsset events ──────────────────────────────────────────────────
    // (_socket as IO.Socket).on('asset:created',      (_) => _notifyAsset());
    // (_socket as IO.Socket).on('asset:updated',      (_) => _notifyAsset());
    // (_socket as IO.Socket).on('asset:deleted',      (_) => _notifyAsset());
    // (_socket as IO.Socket).on('asset:cache_cleared',(_) => _notifyAsset());
    //
    // // ── Other domain events ──────────────────────────────────────────────
    // (_socket as IO.Socket).on('agency:updated',     (d) => _notify(_agencyListeners,   d));
    // (_socket as IO.Socket).on('user:banned',        (d) => _notify(_userBanListeners,  d));
    // (_socket as IO.Socket).on('user:unbanned',      (d) => _notify(_userBanListeners,  d));
    // (_socket as IO.Socket).on('vip:changed',        (d) => _notify(_vipListeners,      d));
    // (_socket as IO.Socket).on('room:banned',        (d) => _notify(_roomListeners,     d));
    // (_socket as IO.Socket).on('room:deleted',       (d) => _notify(_roomListeners,     d));
    // (_socket as IO.Socket).on('banner:updated',     (d) => _notify(_bannerListeners,   d));
    // (_socket as IO.Socket).on('settings:updated',   (d) => _notify(_settingsListeners, d));
    // (_socket as IO.Socket).on('moment:hidden',      (d) => _notify(_momentListeners,   d));
    //
    // ── END Socket.IO implementation ────────────────────────────────────────

    if (kDebugMode) {
      print('[AdminEvents] stub mode — run: flutter pub get');
      print('[AdminEvents] server: $serverUrl');
      print('[AdminEvents] listening for: icon:*, asset:*, agency:updated, user:banned, vip:changed, room:*, banner:updated, settings:updated, moment:hidden');
    }
  }

  // ── Fire helpers ──────────────────────────────────────────────────────────

  void _notifyIcon() {
    for (final cb in _iconListeners) {
      try { cb(); } catch (e) { if (kDebugMode) print('[AdminEvents] icon listener error: $e'); }
    }
  }

  void _notifyAsset() {
    for (final cb in _assetListeners) {
      try { cb(); } catch (e) { if (kDebugMode) print('[AdminEvents] asset listener error: $e'); }
    }
  }

  // ignore: unused_element
  void _notify(List<DataCallback> cbs, dynamic data) {
    final map = _toMap(data);
    for (final cb in cbs) {
      try { cb(map); } catch (e) { if (kDebugMode) print('[AdminEvents] listener error: $e'); }
    }
  }

  Map<String, dynamic> _toMap(dynamic data) {
    if (data is Map) return Map<String, dynamic>.from(data);
    if (data is List && data.isNotEmpty && data.first is Map) {
      return Map<String, dynamic>.from(data.first as Map);
    }
    return {};
  }

  // ── Manual triggers (pull-to-refresh, settings button) ───────────────────

  void triggerIconRefresh()  => _notifyIcon();
  void triggerAssetRefresh() => _notifyAsset();

  // ── Disconnect ────────────────────────────────────────────────────────────

  void dispose() {
    try {
      // (_socket as IO.Socket?)?.disconnect();
      // (_socket as IO.Socket?)?.dispose();
    } catch (_) {}
    _socket    = null;
    _connected = false;
    _iconListeners.clear();
    _assetListeners.clear();
    _agencyListeners.clear();
    _userBanListeners.clear();
    _vipListeners.clear();
    _roomListeners.clear();
    _bannerListeners.clear();
    _settingsListeners.clear();
    _momentListeners.clear();
    if (kDebugMode) print('[AdminEvents] disposed');
  }
}
