import 'package:flutter/material.dart';

import '../models/models.dart';
import 'local_image_preview.dart';

class PhotoCompactList extends StatelessWidget {
  const PhotoCompactList({
    super.key,
    required this.rows,
    required this.selectedId,
    required this.selectedIds,
    required this.expandedId,
    required this.onSelect,
    required this.onToggleSelect,
    required this.onExpand,
    required this.onRemove,
    required this.onChanged,
  });

  final List<UploadRow> rows;
  final String? selectedId;
  final Set<String> selectedIds;
  final String? expandedId;
  final ValueChanged<String> onSelect;
  final ValueChanged<String> onToggleSelect;
  final ValueChanged<String?> onExpand;
  final ValueChanged<String> onRemove;
  final void Function(UploadRow row) onChanged;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const SizedBox(width: 48),
                const SizedBox(width: 56, child: Text('Thumb', style: TextStyle(fontSize: 12))),
                const Expanded(flex: 3, child: Text('Title', style: TextStyle(fontSize: 12))),
                const Expanded(child: Text('Collection', style: TextStyle(fontSize: 12))),
                const SizedBox(width: 80),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final row = rows[index];
                return _CompactRow(
                  row: row,
                  selected: row.id == selectedId,
                  checked: selectedIds.contains(row.id),
                  expanded: expandedId == row.id,
                  onSelect: () => onSelect(row.id),
                  onToggleSelect: () => onToggleSelect(row.id),
                  onExpand: () => onExpand(expandedId == row.id ? null : row.id),
                  onRemove: () => onRemove(row.id),
                  onChanged: onChanged,
                );
              },
              childCount: rows.length,
            ),
          ),
        ),
      ],
    );
  }
}

class _CompactRow extends StatelessWidget {
  const _CompactRow({
    required this.row,
    required this.selected,
    required this.checked,
    required this.expanded,
    required this.onSelect,
    required this.onToggleSelect,
    required this.onExpand,
    required this.onRemove,
    required this.onChanged,
  });

  final UploadRow row;
  final bool selected;
  final bool checked;
  final bool expanded;
  final VoidCallback onSelect;
  final VoidCallback onToggleSelect;
  final VoidCallback onExpand;
  final VoidCallback onRemove;
  final void Function(UploadRow row) onChanged;

  @override
  Widget build(BuildContext context) {
    final titleMissing = row.title.trim().isEmpty;
    return Column(
      children: [
        Material(
          color: selected
              ? Theme.of(context).colorScheme.secondaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: onSelect,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  Checkbox(value: checked, onChanged: (_) => onToggleSelect()),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LocalImagePreview(
                      path: row.sourcePath,
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      key: ValueKey('compact-title-${row.id}'),
                      initialValue: row.title,
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: 'Title',
                        errorText: titleMissing ? 'Required' : null,
                        border: InputBorder.none,
                      ),
                      onChanged: (v) => onChanged(row.copyWith(title: v)),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      row.collectionSelect.isEmpty ? '—' : row.collectionSelect,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  IconButton(
                    tooltip: expanded ? 'Collapse' : 'Expand',
                    onPressed: onExpand,
                    icon: Icon(expanded ? Icons.expand_less : Icons.expand_more),
                  ),
                  IconButton(
                    tooltip: 'Remove',
                    onPressed: onRemove,
                    icon: const Icon(Icons.close, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (expanded) ...[
          const SizedBox(height: 4),
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    key: ValueKey('compact-desc-${row.id}'),
                    initialValue: row.description,
                    decoration: const InputDecoration(labelText: 'Description'),
                    maxLines: 2,
                    onChanged: (v) => onChanged(row.copyWith(description: v)),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    key: ValueKey('compact-tags-${row.id}'),
                    initialValue: row.tags,
                    decoration: const InputDecoration(labelText: 'Tags'),
                    onChanged: (v) => onChanged(row.copyWith(tags: v)),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 6),
      ],
    );
  }
}
