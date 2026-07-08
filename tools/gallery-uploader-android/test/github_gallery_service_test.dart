import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/services/github_gallery_io.dart';

void main() {
  test('findGitHubArchiveRootPrefix finds public/ in tarball layout', () {
    final archive = Archive()
      ..addFile(ArchiveFile('ReignOfTea-galleree-abc/public/site.json', 2, [123, 125]))
      ..addFile(
        ArchiveFile(
          'ReignOfTea-galleree-abc/public/gallery/meta/collections/foo.json',
          2,
          [123, 125],
        ),
      );

    expect(findGitHubArchiveRootPrefix(archive), 'ReignOfTea-galleree-abc/');
  });

  test('gzip tarball decodes to archive with public files', () {
    final inner = Archive()
      ..addFile(ArchiveFile('owner-repo-sha/public/site.json', 2, [123, 125]))
      ..addFile(ArchiveFile('owner-repo-sha/public/gallery/abc.jpg', 3, [1, 2, 3]));
    final gzipped = GZipEncoder().encode(TarEncoder().encode(inner));

    final tarBytes = GZipDecoder().decodeBytes(gzipped);
    final archive = TarDecoder().decodeBytes(tarBytes);

    expect(findGitHubArchiveRootPrefix(archive), 'owner-repo-sha/');
    expect(archive.files.where((f) => f.isFile).length, 2);
  });
}
