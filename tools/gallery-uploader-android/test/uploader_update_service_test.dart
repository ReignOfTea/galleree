import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/services/uploader_update_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:gallery_uploader_android/models/models.dart';

void main() {
  test('check uses android-uploader-version.json and semver compare', () async {
    final client = MockClient((request) async {
      expect(
        request.url.path,
        '/ReignOfTea/galleree/main/tools/gallery-uploader-android/android-uploader-version.json',
      );
      return http.Response(
        jsonEncode({
          'version': '1.0.2',
          'downloadUrl': 'https://example.test/releases',
        }),
        200,
      );
    });

    final service = UploaderUpdateService(client: client);
    final result = await service.check(
      AppConfig(repoUrl: 'https://github.com/ReignOfTea/galleree', branch: 'main', workdir: '/tmp'),
      currentVersion: '1.0.1',
    );

    expect(result?.updateAvailable, isTrue);
    expect(result?.latestVersion, '1.0.2');
    expect(result?.noticeMessage, contains('Android update available'));
  });

  test('check returns null when current version is up to date', () async {
    final client = MockClient((request) async {
      return http.Response(jsonEncode({'version': '1.0.2'}), 200);
    });

    final service = UploaderUpdateService(client: client);
    final result = await service.check(
      AppConfig(repoUrl: 'https://github.com/ReignOfTea/galleree', branch: 'main', workdir: '/tmp'),
      currentVersion: '1.0.2',
    );

    expect(result, isNull);
  });
}
