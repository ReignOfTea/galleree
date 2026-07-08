import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PatScopeInfo extends StatelessWidget {
  const PatScopeInfo({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final body = Theme.of(context).textTheme.bodySmall?.copyWith(
          color: scheme.onSurfaceVariant,
          height: 1.45,
        );

    return Card(
      margin: EdgeInsets.zero,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        title: Text(
          'GitHub token scopes',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        subtitle: Text(
          'Required for clone, sync, and publish',
          style: body,
        ),
        children: [
          Text(
            'Create a personal access token on GitHub (Settings → Developer settings → Personal access tokens).',
            style: body,
          ),
          const SizedBox(height: 12),
          Text('Classic token', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 4),
          Text('Enable the repo scope (full control of private repositories).', style: body),
          const SizedBox(height: 12),
          Text('Fine-grained token', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 4),
          Text(
            'Repository access: only your gallery repo. Repository permissions → Contents: Read and write.',
            style: body,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => _copy(
                  context,
                  'https://github.com/settings/tokens/new',
                ),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('Classic token'),
              ),
              OutlinedButton.icon(
                onPressed: () => _copy(
                  context,
                  'https://github.com/settings/personal-access-tokens/new',
                ),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('Fine-grained token'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Copy the token once when GitHub shows it, then paste it here. It is stored in the device secure vault.',
            style: body,
          ),
        ],
      ),
    );
  }

  Future<void> _copy(BuildContext context, String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Copied link:\n$url')),
    );
  }
}
