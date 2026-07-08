import 'dart:io';

import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/display_preview_service.dart';

Future<void> showDisplayPreviewDialog(
  BuildContext context, {
  required List<UploadRow> rows,
  int startIndex = 0,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) => DisplayPreviewDialog(rows: rows, startIndex: startIndex),
  );
}

class DisplayPreviewDialog extends StatefulWidget {
  const DisplayPreviewDialog({
    super.key,
    required this.rows,
    this.startIndex = 0,
  });

  final List<UploadRow> rows;
  final int startIndex;

  @override
  State<DisplayPreviewDialog> createState() => _DisplayPreviewDialogState();
}

class _DisplayPreviewDialogState extends State<DisplayPreviewDialog> {
  final _previewService = DisplayPreviewService();
  late int _index;
  String? _previewPath;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _index = widget.startIndex.clamp(0, widget.rows.length - 1);
    _load();
  }

  UploadRow get _row => widget.rows[_index];

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _previewPath = null;
    });
    try {
      final path = await _previewService.ensureDisplayPreview(_row.sourcePath);
      if (!mounted) return;
      setState(() => _previewPath = path);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _go(int delta) {
    final next = (_index + delta).clamp(0, widget.rows.length - 1);
    if (next == _index) return;
    setState(() => _index = next);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final title = _row.title.trim().isEmpty ? 'Untitled' : _row.title.trim();
    return Dialog(
      insetPadding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 960, maxHeight: 720),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: Theme.of(context).textTheme.titleLarge),
                        Text(
                          '${_index + 1} / ${widget.rows.length}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: _loading
                        ? const Padding(
                            padding: EdgeInsets.all(24),
                            child: CircularProgressIndicator(),
                          )
                        : _error != null
                            ? Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(_error!, textAlign: TextAlign.center),
                              )
                            : _previewPath == null
                                ? const SizedBox.shrink()
                                : InteractiveViewer(
                                    child: Image.file(
                                      File(_previewPath!),
                                      fit: BoxFit.contain,
                                    ),
                                  ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(
                    onPressed: _index <= 0 ? null : () => _go(-1),
                    child: const Text('Previous'),
                  ),
                  TextButton(
                    onPressed: _index >= widget.rows.length - 1 ? null : () => _go(1),
                    child: const Text('Next'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
