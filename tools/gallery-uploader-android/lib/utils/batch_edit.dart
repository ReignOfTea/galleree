import '../models/gallery_meta.dart';
import '../models/models.dart';

class BatchEditPatch {
  const BatchEditPatch({
    this.mergeTags,
    this.collectionSelect,
    this.hidden,
    this.cameraSelect,
    this.lensSelect,
    this.copyright,
    this.location,
    this.captureDate,
  });

  final String? mergeTags;
  final String? collectionSelect;
  final bool? hidden;
  final String? cameraSelect;
  final String? lensSelect;
  final String? copyright;
  final String? location;
  /// `null` = no change, `''` = clear, otherwise `YYYY-MM-DD`.
  final String? captureDate;
}

enum CopyFromFirstField {
  tags,
  location,
  description,
  collection,
  camera,
  lens,
  copyright,
  captureDate,
}

String _mergeTags(String existing, String add) {
  final merged = [...parseTagsInput(existing), ...parseTagsInput(add)];
  return normalizeGalleryTags(merged).join(', ');
}

UploadRow applyCaptureDatePatch(UploadRow row, String datePatch) {
  final trimmed = datePatch.trim();
  if (trimmed.isEmpty) {
    return row.copyWith(captureDate: '', captureDateTimeIso: '');
  }
  final iso = row.captureDateTimeIso.trim();
  final nextIso = iso.isNotEmpty && RegExp(r'^\d{4}-\d{2}-\d{2}T').hasMatch(iso)
      ? '$trimmed${iso.substring(iso.indexOf('T'))}'
      : '${trimmed}T12:00:00.000Z';
  return row.copyWith(captureDate: trimmed, captureDateTimeIso: nextIso);
}

List<UploadRow> applyBatchEdit(
  List<UploadRow> rows,
  Set<String>? scopeIds,
  BatchEditPatch patch,
) {
  return rows.map((row) {
    final inScope = scopeIds == null || scopeIds.isEmpty || scopeIds.contains(row.id);
    if (!inScope) return row;

    var next = row;
    if (patch.mergeTags != null && patch.mergeTags!.trim().isNotEmpty) {
      next = next.copyWith(tags: _mergeTags(next.tags, patch.mergeTags!));
    }
    if (patch.collectionSelect != null) {
      next = next.copyWith(collectionSelect: patch.collectionSelect!);
    }
    if (patch.hidden != null) {
      next = next.copyWith(hidden: patch.hidden);
    }
    if (patch.cameraSelect != null) {
      final custom = patch.cameraSelect == selectCustom;
      next = next.copyWith(
        cameraSelect: custom ? selectCustom : patch.cameraSelect!,
        cameraCustom: custom ? next.cameraCustom : '',
      );
    }
    if (patch.lensSelect != null) {
      final custom = patch.lensSelect == selectCustom;
      next = next.copyWith(
        lensSelect: custom ? selectCustom : patch.lensSelect!,
        lensCustom: custom ? next.lensCustom : '',
      );
    }
    if (patch.copyright != null) {
      next = next.copyWith(copyright: patch.copyright!);
    }
    if (patch.location != null) {
      next = next.copyWith(location: patch.location!);
    }
    if (patch.captureDate != null) {
      next = applyCaptureDatePatch(next, patch.captureDate!);
    }
    return next;
  }).toList();
}

List<UploadRow> copyMetadataFromFirst(
  List<UploadRow> rows,
  Set<String> selectedIds,
  List<CopyFromFirstField> fields,
) {
  if (selectedIds.isEmpty) return rows;
  UploadRow? source;
  for (final row in rows) {
    if (selectedIds.contains(row.id)) {
      source = row;
      break;
    }
  }
  if (source == null) return rows;

  return rows.map((row) {
    if (!selectedIds.contains(row.id) || row.id == source!.id) return row;
    var next = row;
    for (final field in fields) {
      switch (field) {
        case CopyFromFirstField.tags:
          next = next.copyWith(tags: source.tags);
        case CopyFromFirstField.location:
          next = next.copyWith(location: source.location);
        case CopyFromFirstField.description:
          next = next.copyWith(description: source.description);
        case CopyFromFirstField.collection:
          next = next.copyWith(
            collectionSelect: source.collectionSelect,
            collectionSetCover: source.collectionSetCover,
          );
        case CopyFromFirstField.camera:
          next = next.copyWith(
            cameraSelect: source.cameraSelect,
            cameraCustom: source.cameraCustom,
          );
        case CopyFromFirstField.lens:
          next = next.copyWith(
            lensSelect: source.lensSelect,
            lensCustom: source.lensCustom,
          );
        case CopyFromFirstField.copyright:
          next = next.copyWith(copyright: source.copyright);
        case CopyFromFirstField.captureDate:
          next = next.copyWith(
            captureDate: source.captureDate,
            captureDateTimeIso: source.captureDateTimeIso,
          );
      }
    }
    return next;
  }).toList();
}

List<UploadRow> sortRowsByCaptureDate(List<UploadRow> rows) {
  final sorted = [...rows];
  sorted.sort((a, b) {
    final ad = _captureSortKey(a);
    final bd = _captureSortKey(b);
    return ad.compareTo(bd);
  });
  return sorted;
}

String _captureSortKey(UploadRow row) {
  if (row.captureDateTimeIso.isNotEmpty) return row.captureDateTimeIso;
  if (row.captureDate.isNotEmpty) return row.captureDate;
  return '9999-99-99';
}
