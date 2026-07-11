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
    expect(result?.bannerMessage, contains('Update available'));
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

  test('resolveLatestApkAssetUrl finds galleree-upload-android asset', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/repos/ReignOfTea/galleree/releases');
      return http.Response(
        jsonEncode([
          {
            'assets': [
              {
                'name': 'galleree-upload-android-v1.0.2-r99-arm64-v8a.apk',
                'browser_download_url': 'https://example.test/arm64.apk',
              },
              {
                'name': 'galleree-upload-android-v1.0.2-r99-armeabi-v7a.apk',
                'browser_download_url': 'https://example.test/v7a.apk',
              },
            ],
          },
        ]),
        200,
      );
    });

    final service = UploaderUpdateService(client: client);
    final url = await service.resolveLatestApkAssetUrl(
      'https://github.com/ReignOfTea/galleree',
      preferredAbis: ['arm64-v8a'],
    );
    expect(url, 'https://example.test/arm64.apk');
  });

  test('resolveLatestApkAssetUrl keeps legacy universal apk', () async {
    final client = MockClient((request) async {
      return http.Response(
        jsonEncode([
          {
            'assets': [
              {
                'name': 'galleree-upload-android-v1.0.2-r99.apk',
                'browser_download_url': 'https://example.test/app.apk',
              },
            ],
          },
        ]),
        200,
      );
    });

    final service = UploaderUpdateService(client: client);
    final url = await service.resolveLatestApkAssetUrl('https://github.com/ReignOfTea/galleree');
    expect(url, 'https://example.test/app.apk');
  });
}
