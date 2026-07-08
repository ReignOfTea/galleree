package com.reignoftea.gallery_uploader_android

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

object SecurePatStorage {
    private const val CHANNEL = "com.reignoftea.gallery_uploader/secure_pat"
    private const val PREFS = "secure_pat_prefs"
    private const val KEY_PAT = "github_pat"

    fun register(engine: FlutterEngine, context: Context) {
        MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "read" -> result.success(read(context))
                    "write" -> {
                        write(context, call.argument<String>("value") ?: "")
                        result.success(null)
                    }
                    "delete" -> {
                        delete(context)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.error("secure_pat", e.message, null)
            }
        }
    }

    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        PREFS,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private fun read(context: Context): String? = prefs(context).getString(KEY_PAT, null)

    private fun write(context: Context, value: String) {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return
        prefs(context).edit().putString(KEY_PAT, trimmed).apply()
    }

    private fun delete(context: Context) {
        prefs(context).edit().remove(KEY_PAT).apply()
    }
}
