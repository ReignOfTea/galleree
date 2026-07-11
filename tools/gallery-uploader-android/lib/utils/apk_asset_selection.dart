/// APK release asset names use these suffixes before `.apk` (longest first).
const apkSplitAbiSuffixes = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'armeabi',
];

class ApkReleaseAsset {
  const ApkReleaseAsset({required this.name, required this.url});

  final String name;
  final String url;
}

String normalizeApkAbi(String abi) {
  final lower = abi.trim().toLowerCase();
  switch (lower) {
    case 'arm64':
    case 'aarch64':
      return 'arm64-v8a';
    case 'armeabi-v7a':
    case 'armeabi_v7a':
      return 'armeabi-v7a';
    default:
      return lower;
  }
}

bool apkAssetNameHasAbiSuffix(String name) {
  for (final suffix in apkSplitAbiSuffixes) {
    if (name.endsWith('-$suffix.apk')) return true;
  }
  return false;
}

bool _isGallereeUploadApk(String name) {
  return name.startsWith('galleree-upload-android-') && name.endsWith('.apk');
}

/// Picks the best APK for [preferredAbis] (device order, best match first).
/// Falls back to a universal (non-split) APK, then the first split.
String? pickApkAssetUrl(
  Iterable<ApkReleaseAsset> assets, {
  List<String> preferredAbis = const [],
}) {
  final apks = assets.where((a) => _isGallereeUploadApk(a.name)).toList();
  if (apks.isEmpty) return null;

  for (final abi in preferredAbis) {
    final normalized = normalizeApkAbi(abi);
    for (final apk in apks) {
      if (apk.name.endsWith('-$normalized.apk')) return apk.url;
    }
  }

  for (final apk in apks) {
    if (!apkAssetNameHasAbiSuffix(apk.name)) return apk.url;
  }

  return apks.first.url;
}
