class UploadRow {
  UploadRow({
    required this.id,
    required this.sourcePath,
    required this.title,
    this.description = '',
    this.tags = '',
    this.location = '',
    this.captureDate = '',
    this.captureDateTimeIso = '',
    this.collectionSelect = '',
    this.collectionSetCover = false,
    this.cameraSelect = '',
    this.cameraCustom = '',
    this.lensSelect = '',
    this.lensCustom = '',
    this.alt = '',
    this.hidden = false,
    this.sortOrder = '',
    this.copyright = '',
    this.extension = '.jpg',
    this.destId = '',
    this.destFilename = '',
    this.destExists = false,
    this.editExistingId,
    this.preserveUploadedAt,
    this.preserveExifDisplay,
    this.editGalleryImagePath,
    this.editOriginalFilename,
    this.replaceImageFile = false,
  });

  final String id;
  final String sourcePath;
  String title;
  String description;
  String tags;
  String location;
  String captureDate;
  String captureDateTimeIso;
  String collectionSelect;
  bool collectionSetCover;
  String cameraSelect;
  String cameraCustom;
  String lensSelect;
  String lensCustom;
  String alt;
  bool hidden;
  String sortOrder;
  String copyright;
  String extension;
  String destId;
  String destFilename;
  bool destExists;
  final String? editExistingId;
  final String? preserveUploadedAt;
  final List<Map<String, String>>? preserveExifDisplay;
  final String? editGalleryImagePath;
  final String? editOriginalFilename;
  bool replaceImageFile;

  bool get isEdit => editExistingId != null;

  UploadRow copyWith({
    String? sourcePath,
    String? title,
    String? description,
    String? tags,
    String? location,
    String? captureDate,
    String? captureDateTimeIso,
    String? collectionSelect,
    bool? collectionSetCover,
    String? cameraSelect,
    String? cameraCustom,
    String? lensSelect,
    String? lensCustom,
    String? alt,
    bool? hidden,
    String? sortOrder,
    String? copyright,
    String? extension,
    String? destId,
    String? destFilename,
    bool? destExists,
    String? editExistingId,
    String? preserveUploadedAt,
    List<Map<String, String>>? preserveExifDisplay,
    String? editGalleryImagePath,
    String? editOriginalFilename,
    bool? replaceImageFile,
  }) {
    return UploadRow(
      id: id,
      sourcePath: sourcePath ?? this.sourcePath,
      title: title ?? this.title,
      description: description ?? this.description,
      tags: tags ?? this.tags,
      location: location ?? this.location,
      captureDate: captureDate ?? this.captureDate,
      captureDateTimeIso: captureDateTimeIso ?? this.captureDateTimeIso,
      collectionSelect: collectionSelect ?? this.collectionSelect,
      collectionSetCover: collectionSetCover ?? this.collectionSetCover,
      cameraSelect: cameraSelect ?? this.cameraSelect,
      cameraCustom: cameraCustom ?? this.cameraCustom,
      lensSelect: lensSelect ?? this.lensSelect,
      lensCustom: lensCustom ?? this.lensCustom,
      alt: alt ?? this.alt,
      hidden: hidden ?? this.hidden,
      sortOrder: sortOrder ?? this.sortOrder,
      copyright: copyright ?? this.copyright,
      extension: extension ?? this.extension,
      destId: destId ?? this.destId,
      destFilename: destFilename ?? this.destFilename,
      destExists: destExists ?? this.destExists,
      editExistingId: editExistingId ?? this.editExistingId,
      preserveUploadedAt: preserveUploadedAt ?? this.preserveUploadedAt,
      preserveExifDisplay: preserveExifDisplay ?? this.preserveExifDisplay,
      editGalleryImagePath: editGalleryImagePath ?? this.editGalleryImagePath,
      editOriginalFilename: editOriginalFilename ?? this.editOriginalFilename,
      replaceImageFile: replaceImageFile ?? this.replaceImageFile,
    );
  }
}

const selectNone = '';
const selectCustom = '__custom__';

class RegistryCollection {
  RegistryCollection({
    required this.slug,
    required this.title,
    this.description,
    this.coverImageId,
  });

  final String slug;
  final String title;
  final String? description;
  final String? coverImageId;
}

class RegistryEquipment {
  RegistryEquipment({
    required this.slug,
    required this.name,
    this.make,
    this.model,
    this.lensSlug,
  });

  final String slug;
  final String name;
  final String? make;
  final String? model;
  final String? lensSlug;
}

class GalleryRegistries {
  GalleryRegistries({
    required this.collections,
    required this.cameras,
    required this.lenses,
  });

  final List<RegistryCollection> collections;
  final List<RegistryEquipment> cameras;
  final List<RegistryEquipment> lenses;
}

class SessionDefaults {
  SessionDefaults({
    this.tags = '',
    this.collectionSelect = '',
    this.hidden = false,
    this.cameraSelect = '',
    this.lensSelect = '',
    this.copyright = '',
    this.location = '',
    this.captureDate = '',
  });

  final String tags;
  final String collectionSelect;
  final bool hidden;
  final String cameraSelect;
  final String lensSelect;
  final String copyright;
  final String location;
  final String captureDate;

  SessionDefaults copyWith({
    String? tags,
    String? collectionSelect,
    bool? hidden,
    String? cameraSelect,
    String? lensSelect,
    String? copyright,
    String? location,
    String? captureDate,
  }) {
    return SessionDefaults(
      tags: tags ?? this.tags,
      collectionSelect: collectionSelect ?? this.collectionSelect,
      hidden: hidden ?? this.hidden,
      cameraSelect: cameraSelect ?? this.cameraSelect,
      lensSelect: lensSelect ?? this.lensSelect,
      copyright: copyright ?? this.copyright,
      location: location ?? this.location,
      captureDate: captureDate ?? this.captureDate,
    );
  }
}

enum PublishMode {
  standard,
  skipPull,
  forceWithLease,
}

enum QueueViewMode {
  compact,
  accordion,
}

extension QueueViewModeLabel on QueueViewMode {
  String get label => switch (this) {
        QueueViewMode.compact => 'Table',
        QueueViewMode.accordion => 'Panels',
      };
}

extension PublishModeLabel on PublishMode {
  String get label => switch (this) {
        PublishMode.standard => 'Sync then push',
        PublishMode.skipPull => 'Push without downloading',
        PublishMode.forceWithLease => 'Force with lease',
      };

  String get summary => switch (this) {
        PublishMode.standard =>
          'Download latest from GitHub, then push your commit.',
        PublishMode.skipPull => 'Push local gallery without pulling first.',
        PublishMode.forceWithLease =>
          'Overwrite remote only if nobody else pushed since your last sync.',
      };
}

class AppConfig {
  AppConfig({required this.repoUrl, required this.branch, required this.workdir});

  final String repoUrl;
  final String branch;
  final String workdir;

  Map<String, dynamic> toJson() => {
        'repoUrl': repoUrl,
        'branch': branch,
        'workdir': workdir,
      };

  factory AppConfig.fromJson(Map<String, dynamic> json) => AppConfig(
        repoUrl: json['repoUrl'] as String? ?? '',
        branch: json['branch'] as String? ?? 'master',
        workdir: json['workdir'] as String? ?? '',
      );
}

enum RegistryKind { collection, camera, lens }

class RegistryModalRequest {
  const RegistryModalRequest({required this.kind, this.editSlug, this.rowId});

  final RegistryKind kind;
  final String? editSlug;
  final String? rowId;
}

class GalleryPhotoSummary {
  const GalleryPhotoSummary({
    required this.id,
    required this.title,
    required this.imagePath,
    required this.destFilename,
  });

  final String id;
  final String title;
  final String imagePath;
  final String destFilename;
}

class SiteConfigDraft {
  const SiteConfigDraft({
    this.title = '',
    this.kicker = '',
    this.tagline = '',
    this.about = '',
    this.siteUrl = '',
    this.lang = '',
    this.contactEmail = '',
    this.copyright = '',
  });

  final String title;
  final String kicker;
  final String tagline;
  final String about;
  final String siteUrl;
  final String lang;
  final String contactEmail;
  final String copyright;

  SiteConfigDraft copyWith({
    String? title,
    String? kicker,
    String? tagline,
    String? about,
    String? siteUrl,
    String? lang,
    String? contactEmail,
    String? copyright,
  }) {
    return SiteConfigDraft(
      title: title ?? this.title,
      kicker: kicker ?? this.kicker,
      tagline: tagline ?? this.tagline,
      about: about ?? this.about,
      siteUrl: siteUrl ?? this.siteUrl,
      lang: lang ?? this.lang,
      contactEmail: contactEmail ?? this.contactEmail,
      copyright: copyright ?? this.copyright,
    );
  }
}
