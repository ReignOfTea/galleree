import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_controller.dart';
import '../widgets/git_connection_form.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _repoController;
  late final TextEditingController _branchController;
  final _patController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final config = ref.read(appControllerProvider).config;
    _repoController = TextEditingController(text: config?.repoUrl ?? '');
    _branchController = TextEditingController(text: config?.branch ?? 'master');
  }

  @override
  void dispose() {
    _repoController.dispose();
    _branchController.dispose();
    _patController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final ok = await ref.read(appControllerProvider.notifier).saveSetup(
          repoUrl: _repoController.text,
          branch: _branchController.text,
          pat: _patController.text,
          keepExistingPat: true,
        );
    if (!mounted || !ok) return;
    await Future<void>.delayed(const Duration(milliseconds: 16));
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final busy = ref.watch(appControllerProvider.select((s) => s.busy));
    final progress = ref.watch(appControllerProvider.select((s) => s.progress));
    final status = ref.watch(appControllerProvider.select((s) => s.status));
    final hasPat = ref.watch(appControllerProvider.select((s) => s.hasPat));
    final config = ref.watch(appControllerProvider.select((s) => s.config));
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Git settings')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (busy) const LinearProgressIndicator(minHeight: 3),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  'Gallery repository',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'Update the GitHub repo, branch, or personal access token used for sync and publish.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                ),
                if (config != null) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.folder_outlined),
                      title: const Text('Local work copy'),
                      subtitle: Text(
                        config.workdir,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                GitConnectionForm(
                  repoController: _repoController,
                  branchController: _branchController,
                  patController: _patController,
                  patOptional: hasPat,
                ),
                if (progress != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    progress,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: scheme.primary,
                        ),
                  ),
                ],
                if (status != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    status,
                    style: TextStyle(
                      color: busy ? scheme.onSurfaceVariant : scheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: busy ? null : _save,
                  icon: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: const Text('Save changes'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
