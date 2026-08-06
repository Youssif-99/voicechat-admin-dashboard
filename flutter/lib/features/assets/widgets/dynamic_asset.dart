import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/asset_constants.dart';
import '../provider/asset_provider_scope.dart';

/// Renders a remotely-configurable application asset by [assetKey].
///
/// Rendering pipeline (never crashes, never shows broken state):
///   1. Sync memory-cache hit → renders immediately (zero flicker)
///   2. Async resolution → shows [placeholder] while loading
///   3. Disk path (SVG / PNG / WEBP / JPG) → renders local file
///   4. Remote URL → renders network image
///   5. Bundled fallback asset → renders from Flutter assets
///   6. Generic fallback → [fallbackWidget] or default icon
///
/// Usage:
/// ```dart
/// DynamicAsset(
///   assetKey: AssetKeys.homeIcon,
///   size: 26,
///   color: Theme.of(context).colorScheme.primary,
/// )
/// ```
class DynamicAsset extends StatefulWidget {
  const DynamicAsset({
    super.key,
    required this.assetKey,
    this.size,
    this.width,
    this.height,
    this.color,
    this.semanticLabel,
    this.placeholder,
    this.fallbackWidget,
    this.fit = BoxFit.contain,
  });

  final String  assetKey;
  final double? size;
  final double? width;
  final double? height;
  final Color?  color;
  final String? semanticLabel;
  final Widget? placeholder;
  final Widget? fallbackWidget;
  final BoxFit  fit;

  @override
  State<DynamicAsset> createState() => _DynamicAssetState();
}

class _DynamicAssetState extends State<DynamicAsset> {
  AssetDisplaySource? _source;
  bool _resolving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncResolve();
  }

  @override
  void didUpdateWidget(DynamicAsset old) {
    super.didUpdateWidget(old);
    if (old.assetKey != widget.assetKey) {
      _source    = null;
      _resolving = false;
      _syncResolve();
    }
  }

  void _syncResolve() {
    final provider = AssetProviderScope.maybeOf(context);
    if (provider == null) return;

    final sync = provider.resolveSourceSync(widget.assetKey);
    if (sync != null) {
      _source = sync;
      return;
    }

    if (!_resolving) {
      _resolving = true;
      provider.resolveSource(widget.assetKey).then((src) {
        if (mounted) setState(() { _source = src; _resolving = false; });
      }).catchError((_) {
        if (mounted) setState(() { _resolving = false; });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.width  ?? widget.size ?? AssetConstants.defaultAssetSize;
    final h = widget.height ?? widget.size ?? AssetConstants.defaultAssetSize;

    return Semantics(
      label: widget.semanticLabel,
      image: true,
      child: SizedBox(width: w, height: h, child: _buildContent(w, h)),
    );
  }

  Widget _buildContent(double w, double h) {
    if (_resolving || _source == null) {
      return widget.placeholder ?? _fallback(w, h);
    }

    final src = _source!;

    if (src.diskPath != null)   return _fromDisk(src.diskPath!, w, h);
    if (src.remoteUrl != null)  return _fromUrl(src.remoteUrl!, w, h);
    if (src.assetPath != null)  return _fromAsset(src.assetPath!, w, h);
    return _fallback(w, h);
  }

  // ── Renderers ─────────────────────────────────────────────────────────────

  Widget _fromDisk(String path, double w, double h) {
    if (path.endsWith('.svg')) {
      return SvgPicture.file(
        File(path),
        width:  w, height: h, fit: widget.fit,
        colorFilter: _colorFilter,
        placeholderBuilder: (_) => _fallback(w, h),
      );
    }
    return Image.file(
      File(path),
      width: w, height: h, fit: widget.fit, color: widget.color,
      errorBuilder: (_, __, ___) => _fallback(w, h),
    );
  }

  Widget _fromUrl(String url, double w, double h) {
    if (url.contains('.svg')) {
      return SvgPicture.network(
        url,
        width: w, height: h, fit: widget.fit,
        colorFilter: _colorFilter,
        placeholderBuilder: (_) => widget.placeholder ?? _fallback(w, h),
      );
    }
    return Image.network(
      url,
      width: w, height: h, fit: widget.fit, color: widget.color,
      loadingBuilder: (_, child, progress) =>
          progress == null ? child : (widget.placeholder ?? _fallback(w, h)),
      errorBuilder: (_, __, ___) => _fallback(w, h),
    );
  }

  Widget _fromAsset(String assetPath, double w, double h) {
    if (assetPath.endsWith('.svg')) {
      return SvgPicture.asset(
        assetPath,
        width: w, height: h, fit: widget.fit,
        colorFilter: _colorFilter,
        placeholderBuilder: (_) => _fallback(w, h),
      );
    }
    return Image.asset(
      assetPath,
      width: w, height: h, fit: widget.fit, color: widget.color,
      errorBuilder: (ctx, _, __) => _genericFallback(ctx, w, h),
    );
  }

  Widget _fallback(double w, double h) {
    if (widget.fallbackWidget != null) return widget.fallbackWidget!;
    return _fromAsset(AssetConstants.genericFallbackAsset, w, h);
  }

  Widget _genericFallback(BuildContext ctx, double w, double h) {
    if (widget.fallbackWidget != null) return widget.fallbackWidget!;
    return Icon(
      Icons.image_not_supported_outlined,
      size:  w * 0.8,
      color: Theme.of(ctx).colorScheme.outlineVariant,
    );
  }

  ColorFilter? get _colorFilter => widget.color != null
      ? ColorFilter.mode(widget.color!, BlendMode.srcIn)
      : null;
}
