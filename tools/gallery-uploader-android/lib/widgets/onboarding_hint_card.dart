import 'package:flutter/material.dart';

import '../services/app_storage.dart';

class OnboardingHintCard extends StatelessWidget {
  const OnboardingHintCard({
    super.key,
    required this.title,
    required this.body,
    required this.storageKey,
    required this.onDismissed,
  });

  final String title;
  final String body;
  final String storageKey;
  final VoidCallback onDismissed;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.45),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.lightbulb_outline, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Dismiss',
              onPressed: () async {
                await AppStorage().dismissOnboarding(storageKey);
                onDismissed();
              },
              icon: const Icon(Icons.close),
            ),
          ],
        ),
      ),
    );
  }
}

class UploadEmptyState extends StatelessWidget {
  const UploadEmptyState({
    super.key,
    required this.onAddPhotos,
    required this.onAddFolder,
    this.busy = false,
  });

  final VoidCallback onAddPhotos;
  final VoidCallback onAddFolder;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.photo_library_outlined, size: 56, color: scheme.outline),
              const SizedBox(height: 16),
              Text('No photos in the queue', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Add photos from your device, then fill in metadata and publish to GitHub.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 12,
                children: [
                  FilledButton.icon(
                    onPressed: busy ? null : onAddPhotos,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Add photos'),
                  ),
                  OutlinedButton.icon(
                    onPressed: busy ? null : onAddFolder,
                    icon: const Icon(Icons.folder_outlined),
                    label: const Text('Add folder'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
