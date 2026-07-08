import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

class ExtractTarballRequest {
  const ExtractTarballRequest({
    required this.gzipBytes,
    required this.workdir,
    this.mergeGallery = false,
  });

  final Uint8List gzipBytes;
  final String workdir;
  final bool mergeGallery;
}

/// Decode a GitHub gzip tarball and write `public/**` into [workdir].
/// Runs on a background isolate — must be a top-level function.
void extractGitHubTarballToWorkdir(ExtractTarballRequest request) {
  final Archive archive;
  try {
    final tarBytes = GZipDecoder().decodeBytes(request.gzipBytes);
    archive = TarDecoder().decodeBytes(tarBytes);
  } catch (e) {
    throw StateError('Could not read GitHub archive: $e');
  }

  final rootPrefix = findGitHubArchiveRootPrefix(archive);
  if (rootPrefix == null) {
    throw StateError('Downloaded archive has no public/ folder');
  }

  final destRoot = Directory(request.workdir);
  if (!request.mergeGallery) {
    if (destRoot.existsSync()) {
      destRoot.deleteSync(recursive: true);
    }
    destRoot.createSync(recursive: true);
  }

  for (final file in archive.files) {
    if (!file.isFile) continue;
    final name = file.name.replaceAll(r'\', '/');
    if (!name.startsWith(rootPrefix)) continue;
    final rel = name.substring(rootPrefix.length);
    if (!rel.startsWith('public/')) continue;
    if (rel.contains('public/gallery/thumbs/') || rel.contains('public/gallery/display/')) {
      continue;
    }
    final outPath = p.join(request.workdir, rel.replaceAll('/', p.separator));
    if (request.mergeGallery && File(outPath).existsSync()) continue;
    Directory(p.dirname(outPath)).createSync(recursive: true);
    File(outPath).writeAsBytesSync(Uint8List.fromList(file.content as List<int>));
  }
}

/// SHA-256 hashes of gallery originals for dedup (sync; tests and small folders).
Set<String> computeGalleryImageHashes(String galleryDir) {
  final hashes = <String>{};
  final gallery = Directory(galleryDir);
  if (!gallery.existsSync()) return hashes;
  for (final entity in gallery.listSync()) {
    if (entity is! File) continue;
    final name = p.basename(entity.path);
    if (!RegExp(r'^[a-f0-9]{32}\.[a-z]+$').hasMatch(name)) continue;
    hashes.add(sha256.convert(entity.readAsBytesSync()).toString());
  }
  return hashes;
}

final _galleryImagePattern = RegExp(r'^[a-f0-9]{32}\.[a-z]+$');

/// Pause long enough for the Windows runner to drain its message queue.
const _windowsYield = Duration(milliseconds: 16);

/// Yields to the UI thread between files so Windows stays responsive.
Future<Set<String>> computeGalleryImageHashesAsync(String galleryDir) async {
  final hashes = <String>{};
  final gallery = Directory(galleryDir);
  if (!gallery.existsSync()) return hashes;

  final files = gallery
      .listSync()
      .whereType<File>()
      .where((file) => _galleryImagePattern.hasMatch(p.basename(file.path)))
      .toList();

  for (var i = 0; i < files.length; i++) {
    final bytes = await files[i].readAsBytes();
    hashes.add(sha256.convert(bytes).toString());
    if (i % 8 == 7) {
      await Future<void>.delayed(_windowsYield);
    }
  }
  return hashes;
}

/// GitHub repo tarballs are gzip-compressed; entries look like
/// `{owner}-{repo}-{sha}/public/gallery/...`.
String? findGitHubArchiveRootPrefix(Archive archive) {
  for (final file in archive.files) {
    if (!file.isFile) continue;
    final name = file.name.replaceAll(r'\', '/');
    final idx = name.indexOf('public/');
    if (idx >= 0) return name.substring(0, idx);
  }
  return null;
}
