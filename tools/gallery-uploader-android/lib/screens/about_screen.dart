import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app_version.dart';
import '../providers/app_controller.dart';

class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  static const releasesUrl = 'https://github.com/ReignOfTea/galleree/releases';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final platformLabel = Platform.isAndroid
        ? 'Android'
        : Platform.isWindows
            ? 'Windows'
            : Platform.operatingSystem;

    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        children: [
          Row(
            children: [
              Icon(Icons.photo_library_outlined, size: 40, color: scheme.primary),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Galleree Upload', style: textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'Tablet-first uploader for the Galleree photography site.',
                      style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _sectionTitle(context, 'App'),
          _infoTile(
            context,
            icon: Icons.tag_outlined,
            title: 'Version',
            subtitle: kAppVersionLabel,
          ),
          _infoTile(
            context,
            icon: Icons.devices_outlined,
            title: 'Platform',
            subtitle: platformLabel,
          ),
          if (state.pendingUpdate != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.system_update_alt, color: scheme.primary),
              title: Text('Update available: v${state.pendingUpdate!.latestVersion}'),
              subtitle: Text(state.pendingUpdate!.bannerMessage),
              trailing: Platform.isAndroid
                  ? FilledButton(
                      onPressed: state.busy
                          ? null
                          : () => ref.read(appControllerProvider.notifier).installAppUpdate(),
                      child: const Text('Install'),
                    )
                  : null,
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: state.busy || state.config == null
                ? null
                : () => ref.read(appControllerProvider.notifier).checkForAppUpdate(),
            icon: const Icon(Icons.refresh),
            label: const Text('Check for updates'),
          ),
          if (state.config != null) ...[
            const SizedBox(height: 24),
            _sectionTitle(context, 'Connected gallery'),
            _infoTile(
              context,
              icon: Icons.link_outlined,
              title: 'Repository',
              subtitle: state.config!.repoUrl,
              copyable: true,
            ),
            _infoTile(
              context,
              icon: Icons.account_tree_outlined,
              title: 'Branch',
              subtitle: state.config!.branch,
            ),
            _infoTile(
              context,
              icon: Icons.folder_outlined,
              title: 'Local work copy',
              subtitle: state.config!.workdir,
              copyable: true,
            ),
          ],
          const SizedBox(height: 24),
          _sectionTitle(context, 'Links'),
          _infoTile(
            context,
            icon: Icons.open_in_new,
            title: 'GitHub Releases',
            subtitle: releasesUrl,
            copyable: true,
          ),
          const SizedBox(height: 24),
          Text(
            '© Reign of Tea',
            style: textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium),
    );
  }

  Widget _infoTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    bool copyable = false,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: copyable
          ? IconButton(
              tooltip: 'Copy',
              icon: const Icon(Icons.copy_outlined, size: 20),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: subtitle));
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copied')),
                );
              },
            )
          : null,
    );
  }
}
