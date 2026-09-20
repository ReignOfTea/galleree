import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_storage.dart';

class DebugLogEntry {
  const DebugLogEntry({required this.at, required this.message});

  final DateTime at;
  final String message;

  String get timeLabel {
    final h = at.hour.toString().padLeft(2, '0');
    final m = at.minute.toString().padLeft(2, '0');
    final s = at.second.toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  String get line => '$timeLabel  $message';
}

class DebugLogState {
  const DebugLogState({
    this.entries = const [],
    this.visible = false,
  });

  final List<DebugLogEntry> entries;
  final bool visible;

  String get asText => entries.map((e) => e.line).join('\n');
}

class DebugLogController extends StateNotifier<DebugLogState> {
  DebugLogController([this._storage]) : super(const DebugLogState()) {
    if (_storage != null) {
      unawaited(_restore());
    }
  }

  static const maxEntries = 250;

  final AppStorage? _storage;

  Future<void> _restore() async {
    final visible = await _storage!.loadDebugLogVisible();
    if (visible != state.visible) {
      state = DebugLogState(entries: state.entries, visible: visible);
    }
  }

  void add(String message) {
    final trimmed = message.trim();
    if (trimmed.isEmpty) return;
    debugPrint('[Galleree] $trimmed');
    final next = <DebugLogEntry>[
      ...state.entries,
      DebugLogEntry(at: DateTime.now(), message: trimmed),
    ];
    if (next.length > maxEntries) {
      next.removeRange(0, next.length - maxEntries);
    }
    state = DebugLogState(entries: next, visible: state.visible);
  }

  void clear() {
    state = DebugLogState(entries: const [], visible: state.visible);
  }

  void setVisible(bool visible) {
    if (visible == state.visible) return;
    state = DebugLogState(entries: state.entries, visible: visible);
    unawaited(_storage?.saveDebugLogVisible(visible));
  }

  void toggle() => setVisible(!state.visible);
}

final debugLogProvider = StateNotifierProvider<DebugLogController, DebugLogState>((ref) {
  return DebugLogController(AppStorage());
});
