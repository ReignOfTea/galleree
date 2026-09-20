import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/models/models.dart';
import 'package:gallery_uploader_android/utils/bulk_title.dart';

UploadRow _row(String id, String title) {
  return UploadRow(
    id: id,
    sourcePath: '/tmp/$id.jpg',
    title: title,
    destId: id.padRight(32, '0'),
    destFilename: '${id.padRight(32, '0')}.jpg',
  );
}

void main() {
  test('incrementalTitle formats a shared name plus #n', () {
    expect(incrementalTitle('My Gallery', 1), 'My Gallery #1');
    expect(incrementalTitle('  My Gallery  ', 2), 'My Gallery #2');
    expect(incrementalTitle('', 3), '#3');
  });

  test('incremental namer titles selected rows in queue order', () {
    final rows = [
      _row('a', 'Old A'),
      _row('b', 'Old B'),
      _row('c', 'Old C'),
    ];
    final next = applyBulkTitlesToRows(
      rows,
      {'c', 'a'},
      const BulkTitleOptions.incremental('My Gallery', start: 1),
    );

    expect(next[0].title, 'My Gallery #1');
    expect(next[1].title, 'Old B');
    expect(next[2].title, 'My Gallery #2');
  });

  test('incremental namer can start at a custom number', () {
    final rows = [_row('a', 'A'), _row('b', 'B')];
    final next = applyBulkTitlesToRows(
      rows,
      null,
      const BulkTitleOptions.incremental('Walk', start: 4),
    );
    expect(next.map((r) => r.title), ['Walk #4', 'Walk #5']);
  });

  test('incremental namer leaves titles unchanged when the name is blank', () {
    final rows = [_row('a', 'Keep me')];
    final next = applyBulkTitlesToRows(
      rows,
      null,
      const BulkTitleOptions.incremental('   '),
    );
    expect(next.single.title, 'Keep me');
  });
}
