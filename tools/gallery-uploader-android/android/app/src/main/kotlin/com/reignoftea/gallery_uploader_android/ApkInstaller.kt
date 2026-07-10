package com.reignoftea.gallery_uploader_android

import android.content.Intent
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

object ApkInstaller {
    private const val CHANNEL = "com.reignoftea.gallery_uploader/apk_install"

    fun register(engine: FlutterEngine, activity: FlutterActivity) {
        MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "install" -> {
                        val path = call.argument<String>("path")
                        if (path.isNullOrBlank()) {
                            result.error("invalid_path", "APK path is required", null)
                            return@setMethodCallHandler
                        }
                        installApk(activity, path)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.error("apk_install", e.message, null)
            }
        }
    }

    private fun installApk(activity: FlutterActivity, path: String) {
        val file = File(path)
        if (!file.isFile) {
            throw IllegalStateException("Update file not found")
        }
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            file,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }
}
