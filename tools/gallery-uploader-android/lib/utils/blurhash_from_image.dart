import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

import 'blurhash_encode_ts.dart';

/// Encode a 4×4 BlurHash from image bytes (32×32 max, fit inside).
/// Prefer passing the 720px thumb bytes so this matches site `generate-assets`.
String? blurHashFromImageBytes(List<int> bytes) {
  try {
    final decoded = img.decodeImage(Uint8List.fromList(bytes));
    if (decoded == null) return null;
    final oriented = img.bakeOrientation(decoded);
    final resized = _resizeInside(oriented, 32, 32);
    final rgba = resized.getBytes(order: img.ChannelOrder.rgba);
    return encodeBlurHashTs(
      Uint8List.fromList(rgba),
      resized.width,
      resized.height,
    );
  } catch (_) {
    return null;
  }
}

img.Image _resizeInside(img.Image image, int maxW, int maxH) {
  if (image.width <= maxW && image.height <= maxH) return image;
  final scale = math.min(maxW / image.width, maxH / image.height);
  final w = math.max(1, (image.width * scale).round());
  final h = math.max(1, (image.height * scale).round());
  return img.copyResize(image, width: w, height: h);
}
