import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../cache/icon_memory_cache.dart';
import '../core/icon_constants.dart';
import '../provider/icon_provider_scope.dart';

/// A widget that renders a remotely-configurable icon by [iconKey].
///
/// Rendering pipeline (never crashes, never shows a broken state):
///
///   1. Sync memory-cache hit → renders immediately (zero flicker)
///   2. Async resolution → shows [placeholder] while loading
///   3. Resolved disk path (SVG/PNG) → renders local file
///   4. Resolved remote URL → renders NetworkImage/SvgPicture.network
///   5. Bundled fallback asset → renders from Flutter assets
///   6. Generic fallback → renders [fallbackWidget] or default icon
///
/// Usage:
/// ```dart
/// DynamicIcon(
///   iconKey:  IconKeys.navHome,
///   size:     24,
///   color:    Theme.of(context).colorScheme.primary,
/// )
/// ```
class DynamicIcon extends StatefulWidget {
  const DynamicIcon({
    super.key,
    required this.iconKey,
    this.size,
    this.color,
    this.semanticLabel,
    this.placeholder,
    this.fallbackWidget,
    this.fit = BoxFit.contain,
  });

  /// The icon key — must match a key defined in [IconKeys].
  final String iconKey;

  /// Width and height. Defaults to [IconConstants.defaultIconSize].
  final double? size;

  /// Colour tint applied to SVG icons via [ColorFilter].
  final Color? color;

  /// Accessibility label.
  final String? semanticLabel;

  /// Widget shown while the icon resolves. Defaults to a sized-box.
  final Widget? placeholder;

  /// Widget shown if ALL resolution attempts fail.
  /// Defaults to a [SizedBox] with the generic fallback asset.
  final Widget? fallbackWidget;

  /// How to inscribe the icon into its bounding box.
  final BoxFit fit;

  @override
  State<DynamicIcon> createState() => _DynamicIconState();
}

class _DynamicIconState extends State<DynamicIcon> {
  IconDisplaySource? _source;
  bool _resolving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncResolve();
  }

  @override
  void didUpdateWidget(DynamicIcon old) {
    super.didUpdateWidget(old);
    if (old.iconKey != widget.iconKey) {
      _source    = null;
      _resolving = false;
      _syncResolve();
    }
  }

  /// Attempt synchronous resolution first; if it misses, kick off async.
  void _syncResolve() {
    final provider = IconProviderScope.maybeOf(context);
    if (provider == null) return;

    final syncSource = provider.resolveSourceSync(widget.iconKey);
    if (syncSource != null) {
      // Memory hit — assign without setState to avoid layout cycle
      _source = syncSource;
      return;
    }

    // Async resolution needed
    if (!_resolving) {
      _resolving = true;
      provider.resolveSource(widget.iconKey).then((source) {
        if (mounted) setState(() { _source = source; _resolving = false; });
      }).catchError((_) {
        if (mounted) setState(() { _resolving = false; });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveSize = widget.size ?? IconConstants.defaultIconSize;

    return Semantics(
      label:   widget.semanticLabel,
      image:   true,
      child:   SizedBox(
        width:  effectiveSize,
        height: effectiveSize,
        child:  _buildIcon(effectiveSize),
      ),
    );
  }

  Widget _buildIcon(double size) {
    // Loading / no source yet → placeholder
    if (_resolving || _source == null) {
      return widget.placeholder ?? _buildFallback(size);
    }

    final source = _source!;

    // ── 1. Disk file ────────────────────────────────────────────────────────
    if (source.diskPath != null) {
      return _buildFromDisk(source.diskPath!, size);
    }

    // ── 2. Remote URL ───────────────────────────────────────────────────────
    if (source.remoteUrl != null) {
      return _buildFromUrl(source.remoteUrl!, size);
    }

    // ── 3. Bundled asset ────────────────────────────────────────────────────
    if (source.assetPath != null) {
      return _buildFromAsset(source.assetPath!, size);
    }

    // ── 4. Generic fallback ─────────────────────────────────────────────────
    return _buildFallback(size);
  }

  // ── Renderers ─────────────────────────────────────────────────────────────

  Widget _buildFromDisk(String path, double size) {
    if (path.endsWith('.svg')) {
      return SvgPicture.file(
        File(path),
        width:       size,
        height:      size,
        fit:         widget.fit,
        colorFilter: _colorFilter,
        placeholderBuilder: (_) => _buildFallback(size),
      );
    }
    return Image.file(
      File(path),
      width:    size,
      height:   size,
      fit:      widget.fit,
      color:    widget.color,
      errorBuilder: (_, __, ___) => _buildFallback(size),
    );
  }

  Widget _buildFromUrl(String url, double size) {
    if (url.endsWith('.svg') || url.contains('.svg?')) {
      return SvgPicture.network(
        url,
        width:       size,
        height:      size,
        fit:         widget.fit,
        colorFilter: _colorFilter,
        placeholderBuilder: (_) => widget.placeholder ?? _buildFallback(size),
      );
    }
    return Image.network(
      url,
      width:    size,
      height:   size,
      fit:      widget.fit,
      color:    widget.color,
      loadingBuilder: (_, child, progress) =>
          progress == null ? child : (widget.placeholder ?? _buildFallback(size)),
      errorBuilder: (_, __, ___) => _buildFallback(size),
    );
  }

  Widget _buildFromAsset(String assetPath, double size) {
    if (assetPath.endsWith('.svg')) {
      return SvgPicture.asset(
        assetPath,
        width:       size,
        height:      size,
        fit:         widget.fit,
        colorFilter: _colorFilter,
        placeholderBuilder: (_) => _buildFallback(size),
      );
    }
    return Image.asset(
      assetPath,
      width:  size,
      height: size,
      fit:    widget.fit,
      color:  widget.color,
      errorBuilder: (context, error, _) => _buildGenericFallback(context, size),
    );
  }

  Widget _buildFallback(double size) {
    if (widget.fallbackWidget != null) return widget.fallbackWidget!;
    // Try the generic bundled fallback asset
    return _buildFromAsset(IconConstants.genericFallbackAsset, size);
  }

  Widget _buildGenericFallback(BuildContext context, double size) {
    if (widget.fallbackWidget != null) return widget.fallbackWidget!;
    // Last resort: Material icon placeholder
    return Icon(
      Icons.image_not_supported_outlined,
      size:  size * 0.8,
      color: Theme.of(context).colorScheme.outlineVariant,
    );
  }

  ColorFilter? get _colorFilter => widget.color != null
      ? ColorFilter.mode(widget.color!, BlendMode.srcIn)
      : null;
}
