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

Site CI runs `npm run generate-assets` for blurHash, display WebP, and full thumb set. The app writes **blurHash** and **exifDisplay** in sidecars during staging when possible; CI may normalize them before deploy (`check-gallery-assets` allows drift on those fields).

Before publish, the app runs `npm run generate-assets` in the gallery workdir when `package.json` and Node.js are available (typical on **Windows** with a full repo clone and `npm install`). On Android without Node, **blurHash** and **exifDisplay** are written in-app during staging (`lib/utils/`). Site CI regenerates or normalizes those fields before deploy.

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
- **Stable release:** push tag `gallery-uploader-android-v*` (e.g. `gallery-uploader-android-v1.0.0`). Bump `pubspec.yaml` and `lib/app_version.dart` together before tagging.

The APK is debug-signed in CI (fine for sideloading on your own devices). PRs and feature branches are built by `gallery-uploader-android-ci.yml` (artifact only, no release).
