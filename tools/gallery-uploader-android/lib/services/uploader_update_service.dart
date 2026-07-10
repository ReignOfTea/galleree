import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../app_version.dart';
import '../models/models.dart';
import '../utils/app_semver.dart';
import 'apk_installer.dart';
import 'app_storage.dart';

class UpdateCheckResult {
  const UpdateCheckResult({
    required this.currentVersion,
    required this.latestVersion,
    this.apkUrl,
    this.downloadUrl,
    this.notes,
    required this.updateAvailable,
  });

  final String currentVersion;
  final String latestVersion;
  final String? apkUrl;
  final String? downloadUrl;
  final String? notes;
  final bool updateAvailable;

  String get bannerMessage {
    final notesSuffix = notes != null && notes!.trim().isNotEmpty ? ' ${notes!.trim()}' : '';
    return 'Update available: v$latestVersion (you have v$currentVersion).$notesSuffix';
  }
}

class UploaderUpdateService {
  UploaderUpdateService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const _githubHeaders = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Galleree-Upload-Android',
  };

  String rawAndroidVersionUrl(String repoUrl, String branch) {
    final (owner, repo) = parseGitHubRepo(repoUrl);
    return 'https://raw.githubusercontent.com/$owner/$repo/${branch.trim()}/tools/gallery-uploader-android/android-uploader-version.json';
  }

  Future<UpdateCheckResult?> check(
    AppConfig config, {
    String currentVersion = kAppVersion,
  }) async {
    final url = rawAndroidVersionUrl(config.repoUrl, config.branch);
    final resp = await _client.get(Uri.parse(url)).timeout(const Duration(seconds: 12));
    if (resp.statusCode != 200) return null;

    final value = jsonDecode(resp.body) as Map<String, dynamic>;
    final latest = value['version'] as String?;
    if (latest == null || latest.isEmpty) return null;

    final apkUrl = value['apkUrl'] as String?;
    final downloadUrl = value['downloadUrl'] as String?;
    final notes = value['notes'] as String?;
    final updateAvailable = isAppVersionOlder(currentVersion, latest);

    if (!updateAvailable) return null;

    return UpdateCheckResult(
      currentVersion: currentVersion,
      latestVersion: latest,
      apkUrl: apkUrl,
      downloadUrl: downloadUrl,
      notes: notes,
      updateAvailable: true,
    );
  }

  Future<String?> resolveApkDownloadUrl(
    String repoUrl, {
    String? apkUrl,
    String? downloadUrl,
  }) async {
    if (apkUrl != null && apkUrl.trim().isNotEmpty && apkUrl.endsWith('.apk')) {
      return apkUrl.trim();
    }
    if (downloadUrl != null && downloadUrl.endsWith('.apk')) {
      return downloadUrl.trim();
    }
    return resolveLatestApkAssetUrl(repoUrl);
  }

  Future<String?> resolveLatestApkAssetUrl(String repoUrl) async {
    final (owner, repo) = parseGitHubRepo(repoUrl);
    final uri = Uri.parse('https://api.github.com/repos/$owner/$repo/releases?per_page=30');
    final resp = await _client.get(uri, headers: _githubHeaders).timeout(const Duration(seconds: 15));
    if (resp.statusCode != 200) return null;

    final releases = jsonDecode(resp.body) as List<dynamic>;
    for (final release in releases.whereType<Map<String, dynamic>>()) {
      final assets = release['assets'] as List<dynamic>? ?? const [];
      for (final asset in assets.whereType<Map<String, dynamic>>()) {
        final name = asset['name'] as String? ?? '';
        if (!name.startsWith('galleree-upload-android-') || !name.endsWith('.apk')) continue;
        final url = asset['browser_download_url'] as String?;
        if (url != null && url.isNotEmpty) return url;
      }
    }
    return null;
  }

  Future<File> downloadApk(
    String url, {
    void Function(int receivedBytes, int? totalBytes)? onProgress,
  }) async {
    final request = http.Request('GET', Uri.parse(url));
    request.headers.addAll(_githubHeaders);
    final response = await _client.send(request).timeout(const Duration(minutes: 10));
    if (response.statusCode != 200) {
      throw StateError('Download failed (${response.statusCode}).');
    }

    final dir = await getTemporaryDirectory();
    final file = File(p.join(dir.path, 'galleree-upload-update.apk'));
    if (file.existsSync()) await file.delete();

    final sink = file.openWrite();
    var received = 0;
    final total = response.contentLength;
    try {
      await for (final chunk in response.stream) {
        received += chunk.length;
        sink.add(chunk);
        onProgress?.call(received, total);
      }
    } catch (e) {
      await sink.close();
      if (file.existsSync()) await file.delete();
      rethrow;
    }
    await sink.close();
    return file;
  }

  Future<void> downloadAndInstall({
    required String repoUrl,
    required UpdateCheckResult update,
    void Function(String message)? onProgress,
  }) async {
    if (!Platform.isAndroid) {
      throw UnsupportedError('In-app install is only available on Android.');
    }

    onProgress?.call('Finding APK…');
    final apkUrl = await resolveApkDownloadUrl(
      repoUrl,
      apkUrl: update.apkUrl,
      downloadUrl: update.downloadUrl,
    );
    if (apkUrl == null) {
      throw StateError('Could not find an Android APK on GitHub Releases.');
    }

    onProgress?.call('Downloading update…');
    final file = await downloadApk(
      apkUrl,
      onProgress: (received, total) {
        if (total != null && total > 0) {
          final pct = ((received / total) * 100).round();
          onProgress?.call('Downloading update… $pct%');
        }
      },
    );

    onProgress?.call('Opening installer…');
    await ApkInstaller.install(file.path);
  }
}
