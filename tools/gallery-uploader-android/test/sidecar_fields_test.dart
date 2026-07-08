import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/utils/blurhash_encode_ts.dart';
import 'package:gallery_uploader_android/utils/blurhash_from_image.dart';
import 'package:gallery_uploader_android/utils/exif_display_publish.dart';

void main() {
  final repoRoot = Directory.current.path.contains('gallery-uploader-android')
      ? Directory('${Directory.current.path}/../..')
      : Directory.current;
  final sample = File(
    '${repoRoot.path}/public/gallery/6e10c52720b44d28b2ce715c61d15d04.jpg',
  );
  final pixelFixture = File(
    '${Directory.current.path}/fixtures/blur_pixels.json',
  );

  test('blurHash TS encoder matches npm output on sharp pixels', () {
    if (!pixelFixture.existsSync()) return;
    final raw = jsonDecode(pixelFixture.readAsStringSync()) as Map<String, dynamic>;
    final width = raw['width'] as int;
    final height = raw['height'] as int;
    final data = Uint8List.fromList((raw['data'] as List).cast<int>());
    final hash = encodeBlurHashTs(data, width, height);
    expect(hash, 'UMD9ky\$%B:pc?^afI@gNElWBiwRjo#tQxWad');
  });

  test('blurHashFromImageBytes returns a hash for a gallery sample', () {
    if (!sample.existsSync()) return;
    final hash = blurHashFromImageBytes(sample.readAsBytesSync());
    expect(hash, isNotNull);
    expect(hash!.length, greaterThanOrEqualTo(6));
  });

  test('buildExifDisplayForPublish reads EXIF from sample image', () async {
    if (!sample.existsSync()) return;
    final rows = await buildExifDisplayForPublish(sample.readAsBytesSync());
    expect(rows, isNotNull);
    expect(rows!.any((r) => r['label'] == 'Camera make' && r['value'] == 'SONY'), isTrue);
    expect(rows.any((r) => r['label'] == 'Aperture' && r['value'] == 'f/6.3'), isTrue);
  });
}
