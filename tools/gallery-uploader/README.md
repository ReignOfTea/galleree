# Galleree upload (desktop)

Tauri + React + TypeScript + Vite. Bulk-add photos to a git checkout of the site repo (`public/gallery/`), then commit and push.

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

- **Every push to `main` or `master`** that changes `tools/gallery-uploader/**` builds all platforms and publishes a **prerelease** on GitHub (tag like `gallery-uploader-v0.1.0-r42`, using `version` from `src-tauri/tauri.conf.json` plus the workflow run number).
- **Stable release:** bump `version` in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, commit, then  
  `git tag gallery-uploader-v0.2.0 && git push origin gallery-uploader-v0.2.0`  
  (tag suffix should match the version you intend to ship.)

If uploads fail with “Resource not accessible”, set **Settings → Actions → General → Workflow permissions** to **Read and write**.
