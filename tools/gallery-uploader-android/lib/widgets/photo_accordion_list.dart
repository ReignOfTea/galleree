import 'package:flutter/material.dart';

import '../models/models.dart';
import 'local_image_preview.dart';
import 'photo_detail_pane.dart';

class PhotoAccordionList extends StatelessWidget {
  const PhotoAccordionList({
    super.key,
    required this.rows,
    required this.selectedId,
    required this.selectedIds,
    required this.registries,
    required this.knownTags,
    required this.onSelect,
    required this.onToggleSelect,
    required this.onRemove,
    required this.onChanged,
    this.onReplaceImage,
    this.onCreateRegistry,
  });

  final List<UploadRow> rows;
  final String? selectedId;
  final Set<String> selectedIds;
  final GalleryRegistries registries;
  final List<String> knownTags;
  final ValueChanged<String> onSelect;
  final ValueChanged<String> onToggleSelect;
  final ValueChanged<String> onRemove;
  final void Function(UploadRow row) onChanged;
  final void Function(String rowId)? onReplaceImage;
  final void Function(RegistryKind kind)? onCreateRegistry;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: rows.length,
      itemBuilder: (context, index) {
        final row = rows[index];
        final checked = selectedIds.contains(row.id);
        final title = row.title.trim().isEmpty ? 'Untitled' : row.title.trim();
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          color: row.id == selectedId
              ? Theme.of(context).colorScheme.secondaryContainer
              : null,
          child: ExpansionTile(
            initiallyExpanded: row.id == selectedId,
            onExpansionChanged: (open) {
              if (open) onSelect(row.id);
            },
            leading: SizedBox(
              width: 96,
              child: Row(
                children: [
                  Checkbox(
                    value: checked,
                    onChanged: (_) => onToggleSelect(row.id),
                  ),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LocalImagePreview(
                      path: row.sourcePath,
                      width: 40,
                      height: 40,
                      fit: BoxFit.cover,
                    ),
                  ),
                ],
              ),
            ),
            title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text(
              [
                if (row.collectionSelect.isNotEmpty) row.collectionSelect,
                if (row.isEdit) 'Edit existing',
                if (row.destExists && !row.isEdit) 'Will replace',
              ].join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: IconButton(
              tooltip: 'Remove',
              onPressed: () => onRemove(row.id),
              icon: const Icon(Icons.close, size: 18),
            ),
            children: [
              PhotoDetailPane(
                row: row,
                registries: registries,
                knownTags: knownTags,
                onChanged: onChanged,
                onReplaceImage:
                    onReplaceImage == null ? null : () => onReplaceImage!(row.id),
                onCreateRegistry: onCreateRegistry,
              ),
            ],
          ),
        );
      },
    );
  }
}
