import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import 'secure_pat_storage.dart';

const _configKey = 'app_config';
const _defaultsKey = 'session_defaults';
const _commitMsgKey = 'commit_message';
const _queueViewKey = 'queue_view_mode';
const _onboardingPublishKey = 'onboarding_publish_dismissed';
const _onboardingSidecarKey = 'onboarding_sidecar_dismissed';

class AppStorage {
  Future<String?> readPat() async {
    final secure = await SecurePatStorage.read();
    if (secure != null && secure.isNotEmpty) return secure;
    return null;
  }

  Future<void> writePat(String pat) async {
    await SecurePatStorage.write(pat);
  }

  Future<void> clearPat() async {
    await SecurePatStorage.clear();
  }

  Future<AppConfig?> loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_configKey);
    if (raw == null) return null;
    return AppConfig.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<AppConfig> saveConfig({required String repoUrl, required String branch}) async {
    final workdir = await defaultWorkdirForRepo(repoUrl);
    final config = AppConfig(
      repoUrl: repoUrl.trim(),
      branch: branch.trim().isEmpty ? 'master' : branch.trim(),
      workdir: workdir,
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_configKey, jsonEncode(config.toJson()));
    return config;
  }

  Future<SessionDefaults> loadSessionDefaults() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_defaultsKey);
    if (raw == null) return SessionDefaults();
    final map = jsonDecode(raw) as Map<String, dynamic>;
    return SessionDefaults(
      tags: map['tags'] as String? ?? '',
      collectionSelect: map['collectionSelect'] as String? ?? '',
      hidden: map['hidden'] as bool? ?? false,
      cameraSelect: map['cameraSelect'] as String? ?? '',
      lensSelect: map['lensSelect'] as String? ?? '',
      copyright: map['copyright'] as String? ?? '',
      location: map['location'] as String? ?? '',
      captureDate: map['captureDate'] as String? ?? '',
    );
  }

  Future<void> saveSessionDefaults(SessionDefaults defaults) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _defaultsKey,
      jsonEncode({
        'tags': defaults.tags,
        'collectionSelect': defaults.collectionSelect,
        'hidden': defaults.hidden,
        'cameraSelect': defaults.cameraSelect,
        'lensSelect': defaults.lensSelect,
        'copyright': defaults.copyright,
        'location': defaults.location,
        'captureDate': defaults.captureDate,
      }),
    );
  }

  Future<String> loadCommitMessage() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_commitMsgKey) ?? '';
  }

  Future<void> saveCommitMessage(String message) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_commitMsgKey, message);
  }

  Future<QueueViewMode> loadQueueViewMode() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueViewKey);
    return raw == 'accordion' ? QueueViewMode.accordion : QueueViewMode.compact;
  }

  Future<void> saveQueueViewMode(QueueViewMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _queueViewKey,
      mode == QueueViewMode.accordion ? 'accordion' : 'compact',
    );
  }

  Future<bool> isOnboardingDismissed(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(key) ?? false;
  }

  Future<void> dismissOnboarding(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, true);
  }

  static const onboardingPublishKey = _onboardingPublishKey;
  static const onboardingSidecarKey = _onboardingSidecarKey;
}

Future<String> defaultWorkdirForRepo(String repoUrl) async {
  final docs = await getApplicationDocumentsDirectory();
  final hash = sha256.convert(utf8.encode(repoUrl.trim().toLowerCase())).toString();
  return p.join(docs.path, 'galleree-work-${hash.substring(0, 16)}');
}

class GalleryPaths {
  GalleryPaths(this.workdirRoot);

  final String workdirRoot;

  String get galleryDir => p.join(workdirRoot, 'public', 'gallery');
  String get metaDir => p.join(galleryDir, 'meta');
  String get thumbsDir => p.join(galleryDir, 'thumbs');
  String get collectionsDir => p.join(metaDir, 'collections');
  String get camerasDir => p.join(metaDir, 'cameras');
  String get lensesDir => p.join(metaDir, 'lenses');
  String get siteJson => p.join(workdirRoot, 'public', 'site.json');

  void ensureGalleryDirs() {
    for (final dir in [galleryDir, metaDir, thumbsDir, collectionsDir, camerasDir, lensesDir]) {
      Directory(dir).createSync(recursive: true);
    }
  }
}

(String owner, String repo) parseGitHubRepo(String repoUrl) {
  final uri = Uri.parse(repoUrl.trim());
  final parts = uri.path.split('/').where((s) => s.isNotEmpty).toList();
  if (parts.length < 2) {
    throw FormatException('Invalid GitHub repo URL: $repoUrl');
  }
  final owner = parts[0];
  var repo = parts[1];
  if (repo.endsWith('.git')) repo = repo.substring(0, repo.length - 4);
  return (owner, repo);
}
