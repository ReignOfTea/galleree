import 'package:flutter/material.dart';

import '../models/models.dart';

class QueueToolbar extends StatelessWidget {
  const QueueToolbar({
    super.key,
    required this.rowCount,
    required this.selectedCount,
    required this.viewMode,
    required this.disabled,
    required this.onViewModeChanged,
    required this.onOpenDisplayPreview,
    required this.onSelectAll,
    required this.onClearSelection,
  });

  final int rowCount;
  final int selectedCount;
  final QueueViewMode viewMode;
  final bool disabled;
  final ValueChanged<QueueViewMode> onViewModeChanged;
  final VoidCallback onOpenDisplayPreview;
  final VoidCallback onSelectAll;
  final VoidCallback onClearSelection;

  @override
  Widget build(BuildContext context) {
    if (rowCount == 0) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('View', style: Theme.of(context).textTheme.labelLarge),
            SegmentedButton<QueueViewMode>(
              segments: QueueViewMode.values
                  .map((m) => ButtonSegment(value: m, label: Text(m.label)))
                  .toList(),
              selected: {viewMode},
              onSelectionChanged: disabled
                  ? null
                  : (next) {
                      if (next.isNotEmpty) onViewModeChanged(next.first);
                    },
            ),
            if (selectedCount > 0) ...[
              Chip(
                label: Text('$selectedCount selected'),
                deleteIcon: const Icon(Icons.close, size: 18),
                onDeleted: disabled ? null : onClearSelection,
              ),
              TextButton(onPressed: disabled ? null : onSelectAll, child: const Text('Select all')),
            ],
            OutlinedButton.icon(
              onPressed: disabled ? null : onOpenDisplayPreview,
              icon: const Icon(Icons.preview_outlined, size: 18),
              label: const Text('Display preview'),
            ),
          ],
        ),
      ),
    );
  }
}

class OperationProgressBar extends StatelessWidget {
  const OperationProgressBar({
    super.key,
    required this.progress,
    required this.canCancel,
    required this.onCancel,
  });

  final String? progress;
  final bool canCancel;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    if (progress == null) return const SizedBox.shrink();

    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const LinearProgressIndicator(minHeight: 3),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
            child: Row(
              children: [
                Expanded(child: Text(progress!, style: Theme.of(context).textTheme.bodySmall)),
                if (canCancel)
                  TextButton(onPressed: onCancel, child: const Text('Cancel')),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
