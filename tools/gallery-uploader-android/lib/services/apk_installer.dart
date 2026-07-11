import 'dart:io';

import 'package:flutter/services.dart';

class ApkInstaller {
  static const _channel = MethodChannel('com.reignoftea.gallery_uploader/apk_install');

  /// Device-preferred ABIs (best first), from Android [Build.SUPPORTED_ABIS].
  static Future<List<String>> preferredAbis() async {
    if (!Platform.isAndroid) return const [];
    final raw = await _channel.invokeMethod<List<dynamic>>('preferredAbis');
    if (raw == null) return const [];
    return raw.map((e) => e.toString()).toList();
  }

  static Future<void> install(String filePath) async {
    if (!Platform.isAndroid) {
      throw UnsupportedError('In-app APK install is only supported on Android.');
    }
    await _channel.invokeMethod<void>('install', {'path': filePath});
  }
}
