import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../models/models.dart';
import '../utils/registry_slug.dart';

class RegistryCreateDialog extends StatefulWidget {
  const RegistryCreateDialog({
    super.key,
    required this.request,
    required this.registries,
    required this.coverCandidates,
    this.initialCollection,
    this.initialEquipment,
    required this.onSave,
  });

  final RegistryModalRequest request;
  final GalleryRegistries registries;
  final List<({String id, String label})> coverCandidates;
  final RegistryCollection? initialCollection;
  final RegistryEquipment? initialEquipment;
  final Future<void> Function(RegistrySaveInput input) onSave;

  @override
  State<RegistryCreateDialog> createState() => _RegistryCreateDialogState();
}

class RegistrySaveInput {
  const RegistrySaveInput({
    required this.kind,
    this.editSlug,
    required this.titleOrName,
    this.description = '',
    this.make = '',
    this.model = '',
    this.coverImageId,
    this.lensSlug,
    this.imagePath,
    this.rowId,
  });

  final RegistryKind kind;
  final String? editSlug;
  final String titleOrName;
  final String description;
  final String make;
  final String model;
  final String? coverImageId;
  final String? lensSlug;
  final String? imagePath;
  final String? rowId;
}

class _RegistryCreateDialogState extends State<RegistryCreateDialog> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _makeController = TextEditingController();
  final _modelController = TextEditingController();
  String _coverImageId = '';
  String _lensSlug = selectNone;
  String? _imagePath;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.request.kind == RegistryKind.collection && widget.initialCollection != null) {
      final c = widget.initialCollection!;
      _titleController.text = c.title;
      _descriptionController.text = c.description ?? '';
      _coverImageId = c.coverImageId ?? '';
    } else if (widget.initialEquipment != null) {
      final e = widget.initialEquipment!;
      _titleController.text = e.name;
      _makeController.text = e.make ?? '';
      _modelController.text = e.model ?? '';
      _lensSlug = e.lensSlug ?? selectNone;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _makeController.dispose();
    _modelController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final kind = widget.request.kind;
    final isEdit = widget.request.editSlug != null;
    final title = isEdit
        ? switch (kind) {
            RegistryKind.collection => 'Edit collection',
            RegistryKind.camera => 'Edit camera',
            RegistryKind.lens => 'Edit lens',
          }
        : switch (kind) {
            RegistryKind.collection => 'New collection',
            RegistryKind.camera => 'New camera',
            RegistryKind.lens => 'New lens',
          };

    return AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (kind == RegistryKind.collection) ...[
                TextField(
                  controller: _titleController,
                  decoration: const InputDecoration(labelText: 'Title'),
                  autofocus: true,
                ),
                const SizedBox(height: 8),
                if (isEdit)
                  Text('Slug: ${widget.request.editSlug}', style: Theme.of(context).textTheme.bodySmall)
                else if (collectionSlugFromTitle(_titleController.text) != null)
                  Text('Slug: ${collectionSlugFromTitle(_titleController.text)}',
                      style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 8),
                TextField(
                  controller: _descriptionController,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 3,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _coverImageId.isEmpty ? null : _coverImageId,
                  decoration: const InputDecoration(labelText: 'Cover photo (optional)'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('No cover')),
                    ...widget.coverCandidates.map(
                      (c) => DropdownMenuItem(value: c.id, child: Text(c.label)),
                    ),
                  ],
                  onChanged: (v) => setState(() => _coverImageId = v ?? ''),
                ),
              ] else ...[
                TextField(
                  controller: _titleController,
                  decoration: InputDecoration(
                    labelText: kind == RegistryKind.camera ? 'Camera name' : 'Lens name',
                  ),
                  autofocus: true,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _makeController,
                  decoration: const InputDecoration(labelText: 'Make (optional)'),
                ),
                TextField(
                  controller: _modelController,
                  decoration: const InputDecoration(labelText: 'Model (optional)'),
                ),
                TextField(
                  controller: _descriptionController,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 2,
                ),
                if (kind == RegistryKind.camera)
                  DropdownButtonFormField<String>(
                    value: _lensSlug.isEmpty ? selectNone : _lensSlug,
                    decoration: const InputDecoration(labelText: 'Default lens (optional)'),
                    items: [
                      const DropdownMenuItem(value: selectNone, child: Text('None')),
                      ...widget.registries.lenses.map(
                        (l) => DropdownMenuItem(value: l.slug, child: Text(l.name)),
                      ),
                    ],
                    onChanged: (v) => setState(() => _lensSlug = v ?? selectNone),
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: _busy ? null : _pickImage,
                      child: const Text('Product image…'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _imagePath?.split(RegExp(r'[/\\]')).last ?? 'No image selected',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'Saving…' : (isEdit ? 'Save changes' : 'Save')),
        ),
      ],
    );
  }

  Future<void> _pickImage() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.image);
    final path = result?.files.single.path;
    if (path != null) setState(() => _imagePath = path);
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onSave(RegistrySaveInput(
        kind: widget.request.kind,
        editSlug: widget.request.editSlug,
        titleOrName: _titleController.text,
        description: _descriptionController.text,
        make: _makeController.text,
        model: _modelController.text,
        coverImageId: _coverImageId.isEmpty ? null : _coverImageId,
        lensSlug: _lensSlug.isEmpty ? null : _lensSlug,
        imagePath: _imagePath,
        rowId: widget.request.rowId,
      ));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
