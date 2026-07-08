import '../models/gallery_meta.dart';
import '../models/models.dart';

/// Limits from `schemas/gallery-image-meta.schema.json`.
const galleryMetaTitleMaxLength = 200;
const galleryMetaDescriptionMaxLength = 4000;
const galleryMetaTagMaxLength = 80;
const galleryMetaLocationMaxLength = 120;
const galleryMetaEquipmentMaxLength = 120;
const galleryMetaAltMaxLength = 500;
const galleryMetaCopyrightMaxLength = 200;
const galleryMetaExifDisplayMaxItems = 40;
const galleryMetaExifLabelMaxLength = 80;
const galleryMetaExifValueMaxLength = 200;

final _capturedOnPattern = RegExp(r'^\d{4}-\d{2}-\d{2}$');

String? resolveCamera(UploadRow row) {
  if (row.cameraSelect == selectCustom) {
    final custom = row.cameraCustom.trim();
    return custom.isEmpty ? null : custom;
  }
  return row.cameraSelect.isEmpty ? null : row.cameraSelect;
}

String? resolveLens(UploadRow row) {
  if (row.lensSelect == selectCustom) {
    final custom = row.lensCustom.trim();
    return custom.isEmpty ? null : custom;
  }
  return row.lensSelect.isEmpty ? null : row.lensSelect;
}

DateTime? tryResolveCaptureDateTime(UploadRow row) {
  if (row.captureDateTimeIso.isNotEmpty) {
    return DateTime.tryParse(row.captureDateTimeIso);
  }
  if (row.captureDate.isEmpty) return null;
  final parts = row.captureDate.split('-');
  if (parts.length != 3) return null;
  try {
    final y = int.parse(parts[0]);
    final m = int.parse(parts[1]);
    final d = int.parse(parts[2]);
    final date = DateTime(y, m, d);
    if (date.year != y || date.month != m || date.day != d) return null;
    return date;
  } catch (_) {
    return null;
  }
}

GalleryImageMeta galleryMetaFromUploadRow(
  UploadRow row, {
  String? uploadedAt,
  String? blurHash,
  List<Map<String, String>>? exifDisplay,
}) {
  return galleryMetaFromUploadFields(
    title: row.title,
    description: row.description,
    tags: parseTagsInput(row.tags),
    location: row.location,
    capturedAt: tryResolveCaptureDateTime(row),
    camera: resolveCamera(row),
    lens: resolveLens(row),
    collectionSlug: row.collectionSelect.isEmpty ? null : row.collectionSelect,
    alt: row.alt,
    hidden: row.hidden,
    sortOrder: int.tryParse(row.sortOrder.trim()),
    copyright: row.copyright,
    id: row.destId,
    uploadedAt: uploadedAt ?? row.preserveUploadedAt,
    blurHash: blurHash,
    exifDisplay: exifDisplay,
  );
}

/// Returns a user-facing error, or null when [row] will produce valid sidecar meta.
String? validateUploadRowForPublish(UploadRow row) {
  final label = row.title.trim().isEmpty ? 'Untitled photo' : '"${row.title.trim()}"';

  if (!isValidGalleryImageId(row.destId)) {
    return '$label: invalid photo id.';
  }

  final title = row.title.trim();
  if (title.isEmpty) {
    return 'Every photo needs a title before upload.';
  }
  if (title.length > galleryMetaTitleMaxLength) {
    return '$label: title must be at most $galleryMetaTitleMaxLength characters.';
  }

  final description = row.description.trim();
  if (description.length > galleryMetaDescriptionMaxLength) {
    return '$label: description must be at most $galleryMetaDescriptionMaxLength characters.';
  }

  final location = row.location.trim();
  if (location.length > galleryMetaLocationMaxLength) {
    return '$label: location must be at most $galleryMetaLocationMaxLength characters.';
  }

  final alt = row.alt.trim();
  if (alt.length > galleryMetaAltMaxLength) {
    return '$label: alt text must be at most $galleryMetaAltMaxLength characters.';
  }

  final copyright = row.copyright.trim();
  if (copyright.length > galleryMetaCopyrightMaxLength) {
    return '$label: copyright must be at most $galleryMetaCopyrightMaxLength characters.';
  }

  if (row.collectionSelect.isNotEmpty && !isValidCollectionSlug(row.collectionSelect)) {
    return '$label: collection slug is invalid.';
  }

  final camera = resolveCamera(row);
  if (camera != null && camera.length > galleryMetaEquipmentMaxLength) {
    return '$label: camera must be at most $galleryMetaEquipmentMaxLength characters.';
  }

  final lens = resolveLens(row);
  if (lens != null && lens.length > galleryMetaEquipmentMaxLength) {
    return '$label: lens must be at most $galleryMetaEquipmentMaxLength characters.';
  }

  final sortOrderRaw = row.sortOrder.trim();
  if (sortOrderRaw.isNotEmpty && int.tryParse(sortOrderRaw) == null) {
    return '$label: sort order must be a number.';
  }

  final captureError = _validateCaptureFields(row, label);
  if (captureError != null) return captureError;

  final meta = galleryMetaFromUploadRow(row, exifDisplay: row.preserveExifDisplay);
  return _validateGalleryImageMeta(meta, label);
}

String? _validateCaptureFields(UploadRow row, String label) {
  if (row.captureDateTimeIso.isNotEmpty && DateTime.tryParse(row.captureDateTimeIso) == null) {
    return '$label: capture date/time is not valid.';
  }
  if (row.captureDate.isEmpty) return null;

  final parts = row.captureDate.split('-');
  if (parts.length != 3 || !_capturedOnPattern.hasMatch(row.captureDate.trim())) {
    return '$label: capture date must be YYYY-MM-DD.';
  }
  if (tryResolveCaptureDateTime(row) == null) {
    return '$label: capture date is not a valid calendar date.';
  }
  return null;
}

String? _validateGalleryImageMeta(GalleryImageMeta meta, String label) {
  if (meta.title.isEmpty || meta.title.length > galleryMetaTitleMaxLength) {
    return '$label: title is invalid.';
  }

  if (meta.tags.isEmpty) {
    return '$label: at least one tag is required.';
  }
  for (final tag in meta.tags) {
    if (tag.isEmpty || tag.length > galleryMetaTagMaxLength) {
      return '$label: each tag must be 1–$galleryMetaTagMaxLength characters.';
    }
  }

  if (meta.description != null && meta.description!.length > galleryMetaDescriptionMaxLength) {
    return '$label: description is too long.';
  }
  if (meta.location != null && meta.location!.length > galleryMetaLocationMaxLength) {
    return '$label: location is too long.';
  }
  if (meta.alt != null && meta.alt!.length > galleryMetaAltMaxLength) {
    return '$label: alt text is too long.';
  }
  if (meta.copyright != null && meta.copyright!.length > galleryMetaCopyrightMaxLength) {
    return '$label: copyright is too long.';
  }
  if (meta.camera != null && meta.camera!.length > galleryMetaEquipmentMaxLength) {
    return '$label: camera is too long.';
  }
  if (meta.lens != null && meta.lens!.length > galleryMetaEquipmentMaxLength) {
    return '$label: lens is too long.';
  }
  if (meta.collectionSlug != null && !isValidCollectionSlug(meta.collectionSlug!)) {
    return '$label: collection slug is invalid.';
  }
  if (meta.capturedOn != null && !_capturedOnPattern.hasMatch(meta.capturedOn!)) {
    return '$label: capture date must be YYYY-MM-DD.';
  }
  if (meta.capturedAt != null && DateTime.tryParse(meta.capturedAt!) == null) {
    return '$label: capture date/time is not valid.';
  }

  final exif = meta.exifDisplay;
  if (exif != null) {
    if (exif.length > galleryMetaExifDisplayMaxItems) {
      return '$label: EXIF display has too many rows.';
    }
    for (final row in exif) {
      final rowLabel = row['label']?.trim() ?? '';
      final value = row['value']?.trim() ?? '';
      if (rowLabel.isEmpty ||
          rowLabel.length > galleryMetaExifLabelMaxLength ||
          value.isEmpty ||
          value.length > galleryMetaExifValueMaxLength) {
        return '$label: EXIF display rows are invalid.';
      }
    }
  }

  return null;
}
