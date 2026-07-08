import '../models/models.dart';

final _cameraPrefixRe = RegExp(
  r'^(DSC[_-]?|IMG[_-]?|_?MG[_-]?|P\d{7}|GH\d{2}|GOPR\d{4}|DJI[_-]?|SAM[_-]?|PA\d{6}|DSCN\d{4})',
  caseSensitive: false,
);

enum BulkTitleMode {
  prefix,
  suffix,
  stripCameraPrefix,
  number,
}

class BulkTitleOptions {
  const BulkTitleOptions.prefix(this.text)
      : mode = BulkTitleMode.prefix,
        start = 0,
        pad = 0;
  const BulkTitleOptions.suffix(this.text)
      : mode = BulkTitleMode.suffix,
        start = 0,
        pad = 0;
  const BulkTitleOptions.stripCameraPrefix()
      : mode = BulkTitleMode.stripCameraPrefix,
        text = '',
        start = 0,
        pad = 0;
  const BulkTitleOptions.number({this.start = 1, this.pad = 0})
      : mode = BulkTitleMode.number,
        text = '';

  final BulkTitleMode mode;
  final String text;
  final int start;
  final int pad;
}

String _fileBaseName(String path) {
  final name = path.split(RegExp(r'[/\\]')).last;
  final dot = name.lastIndexOf('.');
  return dot > 0 ? name.substring(0, dot) : name;
}

String applyBulkTitle(UploadRow row, BulkTitleOptions options) {
  var title = row.title.trim();
  if (title.isEmpty) title = _fileBaseName(row.sourcePath);

  switch (options.mode) {
    case BulkTitleMode.prefix:
      return options.text.isEmpty ? title : '${options.text}$title';
    case BulkTitleMode.suffix:
      return options.text.isEmpty ? title : '$title${options.text}';
    case BulkTitleMode.stripCameraPrefix:
      final stripped = title.replaceFirst(_cameraPrefixRe, '').trim();
      return stripped.isEmpty ? title : stripped;
    case BulkTitleMode.number:
      return title;
  }
}

List<UploadRow> applyBulkTitlesToRows(
  List<UploadRow> rows,
  Set<String>? scopeIds,
  BulkTitleOptions options,
) {
  var counter = options.mode == BulkTitleMode.number ? options.start : 0;
  return rows.map((row) {
    final inScope = scopeIds == null || scopeIds.isEmpty || scopeIds.contains(row.id);
    if (!inScope) return row;

    if (options.mode == BulkTitleMode.number) {
      final pad = options.pad < 0 ? 0 : options.pad;
      final num = counter.toString().padLeft(pad, '0');
      counter += 1;
      final base = applyBulkTitle(row, const BulkTitleOptions.stripCameraPrefix());
      return row.copyWith(title: '$base $num'.trim());
    }

    return row.copyWith(title: applyBulkTitle(row, options));
  }).toList();
}
