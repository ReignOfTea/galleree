import 'package:flutter/material.dart';

import '../models/models.dart';
import 'tags_input.dart';

class SessionDefaultsCard extends StatelessWidget {
  const SessionDefaultsCard({
    super.key,
    required this.defaults,
    required this.registries,
    required this.knownTags,
    required this.onChanged,
  });

  final SessionDefaults defaults;
  final GalleryRegistries registries;
  final List<String> knownTags;
  final ValueChanged<SessionDefaults> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Defaults for new photos', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'Applied when you add photos to the queue.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TagsInput(
            key: const ValueKey('defaults-tags'),
            label: 'Tags',
            value: defaults.tags,
            knownTags: knownTags,
            onChanged: (v) => onChanged(defaults.copyWith(tags: v)),
          ),
        ),
        _dropdown(
          context,
          'Collection',
          defaults.collectionSelect,
          [
            const DropdownMenuItem(value: selectNone, child: Text('No collection')),
            ...registries.collections.map(
              (c) => DropdownMenuItem(value: c.slug, child: Text(c.title)),
            ),
          ],
          (v) => onChanged(defaults.copyWith(collectionSelect: v ?? selectNone)),
        ),
        _text(context, 'Location', defaults.location, (v) => onChanged(defaults.copyWith(location: v))),
        _text(
          context,
          'Capture date',
          defaults.captureDate,
          (v) => onChanged(defaults.copyWith(captureDate: v)),
        ),
        _dropdown(
          context,
          'Camera',
          defaults.cameraSelect,
          [
            const DropdownMenuItem(value: selectNone, child: Text('None')),
            ...registries.cameras.map(
              (c) => DropdownMenuItem(value: c.slug, child: Text(c.name)),
            ),
          ],
          (v) => onChanged(defaults.copyWith(cameraSelect: v ?? selectNone)),
        ),
        _dropdown(
          context,
          'Lens',
          defaults.lensSelect,
          [
            const DropdownMenuItem(value: selectNone, child: Text('None')),
            ...registries.lenses.map(
              (l) => DropdownMenuItem(value: l.slug, child: Text(l.name)),
            ),
          ],
          (v) => onChanged(defaults.copyWith(lensSelect: v ?? selectNone)),
        ),
        _text(
          context,
          'Copyright',
          defaults.copyright,
          (v) => onChanged(defaults.copyWith(copyright: v)),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Hidden by default'),
          value: defaults.hidden,
          onChanged: (v) => onChanged(defaults.copyWith(hidden: v)),
        ),
      ],
    );
  }

  Widget _text(
    BuildContext context,
    String label,
    String value,
    ValueChanged<String> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        key: ValueKey('$label-$value'),
        initialValue: value,
        onChanged: onChanged,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }

  Widget _dropdown(
    BuildContext context,
    String label,
    String value,
    List<DropdownMenuItem<String>> items,
    ValueChanged<String?> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        value: value.isEmpty ? selectNone : value,
        decoration: InputDecoration(labelText: label),
        items: items,
        onChanged: onChanged,
      ),
    );
  }
}
