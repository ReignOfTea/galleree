import 'dart:convert';
import 'dart:io';

import 'package:exif/exif.dart';
import 'package:image/image.dart' as img;
import 'package:path/path.dart' as p;

import '../models/gallery_meta.dart';
import '../models/models.dart';
import '../utils/blurhash_from_image.dart';
import '../utils/exif_display_publish.dart';
import '../utils/registry_slug.dart';
import '../utils/upload_row_meta.dart';
import 'app_storage.dart';

List<String> loadGalleryTagsSync(GalleryPaths paths) {
  final dir = Directory(paths.metaDir);
  if (!dir.existsSync()) return [];
  final raw = <String>[];
  for (final file in dir.listSync().whereType<File>()) {
    final name = p.basename(file.path);
    if (!name.endsWith('.json')) continue;
    final id = name.substring(0, name.length - 5);
    if (!isValidGalleryImageId(id)) continue;
    try {
      final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      final tags = json['tags'];
      if (tags is! List) continue;
      for (final tag in tags) {
        if (tag is String && tag.trim().isNotEmpty) raw.add(tag);
      }
    } catch (_) {
      /* skip */
    }
  }
  return normalizeGalleryTags(raw);
}

GalleryRegistries loadGalleryRegistriesSync(String workdirRoot) {
  return GalleryRegistryService().load(GalleryPaths(workdirRoot));
}

const thumbMaxWidth = 720;
const thumbJpegQuality = 82;

class GalleryRegistryService {
  GalleryRegistries load(GalleryPaths paths) {
    final collections = _loadCollections(paths.collectionsDir);
    final cameras = _loadEquipment(paths.camerasDir);
    final lenses = _loadEquipment(paths.lensesDir);
    collections.sort((a, b) => a.title.compareTo(b.title));
    cameras.sort((a, b) => a.name.compareTo(b.name));
    lenses.sort((a, b) => a.name.compareTo(b.name));
    return GalleryRegistries(
      collections: collections,
      cameras: cameras,
      lenses: lenses,
    );
  }

  List<RegistryCollection> _loadCollections(String dir) {
    if (!Directory(dir).existsSync()) return [];
    final out = <RegistryCollection>[];
    for (final file in Directory(dir).listSync().whereType<File>()) {
      if (!file.path.endsWith('.json')) continue;
      try {
        final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
        final slug = raw['slug'] as String?;
        final title = raw['title'] as String?;
        if (slug == null || title == null) continue;
        out.add(RegistryCollection(
          slug: slug,
          title: title,
          description: raw['description'] as String?,
          coverImageId: raw['coverImageId'] as String?,
        ));
      } catch (_) {
        /* skip */
      }
    }
    return out;
  }

  List<RegistryEquipment> _loadEquipment(String dir) {
    if (!Directory(dir).existsSync()) return [];
    final out = <RegistryEquipment>[];
    for (final file in Directory(dir).listSync().whereType<File>()) {
      if (!file.path.endsWith('.json')) continue;
      try {
        final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
        final slug = raw['slug'] as String?;
        final name = raw['name'] as String?;
        if (slug == null || name == null) continue;
        out.add(RegistryEquipment(
          slug: slug,
          name: name,
          make: raw['make'] as String?,
          model: raw['model'] as String?,
          lensSlug: raw['lensSlug'] as String?,
        ));
      } catch (_) {
        /* skip */
      }
    }
    return out;
  }

  void setCollectionCover(GalleryPaths paths, String slug, String imageId) {
    final file = File(p.join(paths.collectionsDir, '$slug.json'));
    if (!file.existsSync()) return;
    final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    raw['coverImageId'] = imageId;
    file.writeAsStringSync('${const JsonEncoder.withIndent('  ').convert(raw)}\n');
  }

  String saveCollection({
    required GalleryPaths paths,
    String? editSlug,
    required String title,
    required String description,
    String? coverImageId,
  }) {
    final trimmedTitle = title.trim();
    final slug = editSlug?.trim().toLowerCase() ?? collectionSlugFromTitle(trimmedTitle);
    if (slug == null || !isValidCollectionSlug(slug)) {
      throw StateError('Enter a title that produces a valid collection slug.');
    }
    final out = {
      'version': 1,
      'slug': slug,
      'title': trimmedTitle,
      if (description.trim().isNotEmpty) 'description': description.trim(),
      if (coverImageId != null && coverImageId.isNotEmpty) 'coverImageId': coverImageId,
    };
    paths.ensureGalleryDirs();
    File(p.join(paths.collectionsDir, '$slug.json')).writeAsStringSync(
      '${const JsonEncoder.withIndent('  ').convert(out)}\n',
    );
    return 'public/gallery/meta/collections/$slug.json';
  }

  List<String> saveCamera({
    required GalleryPaths paths,
    String? editSlug,
    required String name,
    String make = '',
    String model = '',
    String description = '',
    String? lensSlug,
    String? imagePath,
  }) {
    return _saveEquipment(
      paths: paths,
      kindDir: paths.camerasDir,
      kind: 'cameras',
      editSlug: editSlug,
      name: name,
      make: make,
      model: model,
      description: description,
      lensSlug: lensSlug,
      imagePath: imagePath,
    );
  }

  List<String> saveLens({
    required GalleryPaths paths,
    String? editSlug,
    required String name,
    String make = '',
    String model = '',
    String description = '',
    String? imagePath,
  }) {
    return _saveEquipment(
      paths: paths,
      kindDir: paths.lensesDir,
      kind: 'lenses',
      editSlug: editSlug,
      name: name,
      make: make,
      model: model,
      description: description,
      imagePath: imagePath,
    );
  }

  List<String> _saveEquipment({
    required GalleryPaths paths,
    required String kindDir,
    required String kind,
    String? editSlug,
    required String name,
    required String make,
    required String model,
    required String description,
    String? lensSlug,
    String? imagePath,
  }) {
    final trimmedName = name.trim();
    final slug = editSlug?.trim().toLowerCase() ?? equipmentSlugFromLabel(trimmedName);
    if (slug == null || !isValidEquipmentSlug(slug)) {
      throw StateError('Enter a name that produces a valid equipment slug.');
    }
    paths.ensureGalleryDirs();
    String? imageRel;
    if (imagePath != null && imagePath.isNotEmpty) {
      final dest = File(p.join(kindDir, '$slug.png'));
      File(imagePath).copySync(dest.path);
      imageRel = 'meta/$kind/$slug.png';
    } else if (editSlug != null) {
      final existing = File(p.join(kindDir, '$slug.json'));
      if (existing.existsSync()) {
        try {
          final raw = jsonDecode(existing.readAsStringSync()) as Map<String, dynamic>;
          imageRel = raw['image'] as String?;
        } catch (_) {}
      }
    }

    final out = <String, dynamic>{
      'version': 1,
      'slug': slug,
      'name': trimmedName,
      if (make.trim().isNotEmpty) 'make': make.trim(),
      if (model.trim().isNotEmpty) 'model': model.trim(),
      if (description.trim().isNotEmpty) 'description': description.trim(),
      if (imageRel != null) 'image': imageRel,
      if (kind == 'cameras' && lensSlug != null && lensSlug.isNotEmpty) 'lensSlug': lensSlug,
    };
    File(p.join(kindDir, '$slug.json')).writeAsStringSync(
      '${const JsonEncoder.withIndent('  ').convert(out)}\n',
    );
    final pathsOut = <String>['public/gallery/meta/$kind/$slug.json'];
    if (imagePath != null && imagePath.isNotEmpty) {
      pathsOut.add('public/gallery/meta/$kind/$slug.png');
    }
    return pathsOut;
  }

  RegistryCollection? loadCollection(GalleryPaths paths, String slug) {
    final file = File(p.join(paths.collectionsDir, '$slug.json'));
    if (!file.existsSync()) return null;
    try {
      final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      return RegistryCollection(
        slug: raw['slug'] as String? ?? slug,
        title: raw['title'] as String? ?? slug,
        description: raw['description'] as String?,
        coverImageId: raw['coverImageId'] as String?,
      );
    } catch (_) {
      return null;
    }
  }

  RegistryEquipment? loadEquipment(GalleryPaths paths, String kindDir, String slug) {
    final file = File(p.join(kindDir, '$slug.json'));
    if (!file.existsSync()) return null;
    try {
      final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      return RegistryEquipment(
        slug: raw['slug'] as String? ?? slug,
        name: raw['name'] as String? ?? slug,
        make: raw['make'] as String?,
        model: raw['model'] as String?,
        lensSlug: raw['lensSlug'] as String?,
      );
    } catch (_) {
      return null;
    }
  }
}

class ExifHints {
  ExifHints({
    this.description,
    this.captureDateTime,
    this.make,
    this.model,
    this.lensModel,
  });

  final String? description;
  final DateTime? captureDateTime;
  final String? make;
  final String? model;
  final String? lensModel;
}

class ExifService {
  Future<ExifHints> readHints(String path) async {
    try {
      final bytes = await File(path).readAsBytes();
      final data = await readExifFromBytes(bytes);
      if (data.isEmpty) return ExifHints();

      String? description = _tagString(data, 'Image Description');
      final dateStr = _tagString(data, 'DateTimeOriginal') ?? _tagString(data, 'DateTime');
      DateTime? capture;
      if (dateStr != null) {
        capture = _parseExifDate(dateStr);
      }
      return ExifHints(
        description: description,
        captureDateTime: capture,
        make: _tagString(data, 'Make'),
        model: _tagString(data, 'Model'),
        lensModel: _tagString(data, 'LensModel'),
      );
    } catch (_) {
      return ExifHints();
    }
  }

  String? _tagString(Map<String, IfdTag> data, String key) {
    final tag = data[key];
    if (tag == null) return null;
    final v = tag.printable.trim();
    return v.isEmpty ? null : v;
  }

  DateTime? _parseExifDate(String raw) {
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
}

class GalleryStageService {
  Future<void> stageRow({
    required GalleryPaths paths,
    required UploadRow row,
    required GalleryRegistries registries,
  }) async {
    paths.ensureGalleryDirs();
    final destId = row.destId;
    final destName = row.destFilename;
    final destImage = File(p.join(paths.galleryDir, destName));
    final skipImageCopy = row.editExistingId != null && !row.replaceImageFile;

    if (!skipImageCopy) {
      await File(row.sourcePath).copy(destImage.path);
      if (row.editExistingId != null &&
          row.editOriginalFilename != null &&
          row.editOriginalFilename != destName) {
        final oldPath = File(p.join(paths.galleryDir, row.editOriginalFilename!));
        if (oldPath.existsSync()) await oldPath.delete();
      }
    }

    String? blurHash;
    List<Map<String, String>>? exifDisplay;
    if (skipImageCopy) {
      blurHash = _readBlurHash(paths, destId);
      exifDisplay = row.preserveExifDisplay;
    } else {
      final sourceBytes = await File(row.sourcePath).readAsBytes();
      final destBytes = await destImage.readAsBytes();
      exifDisplay = await buildExifDisplayForPublish(
        sourceBytes,
        fallbackBytes: destBytes,
      );
      blurHash = blurHashFromImageBytes(destBytes);
    }

    final meta = galleryMetaFromUploadRow(
      row,
      uploadedAt: row.preserveUploadedAt,
      blurHash: blurHash,
      exifDisplay: exifDisplay,
    );

    final metaFile = File(p.join(paths.metaDir, '$destId.json'));
    await metaFile.writeAsString(meta.serialize());

    if (!skipImageCopy) {
      await _writeThumb(destImage.path, File(p.join(paths.thumbsDir, '$destId.jpg')));
    }
  }

  String? _readBlurHash(GalleryPaths paths, String id) {
    final metaFile = File(p.join(paths.metaDir, '$id.json'));
    if (!metaFile.existsSync()) return null;
    try {
      final raw = jsonDecode(metaFile.readAsStringSync()) as Map<String, dynamic>;
      return raw['blurHash'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeThumb(String sourcePath, File thumbOut) async {
    try {
      final bytes = await File(sourcePath).readAsBytes();
      final decoded = img.decodeImage(bytes);
      if (decoded == null) return;
      final resized = _resizeMaxSide(decoded, thumbMaxWidth);
      final jpg = img.encodeJpg(resized, quality: thumbJpegQuality);
      thumbOut.parent.createSync(recursive: true);
      await thumbOut.writeAsBytes(jpg);
    } catch (_) {
      // Original is still copied; thumb is optional for local preview.
    }
  }

  img.Image _resizeMaxSide(img.Image image, int maxSide) {
    final w = image.width;
    final h = image.height;
    final m = w > h ? w : h;
    if (m <= maxSide) return image;
    final scale = maxSide / m;
    final nw = (w * scale).round().clamp(1, 1 << 20);
    final nh = (h * scale).round().clamp(1, 1 << 20);
    return img.copyResize(image, width: nw, height: nh, interpolation: img.Interpolation.average);
  }
}

String extensionFromPath(String path) {
  final ext = p.extension(path).toLowerCase();
  return normalizeImageExtension(ext.isEmpty ? '.jpg' : ext);
}

/// Detect image type from magic bytes. Returns null when unknown.
String? imageExtensionFromBytes(List<int> bytes) {
  if (bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) {
    return '.jpg';
  }
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4E &&
      bytes[3] == 0x47) {
    return '.png';
  }
  if (bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x45 &&
      bytes[10] == 0x42 &&
      bytes[11] == 0x50) {
    return '.webp';
  }
  if (bytes.length >= 6) {
    final head = String.fromCharCodes(bytes.sublist(0, 6));
    if (head == 'GIF87a' || head == 'GIF89a') return '.gif';
  }
  return null;
}

String extensionFromPathAndBytes(String path, List<int> bytes) {
  final sniffed = imageExtensionFromBytes(bytes);
  if (sniffed != null) return normalizeImageExtension(sniffed);
  return extensionFromPath(path);
}

String randomGalleryFilename(String ext) {
  final id = generateGalleryImageId();
  final dotExt = normalizeImageExtension(ext);
  return '$id${dotExt == '.jpeg' ? '.jpg' : dotExt}';
}

bool destExistsForId(GalleryPaths paths, String filename) =>
    File(p.join(paths.galleryDir, filename)).existsSync();

String? matchEquipmentSlug(String? make, String? model, List<RegistryEquipment> registry) {
  if (make == null && model == null) return null;
  final m = '${make ?? ''} ${model ?? ''}'.trim().toLowerCase();
  for (final item in registry) {
    final candidate = '${item.make ?? ''} ${item.model ?? ''}'.trim().toLowerCase();
    if (candidate.isNotEmpty && m.contains(candidate)) return item.slug;
    if (item.name.toLowerCase() == m) return item.slug;
  }
  return null;
}
