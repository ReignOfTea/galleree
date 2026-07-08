import 'dart:convert';

import 'package:uuid/uuid.dart';

/// Gallery image sidecar — mirrors `src/lib/galleryMeta.ts`.
const galleryMetaVersion = 1;
final galleryImageIdPattern = RegExp(r'^[a-f0-9]{32}$', caseSensitive: false);
const allowedImageExt = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'};
final collectionSlugPattern = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$');

class GalleryImageMeta {
  GalleryImageMeta({
    required this.version,
    required this.id,
    required this.title,
    required this.tags,
    this.description,
    this.location,
    this.capturedOn,
    this.capturedAt,
    this.camera,
    this.lens,
    this.collectionSlug,
    this.alt,
    this.hidden = false,
    this.sortOrder,
    this.copyright,
    this.uploadedAt,
    this.blurHash,
    this.exifDisplay,
  });

  final int version;
  final String id;
  final String title;
  final List<String> tags;
  final String? description;
  final String? location;
  final String? capturedOn;
  final String? capturedAt;
  final String? camera;
  final String? lens;
  final String? collectionSlug;
  final String? alt;
  final bool hidden;
  final int? sortOrder;
  final String? copyright;
  final String? uploadedAt;
  final String? blurHash;
  final List<Map<String, String>>? exifDisplay;

  Map<String, dynamic> toJson() {
    final out = <String, dynamic>{
      'version': version,
      'id': id,
      'title': title,
      'tags': tags,
    };
    if (description != null) out['description'] = description;
    if (location != null) out['location'] = location;
    if (capturedOn != null) out['capturedOn'] = capturedOn;
    if (capturedAt != null) out['capturedAt'] = capturedAt;
    if (camera != null) out['camera'] = camera;
    if (lens != null) out['lens'] = lens;
    if (collectionSlug != null) out['collectionSlug'] = collectionSlug;
    if (alt != null) out['alt'] = alt;
    if (hidden) out['hidden'] = true;
    if (sortOrder != null) out['sortOrder'] = sortOrder;
    if (copyright != null) out['copyright'] = copyright;
    if (uploadedAt != null) out['uploadedAt'] = uploadedAt;
    if (blurHash != null) out['blurHash'] = blurHash;
    if (exifDisplay != null && exifDisplay!.isNotEmpty) {
      out['exifDisplay'] = exifDisplay;
    }
    return out;
  }

  String serialize() => '${const JsonEncoder.withIndent('  ').convert(toJson())}\n';
}

String generateGalleryImageId() => const Uuid().v4().replaceAll('-', '');

bool isValidGalleryImageId(String id) => galleryImageIdPattern.hasMatch(id);

bool isValidCollectionSlug(String slug) {
  final t = slug.trim().toLowerCase();
  return t.isNotEmpty && t.length <= 80 && collectionSlugPattern.hasMatch(t);
}

String normalizeImageExtension(String ext) {
  final withDot = ext.startsWith('.') ? ext.toLowerCase() : '.${ext.toLowerCase()}';
  return allowedImageExt.contains(withDot) ? withDot : '.jpg';
}

String? captureDateToCapturedOn(DateTime? date) {
  if (date == null) return null;
  final y = date.year.toString().padLeft(4, '0');
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

String nowIsoTimestamp() => DateTime.now().toUtc().toIso8601String();

List<String> normalizeGalleryTags(List<String> tags) {
  final seen = <String>{};
  final out = <String>[];
  for (final raw in tags) {
    final n = _normalizeTag(raw);
    if (n.isEmpty) continue;
    final key = n.toLowerCase();
    if (seen.contains(key)) continue;
    seen.add(key);
    out.add(n);
  }
  return out;
}

String _normalizeTag(String tag) {
  final t = tag.trim();
  if (t.isEmpty) return t;
  const fixes = {'youtuber': 'YouTuber', 'youtube': 'YouTube', 'coe': 'CoE', 'uk': 'UK'};
  final lower = t.toLowerCase();
  if (fixes.containsKey(lower)) return fixes[lower]!;
  return t.split(RegExp(r'[\s-]+')).map((word) {
    if (word.toUpperCase() == word && word.length > 1) return word;
    if (word.isEmpty) return word;
    return word[0].toUpperCase() + word.substring(1).toLowerCase();
  }).join(' ');
}

List<String> parseTagsInput(String input) =>
    input.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

GalleryImageMeta galleryMetaFromUploadFields({
  required String title,
  required String description,
  required List<String> tags,
  required String location,
  required DateTime? capturedAt,
  required String? camera,
  required String? lens,
  required String? collectionSlug,
  required String alt,
  required bool hidden,
  required int? sortOrder,
  required String copyright,
  required String id,
  String? uploadedAt,
  String? blurHash,
  List<Map<String, String>>? exifDisplay,
}) {
  var tagList = tags.map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
  final trimmedTitle = title.trim().isEmpty ? 'Untitled' : title.trim();
  if (tagList.isEmpty) tagList = [trimmedTitle];
  tagList = normalizeGalleryTags(tagList);

  final slugRaw = collectionSlug?.trim().toLowerCase() ?? '';
  final slug = slugRaw.isNotEmpty && isValidCollectionSlug(slugRaw) ? slugRaw : null;

  return GalleryImageMeta(
    version: galleryMetaVersion,
    id: id,
    title: trimmedTitle,
    description: description.trim().isEmpty ? null : description.trim(),
    tags: tagList.toSet().toList(),
    location: location.trim().isEmpty ? null : location.trim(),
    capturedOn: captureDateToCapturedOn(capturedAt),
    capturedAt: capturedAt?.toUtc().toIso8601String(),
    camera: _normalizeEquipment(camera),
    lens: _normalizeEquipment(lens),
    collectionSlug: slug,
    alt: alt.trim().isEmpty ? null : alt.trim(),
    hidden: hidden,
    sortOrder: sortOrder,
    copyright: copyright.trim().isEmpty ? null : copyright.trim(),
    uploadedAt: uploadedAt ?? nowIsoTimestamp(),
    blurHash: blurHash,
    exifDisplay: exifDisplay,
  );
}

String? _normalizeEquipment(String? value) {
  if (value == null) return null;
  final t = value.trim().toLowerCase();
  return t.isEmpty ? null : t;
}

String titleFromFilename(String path) {
  final name = path.split(RegExp(r'[/\\]')).last;
  final dot = name.lastIndexOf('.');
  final stem = dot > 0 ? name.substring(0, dot) : name;
  final words = stem
      .replaceAll(RegExp(r'[_+.]+'), ' ')
      .replaceAll('-', ' ')
      .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .toList();
  if (words.isEmpty) return stem;
  return words.map((w) {
    if (RegExp(r'^\d+$').hasMatch(w)) return w;
    final lower = w.toLowerCase();
    return lower[0].toUpperCase() + lower.substring(1);
  }).join(' ');
}
