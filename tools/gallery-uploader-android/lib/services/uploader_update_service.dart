import 'dart:convert';

import 'package:http/http.dart' as http;

import '../app_version.dart';
import '../models/models.dart';
import '../utils/app_semver.dart';
import 'app_storage.dart';

class UpdateCheckResult {
  const UpdateCheckResult({
    required this.currentVersion,
    required this.latestVersion,
    this.downloadUrl,
    this.notes,
    required this.updateAvailable,
  });

  final String currentVersion;
  final String latestVersion;
  final String? downloadUrl;
  final String? notes;
  final bool updateAvailable;

  String get noticeMessage {
    final url = downloadUrl ?? 'GitHub Releases (galleree-upload-android-*.apk)';
    return 'Android update available: v$latestVersion (you have v$currentVersion). Download from $url.';
  }
}

class UploaderUpdateService {
  UploaderUpdateService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

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

    final downloadUrl = value['downloadUrl'] as String?;
    final notes = value['notes'] as String?;
    final updateAvailable = isAppVersionOlder(currentVersion, latest);

    if (!updateAvailable) return null;

    return UpdateCheckResult(
      currentVersion: currentVersion,
      latestVersion: latest,
      downloadUrl: downloadUrl,
      notes: notes,
      updateAvailable: true,
    );
  }
}
