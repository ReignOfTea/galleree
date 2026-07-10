import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/models/gallery_meta.dart';
import 'package:gallery_uploader_android/services/app_storage.dart';
import 'package:gallery_uploader_android/services/gallery_services.dart';
import 'package:path/path.dart' as p;

void main() {
  test('loadGalleryContentHashIndexSync reads contentHash from sidecars', () {
    final dir = Directory.systemTemp.createTempSync('galleree-hash-index');
    addTearDown(() => dir.deleteSync(recursive: true));

    final paths = GalleryPaths(dir.path);
    Directory(paths.metaDir).createSync(recursive: true);

    final id = 'b' * 32;
    final hash = 'a' * 64;
    File(p.join(paths.metaDir, '$id.json')).writeAsStringSync(
      jsonEncode({
        'version': 1,
        'id': id,
        'title': 'Sample',
        'tags': ['test'],
        'contentHash': hash,
      }),
    );

    final index = loadGalleryContentHashIndexSync(paths);
    expect(index.length, 1);
    expect(index[hash]?.title, 'Sample');
  });

  test('sha256HexBytes matches known digest', () {
    final digest = sha256HexBytes(utf8.encode('hello'));
    expect(digest, sha256.convert(utf8.encode('hello')).toString());
    expect(isValidContentHash(digest), isTrue);
  });
}
