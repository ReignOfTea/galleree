import 'dart:io';

import 'package:path/path.dart' as p;

/// Runs `npm run generate-assets` in the gallery repo before publish when Node is available.
/// Matches desktop `run_generate_assets_in_workdir` in gallery-uploader.
class GenerateAssetsService {
  Future<GenerateAssetsResult> runIfAvailable(
    String workdir, {
    void Function(String message)? onProgress,
  }) async {
    final root = Directory(workdir);
    final pkg = File(p.join(workdir, 'package.json'));
    final script = File(p.join(workdir, 'scripts', 'generate-gallery-assets.mjs'));
    if (!root.existsSync() || !pkg.existsSync() || !script.existsSync()) {
      return const GenerateAssetsResult.skippedUnavailable();
    }

    onProgress?.call('Updating blurHash and exifDisplay in photo sidecars…');

    final npm = _npmExecutable();
    final result = await Process.run(
      npm,
      ['run', 'generate-assets', '--silent'],
      workingDirectory: workdir,
      runInShell: Platform.isWindows,
    );

    if (result.exitCode == 0) {
      return const GenerateAssetsResult.ran();
    }

    final stderr = (result.stderr as String).trim();
    final stdout = (result.stdout as String).trim();
    final detail = stderr.isEmpty ? stdout : stderr;
    throw StateError(
      'generate-assets failed: ${detail.isEmpty ? "exit ${result.exitCode}" : detail}. '
      'Install Node.js and run npm install once in the gallery project folder.',
    );
  }

  String _npmExecutable() {
    if (Platform.isWindows) return 'npm.cmd';
    return 'npm';
  }
}

class GenerateAssetsResult {
  const GenerateAssetsResult._(this.ran, this.nodeAvailable);

  const GenerateAssetsResult.ran() : this._(true, true);
  const GenerateAssetsResult.skippedUnavailable() : this._(false, false);

  final bool ran;
  final bool nodeAvailable;
}
