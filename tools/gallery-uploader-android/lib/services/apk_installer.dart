import 'dart:io';

import 'package:flutter/services.dart';

class ApkInstaller {
  static const _channel = MethodChannel('com.reignoftea.gallery_uploader/apk_install');

  static Future<void> install(String filePath) async {
    if (!Platform.isAndroid) {
      throw UnsupportedError('In-app APK install is only supported on Android.');
    }
    await _channel.invokeMethod<void>('install', {'path': filePath});
  }
}
