import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/providers/app_controller.dart';
import 'package:gallery_uploader_android/models/models.dart';
import 'package:gallery_uploader_android/services/debug_log.dart';
import 'package:gallery_uploader_android/services/github_gallery_service.dart';

void main() {
  test('DebugLogController appends, caps, and clears', () {
    final log = DebugLogController();
    for (var i = 0; i < DebugLogController.maxEntries + 5; i++) {
      log.add('line $i');
    }
    expect(log.state.entries.length, DebugLogController.maxEntries);
    expect(log.state.entries.first.message, 'line 5');
    expect(log.state.asText, contains('line ${DebugLogController.maxEntries + 4}'));

    log.clear();
    expect(log.state.entries, isEmpty);
    log.setVisible(true);
    expect(log.state.visible, isTrue);
  });

  test('formatGitHubApiError prefers message field', () {
    expect(
      formatGitHubApiError(401, '{"message":"Bad credentials"}'),
      'GitHub API 401: Bad credentials',
    );
    expect(formatGitHubApiError(500, ''), 'GitHub API 500');
  });

  test('publishBlockingErrors lists photos that cannot be published', () {
    final state = AppState(
      rows: [
        UploadRow(
          id: '1',
          sourcePath: r'D:\photos\one.jpg',
          title: '',
          destId: 'a1b2c3d4e5f6478990a1b2c3d4e5f678',
          destFilename: 'a1b2c3d4e5f6478990a1b2c3d4e5f678.jpg',
        ),
      ],
    );
    expect(state.publishBlockingErrors, isNotEmpty);
    expect(state.publishBlockingErrors.first, contains('title'));
  });
}
