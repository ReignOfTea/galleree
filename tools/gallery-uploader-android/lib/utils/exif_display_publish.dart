import 'package:intl/intl.dart';

import 'exif_publish_raw.dart';

/// Mirrors `src/lib/exifDisplay.ts` for published sidecar rows.
class ExifDisplayRow {
  const ExifDisplayRow({required this.label, required this.value});

  final String label;
  final String value;

  Map<String, String> toJson() => {'label': label, 'value': value};
}

const _labels = <String, String>{
  'Make': 'Camera make',
  'Model': 'Camera model',
  'LensMake': 'Lens make',
  'LensModel': 'Lens',
  'FocalLength': 'Focal length',
  'FocalLengthIn35mmFormat': 'Focal length (35mm eq.)',
  'FNumber': 'Aperture',
  'ExposureTime': 'Shutter speed',
  'ISO': 'ISO',
  'ISOSpeedRatings': 'ISO',
  'ExposureProgram': 'Exposure program',
  'MeteringMode': 'Metering mode',
  'Flash': 'Flash',
  'WhiteBalance': 'White balance',
  'Orientation': 'Orientation',
  'DateTimeOriginal': 'Date (original)',
  'CreateDate': 'Date (created)',
  'ModifyDate': 'Date (modified)',
  'ImageWidth': 'Width',
  'ImageHeight': 'Height',
  'ExifImageWidth': 'Width',
  'ExifImageHeight': 'Height',
  'ColorSpace': 'Color space',
  'Software': 'Software',
  'Artist': 'Artist',
  'Copyright': 'Copyright',
  'Title': 'Title',
  'Description': 'Description',
  'Keywords': 'Keywords',
  'Country': 'Country',
  'City': 'City',
  'Sublocation': 'Location',
};

const _preferredOrder = [
  'Make',
  'Model',
  'LensModel',
  'FocalLength',
  'FocalLengthIn35mmFormat',
  'FNumber',
  'ExposureTime',
  'ISO',
  'ISOSpeedRatings',
  'ExposureProgram',
  'MeteringMode',
  'Flash',
  'WhiteBalance',
  'DateTimeOriginal',
  'CreateDate',
  'ModifyDate',
  'ImageWidth',
  'ImageHeight',
  'ExifImageWidth',
  'ExifImageHeight',
  'Orientation',
  'ColorSpace',
  'Software',
  'Artist',
  'Copyright',
];

const _privateLabels = {
  'Artist',
  'Copyright',
  'Software',
  'Owner name',
  'Camera owner name',
  'Serial number',
  'Image unique ID',
  'User comment',
  'GPS latitude',
  'GPS longitude',
  'GPS altitude',
  'GPS position',
};

final _skipKey = RegExp(
  r'^(thumbnail|MakerNote|PrintImageMatching|CFAPattern|ComponentsConfiguration)$',
  caseSensitive: false,
);

final _privateKey = RegExp(
  r'^(GPS|Artist|Owner|UserComment|Serial|Software|Copyright|Subsec|ImageUniqueID|CameraOwner|BodySerial)',
  caseSensitive: false,
);

final _publishDateFormat = DateFormat.yMMMd('en_US').add_jm();

List<ExifDisplayRow> exifToDisplayRowsForPublish(
  Map<String, Object?> raw, {
  int maxRows = 24,
}) {
  final rows = <ExifDisplayRow>[];
  final seen = <String>{};

  void pushKey(String key) {
    if (_skipKey.hasMatch(key) || _privateKey.hasMatch(key) || seen.contains(key)) {
      return;
    }
    final val = raw[key];
    if (_isSkippableValue(val)) return;
    final formatted = _formatValue(key, val);
    if (formatted == null) return;
    seen.add(key);
    rows.add(ExifDisplayRow(label: _labelForKey(key), value: formatted));
  }

  for (final key in _preferredOrder) {
    if (raw.containsKey(key)) pushKey(key);
    if (rows.length >= maxRows) break;
  }

  return sanitizeExifRowsForPublish(rows).take(maxRows).toList();
}

List<ExifDisplayRow> sanitizeExifRowsForPublish(List<ExifDisplayRow> rows) {
  return rows.where((r) => !_privateLabels.contains(r.label)).toList();
}

/// Build sidecar `exifDisplay` rows from image bytes; tries [fallbackBytes] when primary is empty.
Future<List<Map<String, String>>?> buildExifDisplayForPublish(
  List<int> primaryBytes, {
  List<int>? fallbackBytes,
}) async {
  var raw = await readExifPublishRaw(primaryBytes);
  if (raw.isEmpty && fallbackBytes != null) {
    raw = await readExifPublishRaw(fallbackBytes);
  }
  final rows = exifToDisplayRowsForPublish(raw);
  if (rows.isEmpty) return null;
  return rows.map((row) => row.toJson()).toList();
}

bool _isSkippableValue(Object? v) {
  if (v == null) return true;
  if (v is List && v.length > 12) return true;
  return false;
}

String _labelForKey(String key) {
  final known = _labels[key];
  if (known != null) return known;
  return key
      .replaceAllMapped(RegExp(r'([A-Z])([a-z])'), (m) => ' ${m[1]}${m[2]}')
      .trim()
      .replaceFirstMapped(RegExp(r'^.'), (m) => m.group(0)!.toUpperCase());
}

String? _formatValue(String key, Object? v) {
  if (v == null) return null;
  if (v is num) {
    if (!v.isFinite) return null;
    if (key == 'ExposureTime') return _formatExposureSeconds(v.toDouble());
    if (key == 'FNumber') return 'f/$v';
    if (key == 'FocalLength' || key == 'FocalLengthIn35mmFormat') {
      return '${v.round()} mm';
    }
    return v.toString();
  }
  if (v is bool) return v ? 'Yes' : 'No';
  if (v is DateTime) return _publishDateFormat.format(v.toLocal());
  if (v is String) {
    final t = v.trim();
    return t.isEmpty ? null : t;
  }
  if (v is List) {
    final parts = v
        .map((x) => x is String || x is num ? x.toString() : null)
        .whereType<String>()
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }
  return null;
}

String _formatExposureSeconds(double v) {
  if (v >= 1) return '${v % 1 == 0 ? v.toInt() : v.toStringAsFixed(1)} s';
  final inv = (1 / v).round();
  return '1/$inv s';
}
