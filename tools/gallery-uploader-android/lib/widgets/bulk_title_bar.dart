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
  final _prefixController = TextEditingController();
  final _suffixController = TextEditingController();
  final _numberStartController = TextEditingController(text: '1');

  @override
  void dispose() {
    _prefixController.dispose();
    _suffixController.dispose();
    _numberStartController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rowCount < 2) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Bulk title tools', style: Theme.of(context).textTheme.titleSmall),
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
