package com.reignoftea.gallery_uploader_android

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        SecurePatStorage.register(flutterEngine, this)
        ApkInstaller.register(flutterEngine, this)
    }
}
