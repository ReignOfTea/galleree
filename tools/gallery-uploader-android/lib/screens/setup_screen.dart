import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_controller.dart';
import '../widgets/git_connection_form.dart';

class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  final _repoController = TextEditingController(text: 'https://github.com/');
  final _branchController = TextEditingController(text: 'master');
  final _patController = TextEditingController();

  @override
  void dispose() {
    _repoController.dispose();
    _branchController.dispose();
    _patController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                  Icon(Icons.photo_library_outlined, size: 48, color: scheme.primary),
                  const SizedBox(height: 12),
                  Text(
                    'Galleree Upload',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Connect your gallery site repository to start uploading from this tablet.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  GitConnectionForm(
                    repoController: _repoController,
                    branchController: _branchController,
                    patController: _patController,
                  ),
                  if (state.status != null) ...[
                    const SizedBox(height: 16),
                    Text(state.status!, style: TextStyle(color: scheme.error)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: state.busy
                        ? null
                        : () {
                            ref.read(appControllerProvider.notifier).saveSetup(
                                  repoUrl: _repoController.text,
                                  branch: _branchController.text,
                                  pat: _patController.text,
                                );
                          },
                    icon: state.busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.link),
                    label: const Text('Connect gallery project'),
                  ),
                ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
