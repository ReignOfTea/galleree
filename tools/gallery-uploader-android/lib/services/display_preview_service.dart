import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:image/image.dart' as img;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Max width for local lightbox preview (production display WebP is built on CI).
const displayPreviewMaxWidth = 2400;
const _jpegQuality = 88;

class DisplayPreviewService {
  Future<String> ensureDisplayPreview(String sourcePath) async {
    final src = File(sourcePath);
    if (!src.existsSync()) {
      throw StateError('Source not found: $sourcePath');
    }
    final stat = await src.stat();
    final key = '$sourcePath:${stat.size}:${stat.modified.millisecondsSinceEpoch}';
    final digest = sha256.convert(utf8.encode(key)).toString();
    final cacheDir = Directory(p.join((await getTemporaryDirectory()).path, 'display-preview'));
    cacheDir.createSync(recursive: true);
    final cacheFile = File(p.join(cacheDir.path, '$digest.jpg'));
    if (cacheFile.existsSync()) return cacheFile.path;

    final bytes = await src.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) throw StateError('Could not decode image.');
    final resized = _resizeMaxSide(decoded, displayPreviewMaxWidth);
    final jpg = img.encodeJpg(resized, quality: _jpegQuality);
    await cacheFile.writeAsBytes(jpg);
    return cacheFile.path;
  }

  img.Image _resizeMaxSide(img.Image image, int maxSide) {
    final w = image.width;
    final h = image.height;
    final m = w > h ? w : h;
    if (m <= maxSide) return image;
    final scale = maxSide / m;
    final nw = (w * scale).round().clamp(1, 1 << 20);
    final nh = (h * scale).round().clamp(1, 1 << 20);
    return img.copyResize(image, width: nw, height: nh, interpolation: img.Interpolation.average);
  }
}
