import 'package:exif/exif.dart';

/// Build raw EXIF map for publish — keys match `read_exif_publish_raw` in desktop uploader.
Future<Map<String, Object?>> readExifPublishRaw(List<int> bytes) async {
  final data = await readExifFromBytes(bytes);
  if (data.isEmpty) return {};

  final out = <String, Object?>{};

  void ascii(String key, List<String> tagNames) {
    final s = _firstTagString(data, tagNames);
    if (s != null) out[key] = s;
  }

  void number(String key, List<String> tagNames) {
    final n = _firstTagNumber(data, tagNames);
    if (n != null) out[key] = n;
  }

  ascii('Make', ['Make', 'Image Make']);
  ascii('Model', ['Model', 'Image Model']);
  ascii('LensMake', ['LensMake', 'EXIF LensMake']);
  ascii('LensModel', ['LensModel', 'EXIF LensModel']);
  number('FocalLength', ['FocalLength', 'EXIF FocalLength']);
  number('FocalLengthIn35mmFormat', [
    'FocalLengthIn35mmFilm',
    'EXIF FocalLengthIn35mmFilm',
    'FocalLengthIn35mmFormat',
  ]);
  number('FNumber', ['FNumber', 'EXIF FNumber', 'ApertureValue']);
  number('ExposureTime', ['ExposureTime', 'EXIF ExposureTime']);
  number('ISO', ['PhotographicSensitivity', 'ISOSpeedRatings', 'EXIF ISOSpeedRatings']);
  number('ExposureProgram', ['ExposureProgram', 'EXIF ExposureProgram']);
  number('MeteringMode', ['MeteringMode', 'EXIF MeteringMode']);
  number('Flash', ['Flash', 'EXIF Flash']);
  number('WhiteBalance', ['WhiteBalance', 'EXIF WhiteBalance']);
  number('Orientation', ['Orientation', 'Image Orientation']);
  ascii('DateTimeOriginal', ['DateTimeOriginal', 'EXIF DateTimeOriginal']);
  ascii('CreateDate', ['DateTime', 'Image DateTime']);
  ascii('ModifyDate', ['DateTimeDigitized', 'EXIF DateTimeDigitized']);
  number('ImageWidth', ['ImageWidth', 'Image ImageWidth']);
  number('ImageHeight', ['ImageLength', 'Image ImageLength']);
  number('ExifImageWidth', ['PixelXDimension', 'EXIF ExifImageWidth', 'EXIF PixelXDimension']);
  number('ExifImageHeight', ['PixelYDimension', 'EXIF ExifImageHeight', 'EXIF PixelYDimension']);
  number('ColorSpace', ['ColorSpace', 'EXIF ColorSpace']);
  ascii('Software', ['Software', 'Image Software']);
  ascii('Artist', ['Artist', 'Image Artist']);
  ascii('Copyright', ['Copyright', 'Image Copyright']);
  ascii('Description', ['ImageDescription', 'Image Description']);

  for (final entry in out.entries.toList()) {
    if (entry.key.startsWith('Date') || entry.key.contains('Date')) {
      final parsed = _parseExifDate(entry.value);
      if (parsed != null) out[entry.key] = parsed;
    }
  }

  return out;
}

String? _firstTagString(Map<String, IfdTag> data, List<String> names) {
  for (final name in names) {
    final tag = data[name];
    if (tag == null) continue;
    final s = tag.printable.trim();
    if (s.isNotEmpty) return s;
  }
  return null;
}

double? _firstTagNumber(Map<String, IfdTag> data, List<String> names) {
  for (final name in names) {
    final tag = data[name];
    if (tag == null) continue;
    final n = _tagToDouble(tag);
    if (n != null) return n;
  }
  return null;
}

double? _tagToDouble(IfdTag tag) {
  if (tag.values.length == 0) return null;
  final values = tag.values.toList();
  final first = values.first;
  if (first is int) return first.toDouble();
  if (first is double) return first;
  if (first is Ratio) {
    if (first.denominator == 0) return null;
    return first.numerator / first.denominator;
  }
  final parsed = double.tryParse(tag.printable.trim());
  return parsed;
}

DateTime? _parseExifDate(Object? value) {
  if (value is DateTime) return value;
  if (value is! String) return null;
  final raw = value.trim();
  if (raw.isEmpty) return null;
  final parts = raw.split(RegExp(r'[:\s]'));
  if (parts.length < 3) return null;
  try {
    final y = int.parse(parts[0]);
    final m = int.parse(parts[1]);
    final d = int.parse(parts[2]);
    final h = parts.length > 3 ? int.parse(parts[3]) : 0;
    final min = parts.length > 4 ? int.parse(parts[4]) : 0;
    final s = parts.length > 5 ? int.parse(parts[5]) : 0;
    return DateTime(y, m, d, h, min, s);
  } catch (_) {
    return null;
  }
}
