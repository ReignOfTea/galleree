import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

const _draftKey = 'upload_draft_session';
const draftSessionVersion = 2;

class DraftSession {
  DraftSession({
    required this.repoUrl,
    required this.branch,
    required this.commitMessage,
    required this.selectedRowIds,
    required this.rows,
    this.sessionDefaults,
  });

  final String repoUrl;
  final String branch;
  final String commitMessage;
  final List<String> selectedRowIds;
  final List<Map<String, dynamic>> rows;
  final Map<String, dynamic>? sessionDefaults;

  Map<String, dynamic> toJson() => {
        'version': draftSessionVersion,
        'repoUrl': repoUrl,
        'branch': branch,
        'commitMessage': commitMessage,
        'selectedRowIds': selectedRowIds,
        'rows': rows,
        if (sessionDefaults != null) 'sessionDefaults': sessionDefaults,
      };
}

class DraftRestoreResult {
  const DraftRestoreResult({
    required this.rows,
    required this.selectedRowIds,
    required this.commitMessage,
    required this.sessionDefaults,
    required this.skippedPaths,
  });

  final List<UploadRow> rows;
  final Set<String> selectedRowIds;
  final String commitMessage;
  final SessionDefaults? sessionDefaults;
  final List<String> skippedPaths;
}

class DraftSessionService {
  Future<void> save(DraftSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_draftKey, jsonEncode(session.toJson()));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_draftKey);
  }

  Future<DraftRestoreResult?> loadForConfig({
    required String repoUrl,
    required String branch,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_draftKey);
    if (raw == null) return null;

    final map = jsonDecode(raw) as Map<String, dynamic>;
    if (map['version'] != draftSessionVersion) return null;
    if ((map['repoUrl'] as String? ?? '').trim().toLowerCase() !=
        repoUrl.trim().toLowerCase()) {
      return null;
    }
    if ((map['branch'] as String? ?? '') != branch) return null;

    final skipped = <String>[];
    final rows = <UploadRow>[];
    for (final item in map['rows'] as List<dynamic>? ?? []) {
      if (item is! Map<String, dynamic>) continue;
      final row = _rowFromDraft(item);
      if (!File(row.sourcePath).existsSync()) {
        skipped.add(row.sourcePath);
        continue;
      }
      rows.add(row);
    }

    SessionDefaults? defaults;
    final defaultsRaw = map['sessionDefaults'];
    if (defaultsRaw is Map<String, dynamic>) {
      defaults = SessionDefaults(
        tags: defaultsRaw['tags'] as String? ?? '',
        collectionSelect: defaultsRaw['collectionSelect'] as String? ?? '',
        hidden: defaultsRaw['hidden'] as bool? ?? false,
        cameraSelect: defaultsRaw['cameraSelect'] as String? ?? '',
        lensSelect: defaultsRaw['lensSelect'] as String? ?? '',
        copyright: defaultsRaw['copyright'] as String? ?? '',
        location: defaultsRaw['location'] as String? ?? '',
        captureDate: defaultsRaw['captureDate'] as String? ?? '',
      );
    }

    return DraftRestoreResult(
      rows: rows,
      selectedRowIds: {
        for (final id in map['selectedRowIds'] as List<dynamic>? ?? [])
          if (id is String) id,
      },
      commitMessage: map['commitMessage'] as String? ?? '',
      sessionDefaults: defaults,
      skippedPaths: skipped,
    );
  }

  Map<String, dynamic> _rowToDraft(UploadRow row) => {
        'id': row.id,
        'sourcePath': row.sourcePath,
        'title': row.title,
        'description': row.description,
        'tags': row.tags,
        'location': row.location,
        'captureDate': row.captureDate,
        'captureDateTimeIso': row.captureDateTimeIso,
        'collectionSelect': row.collectionSelect,
        'collectionSetCover': row.collectionSetCover,
        'cameraSelect': row.cameraSelect,
        'cameraCustom': row.cameraCustom,
        'lensSelect': row.lensSelect,
        'lensCustom': row.lensCustom,
        'alt': row.alt,
        'hidden': row.hidden,
        'sortOrder': row.sortOrder,
        'copyright': row.copyright,
        'extension': row.extension,
        'destId': row.destId,
        'destFilename': row.destFilename,
        'destExists': row.destExists,
        'editExistingId': row.editExistingId,
        'preserveUploadedAt': row.preserveUploadedAt,
        'preserveExifDisplay': row.preserveExifDisplay,
        'editGalleryImagePath': row.editGalleryImagePath,
        'editOriginalFilename': row.editOriginalFilename,
        'replaceImageFile': row.replaceImageFile,
      };

  UploadRow _rowFromDraft(Map<String, dynamic> map) {
    List<Map<String, String>>? exif;
    final rawExif = map['preserveExifDisplay'];
    if (rawExif is List) {
      exif = rawExif
          .whereType<Map>()
          .map((e) => e.map((k, v) => MapEntry(k.toString(), v.toString())))
          .toList();
    }

    return UploadRow(
      id: map['id'] as String? ?? '',
      sourcePath: map['sourcePath'] as String? ?? '',
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      tags: map['tags'] as String? ?? '',
      location: map['location'] as String? ?? '',
      captureDate: map['captureDate'] as String? ?? '',
      captureDateTimeIso: map['captureDateTimeIso'] as String? ?? '',
      collectionSelect: map['collectionSelect'] as String? ?? '',
      collectionSetCover: map['collectionSetCover'] as bool? ?? false,
      cameraSelect: map['cameraSelect'] as String? ?? '',
      cameraCustom: map['cameraCustom'] as String? ?? '',
      lensSelect: map['lensSelect'] as String? ?? '',
      lensCustom: map['lensCustom'] as String? ?? '',
      alt: map['alt'] as String? ?? '',
      hidden: map['hidden'] as bool? ?? false,
      sortOrder: map['sortOrder'] as String? ?? '',
      copyright: map['copyright'] as String? ?? '',
      extension: map['extension'] as String? ?? '.jpg',
      destId: map['destId'] as String? ?? '',
      destFilename: map['destFilename'] as String? ?? '',
      destExists: map['destExists'] as bool? ?? false,
      editExistingId: map['editExistingId'] as String?,
      preserveUploadedAt: map['preserveUploadedAt'] as String?,
      preserveExifDisplay: exif,
      editGalleryImagePath: map['editGalleryImagePath'] as String?,
      editOriginalFilename: map['editOriginalFilename'] as String?,
      replaceImageFile: map['replaceImageFile'] as bool? ?? false,
    );
  }

  DraftSession buildSession({
    required String repoUrl,
    required String branch,
    required List<UploadRow> rows,
    required String commitMessage,
    required Set<String> selectedRowIds,
    required SessionDefaults sessionDefaults,
  }) {
    return DraftSession(
      repoUrl: repoUrl,
      branch: branch,
      commitMessage: commitMessage,
      selectedRowIds: selectedRowIds.toList(),
      rows: rows.map(_rowToDraft).toList(),
      sessionDefaults: {
        'tags': sessionDefaults.tags,
        'collectionSelect': sessionDefaults.collectionSelect,
        'hidden': sessionDefaults.hidden,
        'cameraSelect': sessionDefaults.cameraSelect,
        'lensSelect': sessionDefaults.lensSelect,
        'copyright': sessionDefaults.copyright,
        'location': sessionDefaults.location,
        'captureDate': sessionDefaults.captureDate,
      },
    );
  }
}
