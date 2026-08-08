import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/app_storage.dart';
import 'onboarding_hint_card.dart';

class PublishPanel extends StatefulWidget {
  const PublishPanel({
    super.key,
    required this.commitMessage,
    required this.publishMode,
    required this.rowCount,
    required this.busy,
    required this.canCancel,
    required this.onCommitMessageChanged,
    required this.onPublishModeChanged,
    required this.onPublish,
    required this.onSync,
    required this.onCancel,
  });

  final String commitMessage;
  final PublishMode publishMode;
  final int rowCount;
  final bool busy;
  final bool canCancel;
  final ValueChanged<String> onCommitMessageChanged;
  final ValueChanged<PublishMode> onPublishModeChanged;
  final VoidCallback onPublish;
  final VoidCallback onSync;
  final VoidCallback onCancel;

  @override
  State<PublishPanel> createState() => _PublishPanelState();
}

class _PublishPanelState extends State<PublishPanel> {
  bool _showPublishHint = true;
  bool _showSidecarHint = true;
  late final TextEditingController _commitController;

  @override
  void initState() {
    super.initState();
    _commitController = TextEditingController(text: widget.commitMessage);
    _loadHints();
  }

  @override
  void didUpdateWidget(covariant PublishPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.commitMessage != oldWidget.commitMessage &&
        widget.commitMessage != _commitController.text) {
      _commitController.text = widget.commitMessage;
    }
  }

  @override
  void dispose() {
    _commitController.dispose();
    super.dispose();
  }

  Future<void> _loadHints() async {
    final storage = AppStorage();
    final publish = await storage.isOnboardingDismissed(AppStorage.onboardingPublishKey);
    final sidecar = await storage.isOnboardingDismissed(AppStorage.onboardingSidecarKey);
    if (!mounted) return;
    setState(() {
      _showPublishHint = !publish;
      _showSidecarHint = !sidecar;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Publish to GitHub', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          widget.rowCount == 0
              ? 'Add photos on the Upload tab, then return here to push them to your gallery repository.'
              : '${widget.rowCount} photo${widget.rowCount == 1 ? '' : 's'} in queue will be staged, then pushed to your gallery repository.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        if (_showPublishHint) ...[
          const SizedBox(height: 12),
          OnboardingHintCard(
            title: 'First publish',
            body:
                'Use “Sync gallery only” after setup to download your site copy. Standard publish pulls latest changes before pushing your photos.',
            storageKey: AppStorage.onboardingPublishKey,
            onDismissed: () => setState(() => _showPublishHint = false),
          ),
        ],
        if (_showSidecarHint) ...[
          const SizedBox(height: 8),
          OnboardingHintCard(
            title: 'Sidecar fields',
            body:
                'During staging the app writes contentHash, blurHash, and exifDisplay into each photo sidecar. Site CI still builds display WebP and the full thumb set before deploy.',
            storageKey: AppStorage.onboardingSidecarKey,
            onDismissed: () => setState(() => _showSidecarHint = false),
          ),
        ],
        const SizedBox(height: 20),
        TextFormField(
          controller: _commitController,
          onChanged: widget.onCommitMessageChanged,
          decoration: const InputDecoration(
            labelText: 'Commit message',
            hintText: 'Add photos',
          ),
          maxLines: 2,
        ),
        const SizedBox(height: 20),
        Text('Publish mode', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...PublishMode.values.map((mode) {
          return RadioListTile<PublishMode>(
            value: mode,
            groupValue: widget.publishMode,
            onChanged: widget.busy ? null : (v) => v != null ? widget.onPublishModeChanged(v) : null,
            title: Text(mode.label),
            subtitle: Text(mode.summary),
          );
        }),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            FilledButton.icon(
              onPressed: widget.busy || widget.rowCount == 0 ? null : widget.onPublish,
              icon: widget.busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.cloud_upload_outlined),
              label: const Text('Upload & publish'),
            ),
            OutlinedButton.icon(
              onPressed: widget.busy ? null : widget.onSync,
              icon: const Icon(Icons.cloud_download_outlined),
              label: const Text('Sync gallery only'),
            ),
            if (widget.busy && widget.canCancel)
              TextButton(onPressed: widget.onCancel, child: const Text('Cancel')),
          ],
        ),
      ],
    );
  }
}
