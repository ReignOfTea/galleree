import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/models/models.dart';
import 'package:gallery_uploader_android/utils/batch_edit.dart';

UploadRow _row({String id = 'a', String captureDate = '', String captureDateTimeIso = ''}) {
  return UploadRow(
    id: id,
    sourcePath: '/tmp/$id.jpg',
    title: 'Title',
    captureDate: captureDate,
    captureDateTimeIso: captureDateTimeIso,
  );
}

void main() {
  group('applyCaptureDatePatch', () {
    test('sets date and preserves time from existing ISO', () {
      final row = _row(captureDateTimeIso: '2020-01-15T08:30:00.000Z');
      final next = applyCaptureDatePatch(row, '2024-06-01');
      expect(next.captureDate, '2024-06-01');
      expect(next.captureDateTimeIso, '2024-06-01T08:30:00.000Z');
    });

    test('sets default noon UTC when no ISO exists', () {
      final row = _row();
      final next = applyCaptureDatePatch(row, '2024-06-01');
      expect(next.captureDate, '2024-06-01');
      expect(next.captureDateTimeIso, '2024-06-01T12:00:00.000Z');
    });

    test('clears date fields', () {
      final row = _row(
        captureDate: '2024-06-01',
        captureDateTimeIso: '2024-06-01T08:30:00.000Z',
      );
      final next = applyCaptureDatePatch(row, '');
      expect(next.captureDate, '');
      expect(next.captureDateTimeIso, '');
    });
  });

  group('applyBatchEdit', () {
    test('applies capture date to scoped rows only', () {
      final rows = [
        _row(id: 'a'),
        _row(id: 'b'),
      ];
      final result = applyBatchEdit(
        rows,
        {'b'},
        const BatchEditPatch(captureDate: '2025-03-10'),
      );
      expect(result[0].captureDate, '');
      expect(result[1].captureDate, '2025-03-10');
      expect(result[1].captureDateTimeIso, '2025-03-10T12:00:00.000Z');
    });

    test('clears capture date via batch patch', () {
      final rows = [
        _row(
          id: 'a',
          captureDate: '2024-01-01',
          captureDateTimeIso: '2024-01-01T10:00:00.000Z',
        ),
      ];
      final result = applyBatchEdit(rows, null, const BatchEditPatch(captureDate: ''));
      expect(result[0].captureDate, '');
      expect(result[0].captureDateTimeIso, '');
    });

    test('sets and clears copyright', () {
      final rows = [_row(id: 'a')..copyright = 'Old'];
      final set = applyBatchEdit(rows, null, const BatchEditPatch(copyright: '© 2026'));
      expect(set[0].copyright, '© 2026');
      final cleared = applyBatchEdit(set, null, const BatchEditPatch(copyright: ''));
      expect(cleared[0].copyright, '');
    });
  });
}
