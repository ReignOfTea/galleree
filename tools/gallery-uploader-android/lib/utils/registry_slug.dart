import '../models/gallery_meta.dart';

String displayTitleToSlug(String title) {
  return title
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), '-')
      .replaceAll(RegExp(r'[^a-z0-9-]'), '')
      .replaceAll(RegExp(r'-+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
}

String? collectionSlugFromTitle(String title) {
  final slug = displayTitleToSlug(title);
  if (slug.isEmpty || !isValidCollectionSlug(slug)) return null;
  return slug;
}

bool isValidEquipmentSlug(String slug) => isValidCollectionSlug(slug);

String? equipmentSlugFromLabel(String label) {
  final slug = displayTitleToSlug(label);
  if (slug.isEmpty || !isValidEquipmentSlug(slug)) return null;
  return slug;
}
