import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _channel = MethodChannel('com.reignoftea.gallery_uploader/secure_pat');
const _legacyPatKey = 'github_pat';
const _desktopPatKey = 'github_pat_secure';

/// Android: EncryptedSharedPreferences via platform channel.
/// Windows (dev): SharedPreferences in the app data directory.
class SecurePatStorage {
  static Future<String?> read() async {
    if (!kIsWeb && Platform.isAndroid) {
      final value = await _channel.invokeMethod<String>('read');
      if (value != null && value.isNotEmpty) return value;
    } else if (!kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final desktop = prefs.getString(_desktopPatKey);
      if (desktop != null && desktop.isNotEmpty) return desktop;
    }

    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_legacyPatKey);
  }

  static Future<void> write(String pat) async {
    final trimmed = pat.trim();
    if (trimmed.isEmpty) return;

    if (!kIsWeb && Platform.isAndroid) {
      await _channel.invokeMethod<void>('write', {'value': trimmed});
    } else if (!kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_desktopPatKey, trimmed);
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_legacyPatKey);
  }

  static Future<void> clear() async {
    if (!kIsWeb && Platform.isAndroid) {
      await _channel.invokeMethod<void>('delete');
    } else if (!kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_desktopPatKey);
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_legacyPatKey);
  }
}
