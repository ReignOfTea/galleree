import 'package:flutter/material.dart';

import '../models/models.dart';
import '../utils/batch_edit.dart';
import 'tags_input.dart';

const _noChange = '__no_change__';
const _clear = '__clear__';

class BatchEditBar extends StatefulWidget {
  const BatchEditBar({
    super.key,
    required this.rowCount,
    required this.selectedCount,
    required this.registries,
    required this.knownTags,
    required this.disabled,
    required this.onApply,
    required this.onCopyFromFirst,
    required this.onSelectAll,
    required this.onClearSelection,
  });

  final int rowCount;
  final int selectedCount;
  final GalleryRegistries registries;
  final List<String> knownTags;
  final bool disabled;
  final ValueChanged<BatchEditPatch> onApply;
  final void Function(List<CopyFromFirstField> fields) onCopyFromFirst;
  final VoidCallback onSelectAll;
  final VoidCallback onClearSelection;

  @override
  State<BatchEditBar> createState() => _BatchEditBarState();
}

class _BatchEditBarState extends State<BatchEditBar> {
  String _tags = '';
  String _collection = _noChange;
  bool? _hidden;
  String _camera = _noChange;
  String _lens = _noChange;
  String _copyright = '';
  String _location = '';
  String _copyrightMode = 'no_change';
  String _locationMode = 'no_change';
  String _captureDateMode = 'no_change';
  String _captureDate = '';

  @override
  Widget build(BuildContext context) {
    if (widget.rowCount < 2) return const SizedBox.shrink();
    final target = widget.selectedCount > 0
        ? '${widget.selectedCount} selected'
        : 'all ${widget.rowCount} photos';

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Batch edit applies to $target.',
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 12),
            TagsInput(
              label: 'Add tags (comma-separated)',
              value: _tags,
              knownTags: widget.knownTags,
              onChanged: (v) => setState(() => _tags = v),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _dropdown(
                  label: 'Collection',
                  value: _collection,
                  items: [
                    const DropdownMenuItem(value: _noChange, child: Text('— no change —')),
                    const DropdownMenuItem(value: _clear, child: Text('Clear collection')),
                    ...widget.registries.collections.map(
                      (c) => DropdownMenuItem(value: c.slug, child: Text(c.title)),
                    ),
                  ],
                  onChanged: (v) => setState(() => _collection = v ?? _noChange),
                ),
                _dropdown(
                  label: 'Hidden',
                  value: _hidden == null ? '' : (_hidden! ? '1' : '0'),
                  items: const [
                    DropdownMenuItem(value: '', child: Text('— no change —')),
                    DropdownMenuItem(value: '0', child: Text('Visible')),
                    DropdownMenuItem(value: '1', child: Text('Hidden')),
                  ],
                  onChanged: (v) => setState(() {
                    _hidden = v == null || v.isEmpty ? null : v == '1';
                  }),
                ),
                _dropdown(
                  label: 'Camera',
                  value: _camera,
                  items: [
                    const DropdownMenuItem(value: _noChange, child: Text('— no change —')),
                    const DropdownMenuItem(value: selectNone, child: Text('Clear')),
                    ...widget.registries.cameras.map(
                      (c) => DropdownMenuItem(value: c.slug, child: Text(c.name)),
                    ),
                  ],
                  onChanged: (v) => setState(() => _camera = v ?? _noChange),
                ),
                _dropdown(
                  label: 'Lens',
                  value: _lens,
                  items: [
                    const DropdownMenuItem(value: _noChange, child: Text('— no change —')),
                    const DropdownMenuItem(value: selectNone, child: Text('Clear')),
                    ...widget.registries.lenses.map(
                      (l) => DropdownMenuItem(value: l.slug, child: Text(l.name)),
                    ),
                  ],
                  onChanged: (v) => setState(() => _lens = v ?? _noChange),
                ),
                _dropdown(
                  label: 'Capture date',
                  value: _captureDateMode,
                  items: const [
                    DropdownMenuItem(value: 'no_change', child: Text('— no change —')),
                    DropdownMenuItem(value: 'set', child: Text('Set to…')),
                    DropdownMenuItem(value: 'clear', child: Text('Clear')),
                  ],
                  onChanged: (v) => setState(() {
                    _captureDateMode = v ?? 'no_change';
                    if (_captureDateMode != 'set') _captureDate = '';
                  }),
                ),
                if (_captureDateMode == 'set')
                  SizedBox(
                    width: 200,
                    child: OutlinedButton(
                      onPressed: widget.disabled ? null : _pickCaptureDate,
                      child: Text(
                        _captureDate.isEmpty ? 'Pick date' : _captureDate,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                _dropdown(
                  label: 'Copyright',
                  value: _copyrightMode,
                  items: const [
                    DropdownMenuItem(value: 'no_change', child: Text('— no change —')),
                    DropdownMenuItem(value: 'set', child: Text('Set to…')),
                    DropdownMenuItem(value: 'clear', child: Text('Clear')),
                  ],
                  onChanged: (v) => setState(() {
                    _copyrightMode = v ?? 'no_change';
                    if (_copyrightMode != 'set') _copyright = '';
                  }),
                ),
                if (_copyrightMode == 'set')
                  SizedBox(
                    width: 200,
                    child: TextFormField(
                      decoration: const InputDecoration(
                        labelText: 'Copyright text',
                        isDense: true,
                      ),
                      enabled: !widget.disabled,
                      onChanged: (v) => _copyright = v,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton(
                  onPressed: widget.disabled ? null : _apply,
                  child: const Text('Apply batch'),
                ),
                OutlinedButton(
                  onPressed: widget.disabled ? null : widget.onSelectAll,
                  child: const Text('Select all'),
                ),
                if (widget.selectedCount > 0)
                  OutlinedButton(
                    onPressed: widget.disabled ? null : widget.onClearSelection,
                    child: const Text('Clear selection'),
                  ),
                OutlinedButton(
                  onPressed: widget.disabled || widget.selectedCount == 0
                      ? null
                      : () => widget.onCopyFromFirst(const [
                            CopyFromFirstField.collection,
                            CopyFromFirstField.tags,
                            CopyFromFirstField.location,
                          ]),
                  child: const Text('Copy collection + tags + location'),
                ),
                OutlinedButton(
                  onPressed: widget.disabled || widget.selectedCount == 0
                      ? null
                      : () => widget.onCopyFromFirst(const [
                            CopyFromFirstField.description,
                            CopyFromFirstField.copyright,
                          ]),
                  child: const Text('Copy description + copyright'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _dropdown({
    required String label,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return SizedBox(
      width: 200,
      child: DropdownButtonFormField<String>(
        value: value.isEmpty ? null : value,
        decoration: InputDecoration(labelText: label, isDense: true),
        items: items,
        onChanged: widget.disabled ? null : onChanged,
      ),
    );
  }

  void _apply() {
    final patch = BatchEditPatch(
      mergeTags: _tags.trim().isEmpty ? null : _tags.trim(),
      collectionSelect: _collection == _noChange
          ? null
          : (_collection == _clear ? selectNone : _collection),
      hidden: _hidden,
      cameraSelect: _camera == _noChange ? null : _camera,
      lensSelect: _lens == _noChange ? null : _lens,
      copyright: _copyrightMode == 'set'
          ? _copyright
          : (_copyrightMode == 'clear' ? '' : null),
      location: _locationMode == 'set'
          ? _location
          : (_locationMode == 'clear' ? '' : null),
      captureDate: _captureDateMode == 'set'
          ? (_captureDate.isEmpty ? null : _captureDate)
          : (_captureDateMode == 'clear' ? '' : null),
    );
    widget.onApply(patch);
    setState(() {
      _tags = '';
      _collection = _noChange;
      _hidden = null;
      _camera = _noChange;
      _lens = _noChange;
      _copyright = '';
      _copyrightMode = 'no_change';
      _captureDateMode = 'no_change';
      _captureDate = '';
    });
  }

  Future<void> _pickCaptureDate() async {
    final initial = _parseCaptureDate(_captureDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: DateTime(2100),
    );
    if (picked == null || !mounted) return;
    setState(() => _captureDate = _formatCaptureDate(picked));
  }

  DateTime? _parseCaptureDate(String raw) {
    final parts = raw.split('-');
    if (parts.length != 3) return null;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }

  String _formatCaptureDate(DateTime date) {
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }
}
