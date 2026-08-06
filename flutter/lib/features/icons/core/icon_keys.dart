// ignore_for_file: constant_identifier_names

/// Typed registry of every icon key used in the application.
/// Mirrors icon-groups.ts — update both files when adding new icons.
///
/// Usage:
///   DynamicIcon(iconKey: IconKeys.navHome)
abstract final class IconKeys {
  // ── Bottom Navigation ──────────────────────────────────────────
  static const String navHome          = 'nav.home';
  static const String navRooms         = 'nav.rooms';
  static const String navMessages      = 'nav.messages';
  static const String navFriends       = 'nav.friends';
  static const String navMoments       = 'nav.moments';
  static const String navNotifications = 'nav.notifications';
  static const String navProfile       = 'nav.profile';
  static const String navSettings      = 'nav.settings';
  static const String navWallet        = 'nav.wallet';
  static const String navSearch        = 'nav.search';

  // ── VIP / SVIP ─────────────────────────────────────────────────
  static const String vipBadge         = 'vip.badge';
  static const String svipBadge        = 'svip.badge';
  static const String vipCrown         = 'vip.crown';
  static const String svipCrown        = 'svip.crown';
  static const String vipStar          = 'vip.star';

  // ── Live Rooms ─────────────────────────────────────────────────
  static const String roomMic          = 'room.mic';
  static const String roomMicMuted     = 'room.mic_muted';
  static const String roomSeatEmpty    = 'room.seat_empty';
  static const String roomSeatLocked   = 'room.seat_locked';
  static const String roomHost         = 'room.host';
  static const String roomAudience     = 'room.audience';
  static const String roomShare        = 'room.share';
  static const String roomLeave        = 'room.leave';
  static const String roomSettings     = 'room.settings';
  static const String roomRank         = 'room.rank';

  // ── Chat ───────────────────────────────────────────────────────
  static const String chatSend         = 'chat.send';
  static const String chatEmoji        = 'chat.emoji';
  static const String chatAttach       = 'chat.attach';
  static const String chatVoice        = 'chat.voice';
  static const String chatImage        = 'chat.image';
  static const String chatGift         = 'chat.gift';
  static const String chatMore         = 'chat.more';

  // ── Gifts ──────────────────────────────────────────────────────
  static const String giftRose         = 'gift.rose';
  static const String giftHeart        = 'gift.heart';
  static const String giftDiamond      = 'gift.diamond';
  static const String giftCrown        = 'gift.crown';
  static const String giftRocket       = 'gift.rocket';
  static const String giftCastle       = 'gift.castle';
  static const String giftPlane        = 'gift.plane';
  static const String giftSportsCar    = 'gift.sports_car';

  // ── Social ─────────────────────────────────────────────────────
  static const String socialFollow     = 'social.follow';
  static const String socialFollowing  = 'social.following';
  static const String socialLike       = 'social.like';
  static const String socialLiked      = 'social.liked';
  static const String socialComment    = 'social.comment';
  static const String socialShare      = 'social.share';

  // ── Economy ────────────────────────────────────────────────────
  static const String economyCoins     = 'economy.coins';
  static const String economyDiamonds  = 'economy.diamonds';
  static const String economyWallet    = 'economy.wallet';
  static const String economyRecharge  = 'economy.recharge';
  static const String economyWithdraw  = 'economy.withdraw';
  static const String economyLevel     = 'economy.level';

  // ── Profile ────────────────────────────────────────────────────
  static const String profileEdit      = 'profile.edit';
  static const String profileCamera    = 'profile.camera';
  static const String profileSettings  = 'profile.settings';
  static const String profilePrivacy   = 'profile.privacy';
  static const String profileLogout    = 'profile.logout';
  static const String profileBlock     = 'profile.block';
  static const String profileReport    = 'profile.report';

  // ── Badges / Verification ──────────────────────────────────────
  static const String badgeVerified    = 'badge.verified';
  static const String badgeHost        = 'badge.host';
  static const String badgeAgent       = 'badge.agent';
  static const String badgeNew         = 'badge.new';
  static const String badgeHot         = 'badge.hot';

  // ── UI States ──────────────────────────────────────────────────
  static const String stateLoading     = 'state.loading';
  static const String stateEmpty       = 'state.empty';
  static const String stateError       = 'state.error';
  static const String stateSuccess     = 'state.success';
  static const String stateNoInternet  = 'state.no_internet';
  static const String stateSearchEmpty = 'state.search_empty';

  // ── Dialogs ────────────────────────────────────────────────────
  static const String dialogWarning    = 'dialog.warning';
  static const String dialogInfo       = 'dialog.info';
  static const String dialogConfirm    = 'dialog.confirm';
  static const String dialogDelete     = 'dialog.delete';

  // ── Buttons ────────────────────────────────────────────────────
  static const String btnClose         = 'btn.close';
  static const String btnBack          = 'btn.back';
  static const String btnAdd           = 'btn.add';
  static const String btnCheck         = 'btn.check';
  static const String btnRefresh       = 'btn.refresh';
  static const String btnFilter        = 'btn.filter';
  static const String btnSort          = 'btn.sort';
  static const String btnFabNew        = 'btn.fab_new';

  // ── Toolbar ────────────────────────────────────────────────────
  static const String toolbarMenu      = 'toolbar.menu';
  static const String toolbarSearch    = 'toolbar.search';
  static const String toolbarMore      = 'toolbar.more';
  static const String toolbarNotify    = 'toolbar.notify';

  // ── Drawer ─────────────────────────────────────────────────────
  static const String drawerHome       = 'drawer.home';
  static const String drawerSettings   = 'drawer.settings';
  static const String drawerHelp       = 'drawer.help';
  static const String drawerAbout      = 'drawer.about';
  static const String drawerLanguage   = 'drawer.language';

  // ── Agency ─────────────────────────────────────────────────────
  static const String agencyLogo       = 'agency.logo';
  static const String agencyMembers    = 'agency.members';
  static const String agencyEarnings   = 'agency.earnings';
  static const String agencyRank       = 'agency.rank';

  // ── Store ──────────────────────────────────────────────────────
  static const String storeFeatured    = 'store.featured';
  static const String storeBundle      = 'store.bundle';
  static const String storeFrame       = 'store.frame';
  static const String storeEntrance    = 'store.entrance';
  static const String storeBubble      = 'store.bubble';

  // ── Leaderboard ────────────────────────────────────────────────
  static const String boardGold        = 'board.gold';
  static const String boardSilver      = 'board.silver';
  static const String boardBronze      = 'board.bronze';
  static const String boardWeekly      = 'board.weekly';
  static const String boardMonthly     = 'board.monthly';

  /// All keys as a flat list — used for pre-warming cache and validation.
  static const List<String> all = [
    navHome, navRooms, navMessages, navFriends, navMoments,
    navNotifications, navProfile, navSettings, navWallet, navSearch,
    vipBadge, svipBadge, vipCrown, svipCrown, vipStar,
    roomMic, roomMicMuted, roomSeatEmpty, roomSeatLocked, roomHost,
    roomAudience, roomShare, roomLeave, roomSettings, roomRank,
    chatSend, chatEmoji, chatAttach, chatVoice, chatImage, chatGift, chatMore,
    giftRose, giftHeart, giftDiamond, giftCrown, giftRocket,
    giftCastle, giftPlane, giftSportsCar,
    socialFollow, socialFollowing, socialLike, socialLiked,
    socialComment, socialShare,
    economyCoins, economyDiamonds, economyWallet, economyRecharge,
    economyWithdraw, economyLevel,
    profileEdit, profileCamera, profileSettings, profilePrivacy,
    profileLogout, profileBlock, profileReport,
    badgeVerified, badgeHost, badgeAgent, badgeNew, badgeHot,
    stateLoading, stateEmpty, stateError, stateSuccess,
    stateNoInternet, stateSearchEmpty,
    dialogWarning, dialogInfo, dialogConfirm, dialogDelete,
    btnClose, btnBack, btnAdd, btnCheck, btnRefresh, btnFilter,
    btnSort, btnFabNew,
    toolbarMenu, toolbarSearch, toolbarMore, toolbarNotify,
    drawerHome, drawerSettings, drawerHelp, drawerAbout, drawerLanguage,
    agencyLogo, agencyMembers, agencyEarnings, agencyRank,
    storeFeatured, storeBundle, storeFrame, storeEntrance, storeBubble,
    boardGold, boardSilver, boardBronze, boardWeekly, boardMonthly,
  ];
}
