# Galleree upload (desktop)

Tauri + React + TypeScript + Vite. Bulk-add photos to a git checkout of the site repo (`public/gallery/`), then commit and push.

**Android tablet app:** [`gallery-uploader-android/`](../gallery-uploader-android/) — Flutter + Material You, same gallery workflow without a desktop. APK prereleases: `.github/workflows/gallery-uploader-android-release.yml`.

On upload, the app writes each image, `meta/{id}.json`, and local `thumbs/{id}.jpg` (for preview). Git tracks **originals and meta only**—not `thumbs/` or `display/` (CI regenerates those on deploy). Before commit/push, publish runs `npm run generate-assets` in the gallery project so sidecars get `blurHash` and `exifDisplay` matching site CI (`check-gallery-assets`). **Node.js** and `npm install` in the project folder are required once for that step.

Gallery folder layout, sidecar fields, and equipment registries are documented in the [repository README](../../README.md#gallery-layout).

Derivative sizes (720px preview thumb, multi-width thumbs, display WebP) are defined in [`schemas/gallery-asset-spec.json`](../../schemas/gallery-asset-spec.json). The uploader writes a local 720px JPEG for UI preview only; CI runs `npm run build` for the full set.

**Features:** add files or whole folders (recursive), batch-edit tags/collection/hidden, optional update notice from `uploader-version.json` on your repo branch.

## GitHub personal access token (clone & push)

The uploader uses Git over HTTPS with a token instead of a password. Create the token on GitHub, then paste it in the app’s first-time setup (or **Edit settings**). The token is stored in the **OS credential store** (e.g. Windows Credential Manager), not in `config.json`.

### Open the right page

1. On GitHub.com, click your **profile picture** (top right) → **Settings**.
2. In the left sidebar, scroll to **Developer settings** (near the bottom).
3. Under **Personal access tokens**, pick one:
   - **Fine-grained tokens** — [Create a fine-grained token](https://github.com/settings/personal-access-tokens/new)
   - **Tokens (classic)** — [Create a classic token](https://github.com/settings/tokens/new)

If you do not see **Developer settings**, you might be in an organization’s settings instead of your **user** settings—open your personal profile’s **Settings**, or ask an org admin if your company blocks personal tokens.

### What to enable

**Classic token (simplest)**

- Under **Select scopes**, enable **`repo`** (full control of private repositories). That is enough for clone, pull, and push on normal HTTPS URLs.

**Fine-grained token**

- **Resource owner:** your user (or the org that owns the repo).
- **Repository access:** only the site repo you upload to (or “All repositories” if you accept that).
- **Repository permissions → Contents:** **Read and write** (required for `git push`).
- **Metadata:** read-only is usually selected by default.

Generate the token, then **copy it immediately** (GitHub will not show it again). In the app, use an HTTPS repo URL such as `https://github.com/OWNER/REPO.git`.

## GitHub release

Workflow: `.github/workflows/gallery-uploader-release.yml`.

- **Every push to `main` or `master`** that changes `tools/gallery-uploader/**` builds the Windows app and publishes a **prerelease** on GitHub (tag like `gallery-uploader-v0.1.0-r42`, using `version` from `src-tauri/tauri.conf.json` plus the workflow run number).
- **Stable release:** use a `gallery-uploader-v*` tag (see below). The app reads `uploader-version.json` on your gallery branch for update notices (`version` must match what you ship in the installer).

**Local publish script** (not in git; copy from your machine’s `local-scripts/`):

```powershell
.\local-scripts\publish-uploader.ps1              # patch bump, commit, push (prerelease CI)
.\local-scripts\publish-uploader.ps1 -Stable      # also tag gallery-uploader-vX.Y.Z (stable release)
.\local-scripts\publish-uploader.ps1 -Minor -Notes "Batch edit and duplicate detection"
.\local-scripts\publish-uploader.ps1 -DryRun -Patch   # bump files only, no git
```

The script bumps `src-tauri/tauri.conf.json`, `Cargo.toml`, `package.json`, and `uploader-version.json`, then commits `tools/gallery-uploader/`.

If uploads fail with “Resource not accessible”, set **Settings → Actions → General → Workflow permissions** to **Read and write**.
