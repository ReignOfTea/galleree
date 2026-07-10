import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;

import '../models/gallery_meta.dart';
import '../models/models.dart';
import 'app_storage.dart';
import 'operation_cancel.dart';

export 'github_gallery_io.dart' show findGitHubArchiveRootPrefix;

class GitHubGalleryService {
  GitHubGalleryService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Map<String, String> _headers(String pat) => {
        'Authorization': 'Bearer $pat',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Galleree-Upload-Android',
      };

  Future<void> ensureRepoReady({
    required String pat,
    required AppConfig config,
    void Function(String message)? onProgress,
    OperationCancelToken? cancel,
  }) async {
    final paths = GalleryPaths(config.workdir);
    final galleryOk = Directory(paths.galleryDir).existsSync();
    if (!galleryOk) {
      onProgress?.call('Downloading gallery project…');
      await _syncPublicFolder(pat: pat, config: config, onProgress: onProgress, cancel: cancel);
    }
    paths.ensureGalleryDirs();
    if (!File(paths.siteJson).existsSync()) {
      onProgress?.call('Downloading gallery project…');
      await _syncPublicFolder(pat: pat, config: config, onProgress: onProgress, cancel: cancel);
    }
  }

  Future<void> syncLatest({
    required String pat,
    required AppConfig config,
    void Function(String message)? onProgress,
    OperationCancelToken? cancel,
  }) async {
    onProgress?.call('Downloading latest from GitHub…');
    await _syncPublicFolder(
      pat: pat,
      config: config,
      mergeGallery: true,
      onProgress: onProgress,
      cancel: cancel,
    );
  }

  Future<void> publish({
    required String pat,
    required AppConfig config,
    required String message,
    required PublishMode mode,
    required List<String> stagedRepoPaths,
    void Function(String progress)? onProgress,
    OperationCancelToken? cancel,
  }) async {
    final (owner, repo) = parseGitHubRepo(config.repoUrl);
    final branch = config.branch;
    final paths = GalleryPaths(config.workdir);
    paths.ensureGalleryDirs();

    if (mode == PublishMode.standard) {
      await syncLatest(pat: pat, config: config, onProgress: onProgress, cancel: cancel);
    }

    cancel?.throwIfCanceled();
    onProgress?.call('Reading branch…');
    final ref = await _getRef(owner, repo, branch, pat);
    final baseCommit = ref['object']?['sha'] as String?;
    if (baseCommit == null) throw StateError('Could not read branch $branch');

    final commitMeta = await _getJson(
      'https://api.github.com/repos/$owner/$repo/git/commits/$baseCommit',
      pat,
    );
    final baseTreeSha = commitMeta['tree']?['sha'] as String?;
    if (baseTreeSha == null) throw StateError('Could not read commit tree');

    onProgress?.call('Building commit…');
    final treeEntries = <Map<String, dynamic>>[];

    final repoPaths = stagedRepoPaths.toSet();
    if (repoPaths.isEmpty) throw StateError('Nothing to publish');

    for (final repoPath in repoPaths) {
      cancel?.throwIfCanceled();
      final absolutePath = p.join(paths.workdirRoot, repoPath.replaceAll('/', p.separator));
      if (!File(absolutePath).existsSync()) continue;
      await _addFileToTree(
        owner: owner,
        repo: repo,
        pat: pat,
        absolutePath: absolutePath,
        repoPath: repoPath.replaceAll(p.separator, '/'),
        treeEntries: treeEntries,
      );
    }

    if (treeEntries.isEmpty) throw StateError('Nothing to publish');

    final treeResp = await _postJson(
      'https://api.github.com/repos/$owner/$repo/git/trees',
      pat,
      {'base_tree': baseTreeSha, 'tree': treeEntries},
    );
    final treeSha = treeResp['sha'] as String;

    final commitResp = await _postJson(
      'https://api.github.com/repos/$owner/$repo/git/commits',
      pat,
      {
        'message': message.trim().isEmpty ? 'Add photos' : message.trim(),
        'tree': treeSha,
        'parents': [baseCommit],
      },
    );
    final newCommit = commitResp['sha'] as String;

    onProgress?.call('Pushing to GitHub…');
    final updateUrl = 'https://api.github.com/repos/$owner/$repo/git/refs/heads/$branch';
    final force = mode == PublishMode.forceWithLease;
    if (force) {
      await _patchJson(updateUrl, pat, {
        'sha': newCommit,
        'force': true,
      });
    } else {
      await _patchJson(updateUrl, pat, {'sha': newCommit});
    }
  }

  /// Download tracked metadata under `public/**` via the Git Trees API.
  /// Gallery originals (`public/gallery/{id}.ext`) are skipped — only sidecars,
  /// registries, equipment icons, and site config are synced locally.
  Future<void> _syncPublicFolder({
    required String pat,
    required AppConfig config,
    bool mergeGallery = false,
    void Function(String message)? onProgress,
    OperationCancelToken? cancel,
  }) async {
    final (owner, repo) = parseGitHubRepo(config.repoUrl);
    final branch = config.branch;

    onProgress?.call('Reading repository tree…');
    final ref = await _getRef(owner, repo, branch, pat);
    final commitSha = ref['object']?['sha'] as String?;
    if (commitSha == null) throw StateError('Could not read branch $branch');

    final commitMeta = await _getJson(
      'https://api.github.com/repos/$owner/$repo/git/commits/$commitSha',
      pat,
    );
    final treeSha = commitMeta['tree']?['sha'] as String?;
    if (treeSha == null) throw StateError('Could not read commit tree');

    final tree = await _getJson(
      'https://api.github.com/repos/$owner/$repo/git/trees/$treeSha?recursive=1',
      pat,
    );
    final entries = (tree['tree'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .where(_shouldSyncPublicPath)
        .toList();

    if (entries.isEmpty) {
      throw StateError(
        'Repository has no public/ folder. Check the URL and branch ($branch).',
      );
    }

    if (!mergeGallery) {
      final publicDir = Directory(p.join(config.workdir, 'public'));
      if (publicDir.existsSync()) {
        await publicDir.delete(recursive: true);
      }
    }

    final total = entries.length;
    for (var i = 0; i < total; i++) {
      cancel?.throwIfCanceled();
      final entry = entries[i];
      final repoPath = entry['path'] as String;
      final outPath = p.join(config.workdir, repoPath.replaceAll('/', p.separator));
      if (mergeGallery && File(outPath).existsSync()) continue;

      if (i == 0 || (i + 1) % 5 == 0 || i + 1 == total) {
        onProgress?.call('Downloading ${i + 1} of $total…');
      }

      final blobSha = entry['sha'] as String?;
      if (blobSha == null) continue;

      final blob = await _getJson(
        'https://api.github.com/repos/$owner/$repo/git/blobs/$blobSha',
        pat,
      );
      final encoding = blob['encoding'] as String? ?? 'base64';
      if (encoding != 'base64') {
        throw StateError('Unsupported blob encoding: $encoding');
      }
      final content = blob['content'] as String?;
      if (content == null) continue;

      Directory(p.dirname(outPath)).createSync(recursive: true);
      await File(outPath).writeAsBytes(base64Decode(content.replaceAll('\n', '')));

      if ((i + 1) % 10 == 0) {
        await Future<void>.delayed(const Duration(milliseconds: 16));
      }
    }
  }

  bool _shouldSyncPublicPath(Map<String, dynamic> entry) {
    if (entry['type'] != 'blob') return false;
    final path = entry['path'] as String? ?? '';
    if (!path.startsWith('public/')) return false;
    if (path.contains('public/gallery/thumbs/')) return false;
    if (path.contains('public/gallery/display/')) return false;
    if (_isGalleryOriginalPath(path)) return false;
    return true;
  }

  bool _isGalleryOriginalPath(String path) {
    const prefix = 'public/gallery/';
    if (!path.startsWith(prefix)) return false;
    final relative = path.substring(prefix.length);
    if (relative.contains('/')) return false;
    final id = p.basenameWithoutExtension(relative);
    return isValidGalleryImageId(id);
  }

  Future<void> _addFileToTree({
    required String owner,
    required String repo,
    required String pat,
    required String absolutePath,
    required String repoPath,
    required List<Map<String, dynamic>> treeEntries,
  }) async {
    final bytes = await File(absolutePath).readAsBytes();
    final blob = await _postJson(
      'https://api.github.com/repos/$owner/$repo/git/blobs',
      pat,
      {
        'content': base64Encode(bytes),
        'encoding': 'base64',
      },
    );
    treeEntries.add({
      'path': repoPath,
      'mode': '100644',
      'type': 'blob',
      'sha': blob['sha'],
    });
  }

  Future<Map<String, dynamic>> _getRef(
    String owner,
    String repo,
    String branch,
    String pat,
  ) async {
    final url = 'https://api.github.com/repos/$owner/$repo/git/ref/heads/$branch';
    final resp = await _client.get(Uri.parse(url), headers: _headers(pat));
    if (resp.statusCode == 404) {
      throw StateError('Branch "$branch" not found on GitHub');
    }
    if (resp.statusCode >= 400) {
      throw StateError('GitHub API ${resp.statusCode}: ${resp.body}');
    }
    return jsonDecode(resp.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _getJson(String url, String pat) async {
    final resp = await _client.get(Uri.parse(url), headers: _headers(pat));
    if (resp.statusCode >= 400) {
      throw StateError('GitHub API ${resp.statusCode}: ${resp.body}');
    }
    return jsonDecode(resp.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _postJson(String url, String pat, Map<String, dynamic> body) async {
    final resp = await _client.post(
      Uri.parse(url),
      headers: {..._headers(pat), 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (resp.statusCode >= 400) {
      throw StateError('GitHub API ${resp.statusCode}: ${resp.body}');
    }
    return jsonDecode(resp.body) as Map<String, dynamic>;
  }

  Future<void> _patchJson(String url, String pat, Map<String, dynamic> body) async {
    final resp = await _client.patch(
      Uri.parse(url),
      headers: {..._headers(pat), 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (resp.statusCode >= 400) {
      throw StateError('GitHub API ${resp.statusCode}: ${resp.body}');
    }
  }
}
