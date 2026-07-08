import 'package:flutter/material.dart';

import '../models/models.dart';

class RegistryListsPanel extends StatelessWidget {
  const RegistryListsPanel({
    super.key,
    required this.registries,
    required this.onNew,
    required this.onEdit,
  });

  final GalleryRegistries registries;
  final void Function(RegistryKind kind) onNew;
  final void Function(RegistryKind kind, String slug) onEdit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Registries', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'Collections, cameras, and lenses used in photo metadata.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 20),
        _section(
          context,
          title: 'Collections',
          onNew: () => onNew(RegistryKind.collection),
          children: registries.collections
              .map((c) => _tile(context, c.title, c.slug, () => onEdit(RegistryKind.collection, c.slug)))
              .toList(),
        ),
        _section(
          context,
          title: 'Cameras',
          onNew: () => onNew(RegistryKind.camera),
          children: registries.cameras
              .map((c) => _tile(context, c.name, c.slug, () => onEdit(RegistryKind.camera, c.slug)))
              .toList(),
        ),
        _section(
          context,
          title: 'Lenses',
          onNew: () => onNew(RegistryKind.lens),
          children: registries.lenses
              .map((l) => _tile(context, l.name, l.slug, () => onEdit(RegistryKind.lens, l.slug)))
              .toList(),
        ),
      ],
    );
  }

  Widget _section(
    BuildContext context, {
    required String title,
    required VoidCallback onNew,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const Spacer(),
            TextButton.icon(
              onPressed: onNew,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('New'),
            ),
          ],
        ),
        if (children.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text('None yet.', style: Theme.of(context).textTheme.bodySmall),
          )
        else
          ...children,
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _tile(BuildContext context, String title, String slug, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(title),
        subtitle: Text(slug),
        trailing: const Icon(Icons.edit_outlined),
        onTap: onTap,
      ),
    );
  }
}
