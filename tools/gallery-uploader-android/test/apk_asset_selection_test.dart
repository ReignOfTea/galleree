import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/utils/apk_asset_selection.dart';

void main() {
  const assets = [
    ApkReleaseAsset(
      name: 'galleree-upload-android-v1.0.3-r42-arm64-v8a.apk',
      url: 'https://example.test/arm64.apk',
    ),
    ApkReleaseAsset(
      name: 'galleree-upload-android-v1.0.3-r42-armeabi-v7a.apk',
      url: 'https://example.test/v7a.apk',
    ),
    ApkReleaseAsset(
      name: 'galleree-upload-android-v1.0.3-r42-x86_64.apk',
      url: 'https://example.test/x86_64.apk',
    ),
  ];

  test('pickApkAssetUrl prefers arm64 on arm64 devices', () {
    expect(
      pickApkAssetUrl(assets, preferredAbis: ['arm64-v8a', 'armeabi-v7a']),
      'https://example.test/arm64.apk',
    );
  });

  test('pickApkAssetUrl prefers armeabi-v7a when arm64 split missing', () {
    expect(
      pickApkAssetUrl(
        [assets[1], assets[2]],
        preferredAbis: ['arm64-v8a', 'armeabi-v7a'],
      ),
      'https://example.test/v7a.apk',
    );
  });

  test('pickApkAssetUrl falls back to universal fat apk', () {
    const universal = [
      ApkReleaseAsset(
        name: 'galleree-upload-android-v1.0.2-r99.apk',
        url: 'https://example.test/universal.apk',
      ),
    ];
    expect(
      pickApkAssetUrl(universal, preferredAbis: ['arm64-v8a']),
      'https://example.test/universal.apk',
    );
  });

  test('pickApkAssetUrl prefers universal over wrong split when abi unknown', () {
    const mixed = [
      ...assets,
      const ApkReleaseAsset(
        name: 'galleree-upload-android-v1.0.2.apk',
        url: 'https://example.test/universal.apk',
      ),
    ];
    expect(
      pickApkAssetUrl(mixed, preferredAbis: const []),
      'https://example.test/universal.apk',
    );
  });

  test('normalizeApkAbi maps common aliases', () {
    expect(normalizeApkAbi('ARM64'), 'arm64-v8a');
    expect(normalizeApkAbi('aarch64'), 'arm64-v8a');
  });
}
