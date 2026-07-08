import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../services/local_image_thumbnail.dart';

/// Async thumbnail preview that decodes at display size and caches results.
class LocalImagePreview extends StatefulWidget {
  const LocalImagePreview({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  });

  final String path;
  final double? width;
  final double? height;
  final BoxFit fit;

  @override
  State<LocalImagePreview> createState() => _LocalImagePreviewState();
}

class _LocalImagePreviewState extends State<LocalImagePreview> {
  Uint8List? _previewBytes;
  bool _failed = false;
  int _loadGeneration = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ensureLoaded();
  }

  @override
  void didUpdateWidget(covariant LocalImagePreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.path != widget.path ||
        oldWidget.width != widget.width ||
        oldWidget.height != widget.height) {
      _loadGeneration++;
      _failed = false;
      _previewBytes = null;
      _ensureLoaded();
    }
  }

  void _ensureLoaded() {
    final target = _targetPixels(context);
    final cached = LocalImageThumbnailLoader.instance.cached(
      widget.path,
      target,
      target,
    );
    if (cached != null) {
      if (!identical(cached, _previewBytes)) {
        setState(() => _previewBytes = cached);
      }
      return;
    }
    if (_previewBytes != null || _failed) return;
    _loadPreview();
  }

  int _targetPixels(BuildContext context) {
    return previewTargetPixels(context, widget.width, logicalHeight: widget.height);
  }

  Future<void> _loadPreview() async {
    final generation = _loadGeneration;
    final target = _targetPixels(context);
    final bytes = await LocalImageThumbnailLoader.instance.load(
      path: widget.path,
      targetWidth: target,
      targetHeight: target,
    );
    if (!mounted || generation != _loadGeneration) return;
    setState(() {
      if (bytes == null) {
        _failed = true;
      } else {
        _previewBytes = bytes;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_previewBytes != null) {
      return Image.memory(
        _previewBytes!,
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
        filterQuality: FilterQuality.medium,
        gaplessPlayback: true,
        errorBuilder: (_, __, ___) => _placeholder(context),
      );
    }

    if (_failed) {
      return _placeholder(context);
    }

    return Container(
      width: widget.width,
      height: widget.height,
      alignment: Alignment.center,
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      child: const SizedBox(
        width: 22,
        height: 22,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }

  Widget _placeholder(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      alignment: Alignment.center,
      child: Icon(
        Icons.broken_image_outlined,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}
