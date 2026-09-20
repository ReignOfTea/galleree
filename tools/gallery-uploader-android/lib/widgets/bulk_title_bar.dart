import 'package:flutter/material.dart';

import '../utils/bulk_title.dart';

class BulkTitleBar extends StatefulWidget {
  const BulkTitleBar({
    super.key,
    required this.rowCount,
    required this.selectedCount,
    required this.disabled,
    required this.onApply,
    required this.onSortByCaptureDate,
  });

  final int rowCount;
  final int selectedCount;
  final bool disabled;
  final void Function(BulkTitleOptions options) onApply;
  final VoidCallback onSortByCaptureDate;

  @override
  State<BulkTitleBar> createState() => _BulkTitleBarState();
}

class _BulkTitleBarState extends State<BulkTitleBar> {
  final _nameController = TextEditingController();
  final _incrementalStartController = TextEditingController(text: '1');
  final _prefixController = TextEditingController();
  final _suffixController = TextEditingController();
  final _numberStartController = TextEditingController(text: '1');

  @override
  void dispose() {
    _nameController.dispose();
    _incrementalStartController.dispose();
    _prefixController.dispose();
    _suffixController.dispose();
    _numberStartController.dispose();
    super.dispose();
  }

  String get _targetLabel {
    if (widget.selectedCount > 0) {
      return '${widget.selectedCount} selected';
    }
    return 'all ${widget.rowCount} photos';
  }

  int get _startNumber {
    final parsed = int.tryParse(_incrementalStartController.text.trim());
    return parsed == null || parsed < 1 ? 1 : parsed;
  }

  String get _preview {
    final base = _nameController.text.trim();
    if (base.isEmpty) return '';
    final count = widget.selectedCount > 0 ? widget.selectedCount : widget.rowCount;
    final start = _startNumber;
    final shown = count < 3 ? count : 3;
    final parts = [
      for (var i = 0; i < shown; i++) incrementalTitle(base, start + i),
    ];
    if (count > 3) parts.add('…');
    return parts.join(', ');
  }

  void _applyIncremental() {
    final base = _nameController.text.trim();
    if (base.isEmpty || widget.disabled) return;
    widget.onApply(BulkTitleOptions.incremental(base, start: _startNumber));
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rowCount < 2) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Incremental namer', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(
              'Names $_targetLabel in queue order, e.g. My Gallery #1, #2.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 260,
                  child: TextField(
                    controller: _nameController,
                    enabled: !widget.disabled,
                    textInputAction: TextInputAction.done,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _applyIncremental(),
                    decoration: const InputDecoration(
                      labelText: 'Shared name',
                      hintText: 'My Gallery',
                      isDense: true,
                    ),
                  ),
                ),
                SizedBox(
                  width: 80,
                  child: TextField(
                    controller: _incrementalStartController,
                    enabled: !widget.disabled,
                    decoration: const InputDecoration(labelText: 'Start #', isDense: true),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                FilledButton(
                  onPressed: widget.disabled || _nameController.text.trim().isEmpty
                      ? null
                      : _applyIncremental,
                  child: const Text('Apply names'),
                ),
              ],
            ),
            if (_preview.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                _preview,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: scheme.primary,
                    ),
              ),
            ],
            const SizedBox(height: 16),
            Text('Other title tools', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SizedBox(
                  width: 160,
                  child: TextField(
                    controller: _prefixController,
                    decoration: const InputDecoration(
                      labelText: 'Prefix',
                      isDense: true,
                    ),
                  ),
                ),
                FilledButton.tonal(
                  onPressed: widget.disabled
                      ? null
                      : () => widget.onApply(BulkTitleOptions.prefix(_prefixController.text)),
                  child: const Text('Add prefix'),
                ),
                SizedBox(
                  width: 160,
                  child: TextField(
                    controller: _suffixController,
                    decoration: const InputDecoration(
                      labelText: 'Suffix',
                      isDense: true,
                    ),
                  ),
                ),
                FilledButton.tonal(
                  onPressed: widget.disabled
                      ? null
                      : () => widget.onApply(BulkTitleOptions.suffix(_suffixController.text)),
                  child: const Text('Add suffix'),
                ),
                OutlinedButton(
                  onPressed: widget.disabled
                      ? null
                      : () => widget.onApply(const BulkTitleOptions.stripCameraPrefix()),
                  child: const Text('Strip camera prefix'),
                ),
                SizedBox(
                  width: 80,
                  child: TextField(
                    controller: _numberStartController,
                    decoration: const InputDecoration(labelText: 'Start #', isDense: true),
                    keyboardType: TextInputType.number,
                  ),
                ),
                FilledButton.tonal(
                  onPressed: widget.disabled
                      ? null
                      : () {
                          final start = int.tryParse(_numberStartController.text) ?? 1;
                          widget.onApply(BulkTitleOptions.number(start: start, pad: 2));
                        },
                  child: const Text('Number titles'),
                ),
                OutlinedButton(
                  onPressed: widget.disabled ? null : widget.onSortByCaptureDate,
                  child: const Text('Sort by capture date'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
