# Galleree Upload (Android)

Tablet-first Flutter uploader for the Galleree photography site. Runs on **Android** and **Windows** (for local development on a PC).

## Run

```bash
cd tools/gallery-uploader-android
flutter pub get

# Windows (development on PC)
flutter run -d windows
```

On **Windows**, the GitHub PAT is stored in app preferences (suitable for local dev). On **Android**, it uses EncryptedSharedPreferences.

```bash
# Android tablet / phone
flutter run -d android
```

## Gallery project layout

The app clones your site repo into app-private storage and writes:

```
public/gallery/
  {id}.jpg              # original (tracked in git)
  meta/{id}.json        # sidecar (tracked)
  thumbs/{id}.jpg       # 720px preview (gitignored; CI regenerates)
```

During staging the app writes **contentHash**, **blurHash**, and **exifDisplay** into each sidecar in Dart (no Node/npm). Site CI still runs `npm run generate-assets` for display WebP and the full thumb set; `check-gallery-assets` allows blurHash/exifDisplay drift so CI can normalize those fields before deploy.

## Publish modes

| Mode | Behaviour |
|------|-----------|
| Standard | Download latest, then push commit |
| Skip pull | Push local copy without downloading first |
| Force with lease | Push even if remote moved (with lease check) |

## Related

- Desktop uploader: `tools/gallery-uploader/`
- **Roadmap / gaps:** [TODO.md](TODO.md)
- Gallery schemas: `schemas/`

## GitHub release

Workflow: `.github/workflows/gallery-uploader-android-release.yml`.

- **Every push to `main` or `master`** that changes `tools/gallery-uploader-android/**` builds a release APK and publishes a **prerelease** (tag like `gallery-uploader-android-v1.0.0-r42`, using `version` from `pubspec.yaml` plus the workflow run number).
- **Stable release:** push tag `gallery-uploader-android-v*` (e.g. `gallery-uploader-android-v1.0.2`). Bump together before tagging:
  - `pubspec.yaml` (`version:` line, e.g. `1.0.2+3`)
  - `lib/app_version.dart` (`kAppVersion`)
  - `android-uploader-version.json` (`version` — used for in-app update notices)

The APK is signed with the committed upload keystore (`android/app/upload.keystore`, see `android/signing.properties`). CI uses the same key and sets `versionCode` from the GitHub Actions run number so each build installs over the previous one.

**Updating:** if Android says *App not installed*, the device still has an APK signed with an old key (previous CI debug builds or a local debug build). Uninstall the old app, then install the new APK.

Update notices read `tools/gallery-uploader-android/android-uploader-version.json` on your gallery branch — not the desktop `tools/gallery-uploader/uploader-version.json`. On Android, tap **Install update** in the banner to download the correct per-ABI `galleree-upload-android-*-{abi}.apk` from GitHub Releases (arm64-v8a for most devices) and open the system installer.
