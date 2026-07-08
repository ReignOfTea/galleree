import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Decodes local image previews off the UI thread with bounded concurrency.
class LocalImageThumbnailLoader {
  LocalImageThumbnailLoader._();

  static final instance = LocalImageThumbnailLoader._();

  static const _maxConcurrent = 3;
  static const _maxCacheEntries = 300;

  final _cache = LinkedHashMap<String, Uint8List>();
  final _pending = Queue<_ThumbnailJob>();
  int _active = 0;

  Uint8List? cached(String path, int targetWidth, int targetHeight) {
    final key = _cacheKey(path, targetWidth, targetHeight);
    final hit = _cache.remove(key);
    if (hit == null) return null;
    _cache[key] = hit;
    return hit;
  }

  Future<Uint8List?> load({
    required String path,
    required int targetWidth,
    required int targetHeight,
  }) async {
    final tw = targetWidth.clamp(1, 4096);
    final th = targetHeight.clamp(1, 4096);
    final cachedBytes = cached(path, tw, th);
    if (cachedBytes != null) return cachedBytes;

    final completer = Completer<Uint8List?>();
    _pending.add(_ThumbnailJob(path: path, targetWidth: tw, targetHeight: th, completer: completer));
    _pump();
    return completer.future;
  }

  void _pump() {
    while (_active < _maxConcurrent && _pending.isNotEmpty) {
      final job = _pending.removeFirst();
      _active++;
      unawaited(_run(job).whenComplete(() {
        _active--;
        _pump();
      }));
    }
  }

  Future<void> _run(_ThumbnailJob job) async {
    try {
      final file = File(job.path);
      if (!await file.exists()) {
        job.completer.complete(null);
        return;
      }
      final bytes = await file.readAsBytes();
      final codec = await ui.instantiateImageCodec(
        bytes,
        targetWidth: job.targetWidth,
        targetHeight: job.targetHeight,
      );
      final frame = await codec.getNextFrame();
      final image = frame.image;
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (byteData == null) {
        job.completer.complete(null);
        return;
      }
      final preview = byteData.buffer.asUint8List();
      _remember(job.path, job.targetWidth, job.targetHeight, preview);
      job.completer.complete(preview);
    } catch (_) {
      job.completer.complete(null);
    }
  }

  void _remember(String path, int targetWidth, int targetHeight, Uint8List bytes) {
    final key = _cacheKey(path, targetWidth, targetHeight);
    _cache.remove(key);
    while (_cache.length >= _maxCacheEntries) {
      _cache.remove(_cache.keys.first);
    }
    _cache[key] = bytes;
  }

  String _cacheKey(String path, int targetWidth, int targetHeight) =>
      '$path@${targetWidth}x$targetHeight';
}

class _ThumbnailJob {
  _ThumbnailJob({
    required this.path,
    required this.targetWidth,
    required this.targetHeight,
    required this.completer,
  });

  final String path;
  final int targetWidth;
  final int targetHeight;
  final Completer<Uint8List?> completer;
}

int previewTargetPixels(BuildContext context, double? logical, {double? logicalHeight}) {
  final dpr = MediaQuery.devicePixelRatioOf(context);
  if (logical != null || logicalHeight != null) {
    final w = ((logical ?? logicalHeight!) * dpr).round();
    final h = ((logicalHeight ?? logical!) * dpr).round();
    return w > h ? w : h;
  }
  final shortest = MediaQuery.sizeOf(context).shortestSide;
  return (shortest * dpr).round().clamp(256, 2048);
}
