import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/models/models.dart';
import 'package:gallery_uploader_android/utils/upload_row_meta.dart';

UploadRow _row({
  String id = 'queue-1',
  String destId = 'a1b2c3d4e5f6478990a1b2c3d4e5f678',
  String title = 'Sunset',
  String tags = '',
  String location = 'London',
  String captureDate = '2024-06-01',
  String captureDateTimeIso = '2024-06-01T12:00:00.000Z',
}) {
  return UploadRow(
    id: id,
    sourcePath: '/tmp/photo.jpg',
    title: title,
    tags: tags,
    location: location,
    captureDate: captureDate,
    captureDateTimeIso: captureDateTimeIso,
    destId: destId,
    destFilename: '$destId.jpg',
  );
}

void main() {
  test('validateUploadRowForPublish accepts a minimal valid row', () {
    expect(validateUploadRowForPublish(_row()), isNull);
  });

  test('validateUploadRowForPublish rejects empty title', () {
    expect(
      validateUploadRowForPublish(_row(title: '  ')),
      'Every photo needs a title before upload.',
    );
  });

  test('validateUploadRowForPublish rejects empty location', () {
    expect(
      validateUploadRowForPublish(_row(location: '  ')),
      contains('location is required'),
    );
  });

  test('validateUploadRowForPublish rejects missing capture date/time', () {
    expect(
      validateUploadRowForPublish(_row(captureDate: '', captureDateTimeIso: '')),
      contains('capture date/time is required'),
    );
  });

  test('validateUploadRowForPublish rejects long title', () {
    final error = validateUploadRowForPublish(_row(title: 'x' * 201));
    expect(error, contains('title must be at most 200 characters'));
  });

  test('validateUploadRowForPublish rejects long tag after normalization', () {
    final error = validateUploadRowForPublish(
      _row(tags: ' ${'tag' * 30} '),
    );
    expect(error, contains('each tag must be 1–80 characters'));
  });

  test('validateUploadRowForPublish rejects invalid capture date', () {
    final error = validateUploadRowForPublish(
      _row(captureDate: '2024-13-40', captureDateTimeIso: ''),
    );
    expect(error, contains('capture date'));
  });

  test('validateUploadRowForPublish rejects invalid collection slug', () {
    final error = validateUploadRowForPublish(
      _row()..collectionSelect = 'Bad Slug!',
    );
    expect(error, contains('collection slug is invalid'));
  });

  test('validateUploadRowForPublish rejects non-numeric sort order', () {
    final error = validateUploadRowForPublish(
      _row()..sortOrder = 'abc',
    );
    expect(error, contains('sort order must be a number'));
  });

  test('galleryMetaFromUploadRow matches schema-shaped output', () {
    final meta = galleryMetaFromUploadRow(_row(tags: 'landscape, sunset'));
    expect(meta.title, 'Sunset');
    expect(meta.tags, ['Landscape', 'Sunset']);
    expect(meta.id, 'a1b2c3d4e5f6478990a1b2c3d4e5f678');
    expect(meta.location, 'London');
    expect(meta.capturedOn, '2024-06-01');
    expect(meta.capturedAt, isNotNull);
  });
}
