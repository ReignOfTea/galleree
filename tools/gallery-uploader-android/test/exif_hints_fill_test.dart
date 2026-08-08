import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/models/models.dart';
import 'package:gallery_uploader_android/services/gallery_services.dart';

UploadRow _row({
  String location = '',
  String captureDate = '',
  String captureDateTimeIso = '',
}) {
  return UploadRow(
    id: 'queue-1',
    sourcePath: '/tmp/photo.jpg',
    title: 'Sunset',
    location: location,
    captureDate: captureDate,
    captureDateTimeIso: captureDateTimeIso,
    destId: 'a1b2c3d4e5f6478990a1b2c3d4e5f678',
    destFilename: 'a1b2c3d4e5f6478990a1b2c3d4e5f678.jpg',
  );
}

void main() {
  test('fillMissingFromExifHints fills empty date and location', () {
    final hints = ExifHints(
      captureDateTime: DateTime.utc(2024, 6, 1, 12, 30),
      location: 'Manchester',
    );
    final next = fillMissingFromExifHints(_row(), hints);
    expect(next.location, 'Manchester');
    expect(next.captureDate, '2024-06-01');
    expect(next.captureDateTimeIso, isNotEmpty);
  });

  test('fillMissingFromExifHints does not overwrite existing values', () {
    final hints = ExifHints(
      captureDateTime: DateTime.utc(2024, 6, 1, 12, 30),
      location: 'Manchester',
    );
    final next = fillMissingFromExifHints(
      _row(
        location: 'London',
        captureDate: '2020-01-01',
        captureDateTimeIso: '2020-01-01T10:00:00.000Z',
      ),
      hints,
    );
    expect(next.location, 'London');
    expect(next.captureDate, '2020-01-01');
    expect(next.captureDateTimeIso, '2020-01-01T10:00:00.000Z');
  });

  test('fillMissingFromSessionDefaults fills empty fields only', () {
    final defaults = SessionDefaults(location: 'Birmingham', captureDate: '2025-03-10');
    final next = fillMissingFromSessionDefaults(_row(), defaults);
    expect(next.location, 'Birmingham');
    expect(next.captureDate, '2025-03-10');
    expect(next.captureDateTimeIso, '2025-03-10T12:00:00.000Z');
  });

  test('fillMissingFromExifHints syncs captureDate from iso', () {
    final next = fillMissingFromExifHints(
      _row(captureDateTimeIso: '2024-06-01T12:00:00.000Z'),
      ExifHints(),
    );
    expect(next.captureDate, '2024-06-01');
  });
}
