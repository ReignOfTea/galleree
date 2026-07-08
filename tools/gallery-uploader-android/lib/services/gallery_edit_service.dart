import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';

import '../models/gallery_meta.dart';
import '../models/models.dart';
import 'app_storage.dart';

class GalleryEditService {
  List<GalleryPhotoSummary> listPhotos(GalleryPaths paths) {
    final metaDir = Directory(paths.metaDir);
    if (!metaDir.existsSync()) return [];

    final out = <GalleryPhotoSummary>[];
    for (final file in metaDir.listSync().whereType<File>()) {
      if (!file.path.endsWith('.json')) continue;
      final id = p.basenameWithoutExtension(file.path);
      if (!isValidGalleryImageId(id)) continue;

      try {
        final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
        final title = raw['title'] as String? ?? 'Untitled';
        final imagePath = _findImagePath(paths.galleryDir, id);
        if (imagePath == null) continue;
        out.add(GalleryPhotoSummary(
          id: id,
          title: title,
          imagePath: imagePath,
          destFilename: p.basename(imagePath),
        ));
      } catch (_) {
        /* skip */
      }
    }

    out.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
    return out;
  }

  UploadRow? loadPhotoForEdit({
    required GalleryPaths paths,
    required GalleryPhotoSummary photo,
    required GalleryRegistries registries,
  }) {
    final metaFile = File(p.join(paths.metaDir, '${photo.id}.json'));
    if (!metaFile.existsSync()) return null;

    try {
      final raw = jsonDecode(metaFile.readAsStringSync()) as Map<String, dynamic>;
      final tags = (raw['tags'] as List<dynamic>? ?? [])
          .whereType<String>()
          .join(', ');
      final camera = raw['camera'] as String?;
      final lens = raw['lens'] as String?;
      final cam = _resolveEquipmentSelect(camera, registries.cameras);
      final len = _resolveEquipmentSelect(lens, registries.lenses);

      List<Map<String, String>>? exifDisplay;
      final rawExif = raw['exifDisplay'];
      if (rawExif is List) {
        exifDisplay = rawExif
            .whereType<Map>()
            .map((e) => e.map((k, v) => MapEntry(k.toString(), v.toString())))
            .toList();
      }

      return UploadRow(
        id: const Uuid().v4(),
        sourcePath: photo.imagePath,
        title: raw['title'] as String? ?? photo.title,
        description: raw['description'] as String? ?? '',
        tags: tags,
        location: raw['location'] as String? ?? '',
        captureDate: raw['capturedOn'] as String? ?? '',
        captureDateTimeIso: raw['capturedAt'] as String? ?? '',
        collectionSelect: raw['collectionSlug'] as String? ?? '',
        cameraSelect: cam.$1,
        cameraCustom: cam.$2,
        lensSelect: len.$1,
        lensCustom: len.$2,
        alt: raw['alt'] as String? ?? '',
        hidden: raw['hidden'] as bool? ?? false,
        sortOrder: raw['sortOrder']?.toString() ?? '',
        copyright: raw['copyright'] as String? ?? '',
        extension: p.extension(photo.destFilename),
        destId: photo.id,
        destFilename: photo.destFilename,
        destExists: true,
        editExistingId: photo.id,
        preserveUploadedAt: raw['uploadedAt'] as String?,
        preserveExifDisplay: exifDisplay,
        editGalleryImagePath: photo.imagePath,
        editOriginalFilename: photo.destFilename,
      );
    } catch (_) {
      return null;
    }
  }

  String? _findImagePath(String galleryDir, String id) {
    for (final ext in allowedImageExt) {
      final path = p.join(galleryDir, '$id${ext == '.jpeg' ? '.jpg' : ext}');
      if (File(path).existsSync()) return path;
    }
    return null;
  }

  (String select, String custom) _resolveEquipmentSelect(
    String? slug,
    List<RegistryEquipment> registry,
  ) {
    if (slug == null || slug.trim().isEmpty) return ('', '');
    final normalized = slug.trim().toLowerCase();
    if (registry.any((e) => e.slug == normalized)) return (normalized, '');
    return (selectCustom, normalized);
  }
}
