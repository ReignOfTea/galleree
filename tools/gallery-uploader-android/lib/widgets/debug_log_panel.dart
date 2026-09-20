import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/debug_log.dart';

class DebugLogPanel extends ConsumerStatefulWidget {
  const DebugLogPanel({super.key});

  @override
  ConsumerState<DebugLogPanel> createState() => _DebugLogPanelState();
}

class _DebugLogPanelState extends ConsumerState<DebugLogPanel> {
  final _scroll = ScrollController();
  int _lastCount = 0;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  @override
  Widget build(BuildContext context) {
    final log = ref.watch(debugLogProvider);
    if (log.visible && log.entries.length != _lastCount) {
      _lastCount = log.entries.length;
      _scrollToEnd();
    }

    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerHigh,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
            child: Row(
              children: [
                Icon(Icons.bug_report_outlined, size: 18, color: scheme.onSurfaceVariant),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Debug log',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
                if (log.visible) ...[
                  TextButton(
                    onPressed: log.entries.isEmpty
                        ? null
                        : () => Clipboard.setData(ClipboardData(text: log.asText)),
                    child: const Text('Copy'),
                  ),
                  TextButton(
                    onPressed: log.entries.isEmpty
                        ? null
                        : () => ref.read(debugLogProvider.notifier).clear(),
                    child: const Text('Clear'),
                  ),
                ],
                Switch.adaptive(
                  value: log.visible,
                  onChanged: (v) => ref.read(debugLogProvider.notifier).setVisible(v),
                ),
              ],
            ),
          ),
          if (log.visible)
            SizedBox(
              height: 180,
              child: log.entries.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Text(
                        'No debug events yet. Toggle stays on so Upload & publish steps appear here.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            ),
                      ),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      itemCount: log.entries.length,
                      itemBuilder: (context, index) {
                        final entry = log.entries[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: SelectableText(
                            entry.line,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontFamily: 'Consolas',
                                  fontFamilyFallback: const ['monospace'],
                                ),
                          ),
                        );
                      },
                    ),
            ),
        ],
      ),
    );
  }
}
