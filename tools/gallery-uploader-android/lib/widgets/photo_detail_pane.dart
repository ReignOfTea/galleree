import 'package:flutter/material.dart';

import '../models/models.dart';
import 'local_image_preview.dart';
import 'tags_input.dart';

class PhotoDetailPane extends StatelessWidget {
  const PhotoDetailPane({
    super.key,
    required this.row,
    required this.registries,
    required this.knownTags,
    required this.onChanged,
    this.onBack,
    this.onCreateRegistry,
  });

  final UploadRow row;
  final GalleryRegistries registries;
  final List<String> knownTags;
  final ValueChanged<UploadRow> onChanged;
  final VoidCallback? onBack;
  final void Function(RegistryKind kind)? onCreateRegistry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      children: [
        if (onBack != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back to list'),
            ),
          ),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: LocalImagePreview(path: row.sourcePath, fit: BoxFit.contain),
          ),
        ),
        const SizedBox(height: 20),
        _field(
          context,
          label: 'Title',
          value: row.title,
          onChanged: (v) => onChanged(row.copyWith(title: v)),
          required: true,
        ),
        _field(
          context,
          label: 'Description',
          value: row.description,
          onChanged: (v) => onChanged(row.copyWith(description: v)),
          maxLines: 3,
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TagsInput(
            key: ValueKey('tags-${row.id}'),
            label: 'Tags (comma-separated)',
            value: row.tags,
            knownTags: knownTags,
            onChanged: (v) => onChanged(row.copyWith(tags: v)),
          ),
        ),
        _field(
          context,
          label: 'Location',
          value: row.location,
          onChanged: (v) => onChanged(row.copyWith(location: v)),
        ),
        _field(
          context,
          label: 'Capture date (YYYY-MM-DD)',
          value: row.captureDate,
          onChanged: (v) => onChanged(row.copyWith(captureDate: v)),
        ),
        const SizedBox(height: 8),
        _dropdown(
          context,
          label: 'Collection',
          value: row.collectionSelect,
          items: [
            const DropdownMenuItem(value: selectNone, child: Text('No collection')),
            ...registries.collections.map(
              (c) => DropdownMenuItem(value: c.slug, child: Text(c.title)),
            ),
          ],
          onChanged: (v) => onChanged(row.copyWith(collectionSelect: v ?? selectNone)),
          trailing: onCreateRegistry == null
              ? null
              : IconButton(
                  tooltip: 'New collection',
                  onPressed: () => onCreateRegistry!(RegistryKind.collection),
                  icon: const Icon(Icons.add),
                ),
        ),
        if (row.collectionSelect.isNotEmpty)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Set as collection cover'),
            value: row.collectionSetCover,
            onChanged: (v) => onChanged(row.copyWith(collectionSetCover: v)),
          ),
        _dropdown(
          context,
          label: 'Camera',
          value: row.cameraSelect,
          items: [
            const DropdownMenuItem(value: selectNone, child: Text('None')),
            ...registries.cameras.map(
              (c) => DropdownMenuItem(value: c.slug, child: Text(c.name)),
            ),
            const DropdownMenuItem(value: selectCustom, child: Text('Custom…')),
          ],
          onChanged: (v) => onChanged(row.copyWith(cameraSelect: v ?? selectNone)),
          trailing: onCreateRegistry == null
              ? null
              : IconButton(
                  tooltip: 'New camera',
                  onPressed: () => onCreateRegistry!(RegistryKind.camera),
                  icon: const Icon(Icons.add),
                ),
        ),
        if (row.cameraSelect == selectCustom)
          _field(
            context,
            label: 'Custom camera slug',
            value: row.cameraCustom,
            onChanged: (v) => onChanged(row.copyWith(cameraCustom: v)),
          ),
        _dropdown(
          context,
          label: 'Lens',
          value: row.lensSelect,
          items: [
            const DropdownMenuItem(value: selectNone, child: Text('None')),
            ...registries.lenses.map(
              (l) => DropdownMenuItem(value: l.slug, child: Text(l.name)),
            ),
            const DropdownMenuItem(value: selectCustom, child: Text('Custom…')),
          ],
          onChanged: (v) => onChanged(row.copyWith(lensSelect: v ?? selectNone)),
          trailing: onCreateRegistry == null
              ? null
              : IconButton(
                  tooltip: 'New lens',
                  onPressed: () => onCreateRegistry!(RegistryKind.lens),
                  icon: const Icon(Icons.add),
                ),
        ),
        if (row.lensSelect == selectCustom)
          _field(
            context,
            label: 'Custom lens slug',
            value: row.lensCustom,
            onChanged: (v) => onChanged(row.copyWith(lensCustom: v)),
          ),
        _field(
          context,
          label: 'Alt text',
          value: row.alt,
          onChanged: (v) => onChanged(row.copyWith(alt: v)),
        ),
        _field(
          context,
          label: 'Sort order',
          value: row.sortOrder,
          onChanged: (v) => onChanged(row.copyWith(sortOrder: v)),
        ),
        _field(
          context,
          label: 'Copyright',
          value: row.copyright,
          onChanged: (v) => onChanged(row.copyWith(copyright: v)),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Hidden on site'),
          value: row.hidden,
          onChanged: (v) => onChanged(row.copyWith(hidden: v)),
        ),
      ],
    );
  }

  Widget _field(
    BuildContext context, {
    required String label,
    required String value,
    required ValueChanged<String> onChanged,
    int maxLines = 1,
    bool required = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        key: ValueKey('$label-${row.id}'),
        initialValue: value,
        onChanged: onChanged,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: required ? '$label *' : label,
        ),
      ),
    );
  }

  Widget _dropdown(
    BuildContext context, {
    required String label,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
    Widget? trailing,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              value: value.isEmpty ? selectNone : value,
              decoration: InputDecoration(labelText: label),
              items: items,
              onChanged: onChanged,
            ),
          ),
          if (trailing != null) trailing,
        ],
      ),
    );
  }
}
