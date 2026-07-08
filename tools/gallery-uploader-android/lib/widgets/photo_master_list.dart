import 'package:flutter/material.dart';

import '../models/models.dart';
import 'local_image_preview.dart';

class PhotoMasterList extends StatelessWidget {
  const PhotoMasterList({
    super.key,
    required this.rows,
    required this.selectedId,
    required this.selectedIds,
    required this.onSelect,
    required this.onToggleSelect,
    required this.onRemove,
  });

  final List<UploadRow> rows;
  final String? selectedId;
  final Set<String> selectedIds;
  final ValueChanged<String> onSelect;
  final ValueChanged<String> onToggleSelect;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No photos in the queue.\nTap Add photos to begin.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final row = rows[index];
        final selected = row.id == selectedId;
        final checked = selectedIds.contains(row.id);
        return Material(
          color: selected
              ? Theme.of(context).colorScheme.secondaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => onSelect(row.id),
            onLongPress: () => onToggleSelect(row.id),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  Checkbox(
                    value: checked,
                    onChanged: (_) => onToggleSelect(row.id),
                  ),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LocalImagePreview(
                      path: row.sourcePath,
                      width: 72,
                      height: 72,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row.title.trim().isEmpty ? 'Untitled' : row.title,
                          style: Theme.of(context).textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (row.collectionSelect.isNotEmpty)
                          Text(
                            row.collectionSelect,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        if (row.isEdit)
                          Text(
                            'Edit existing',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                          )
                        else if (row.destExists)
                          Text(
                            'Will replace existing',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.tertiary,
                                ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove',
                    onPressed: () => onRemove(row.id),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
