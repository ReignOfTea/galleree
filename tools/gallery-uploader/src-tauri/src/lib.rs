#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use chrono::{Local, MappedLocalTime, NaiveDateTime};
use exif::{In, Reader as ExifReader, Tag};
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType as PngRowFilter, PngEncoder};
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ExtendedColorType, GenericImageView, ImageEncoder, ImageFormat};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{BufReader, Cursor, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{Emitter, Manager};
use url::Url;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadProgressPayload {
    message: String,
}

fn emit_upload_progress(app: &tauri::AppHandle, message: impl Into<String>) {
    let _ = app.emit(
        "upload-progress",
        UploadProgressPayload {
            message: message.into(),
        },
    );
}

const KEYRING_SERVICE: &str = "galleree-gallery-uploader";
const KEYRING_USER: &str = "github_https_pat";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub repo_url: String,
    pub branch: String,
    pub workdir: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHints {
    pub description: Option<String>,
    pub date_time_original_iso: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens_model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageItem {
    pub source_path: String,
    pub dest_filename: String,
    pub meta_json: Option<String>,
    /// When true, only writes meta/thumb; image must already exist at dest.
    #[serde(default)]
    pub skip_image_copy: bool,
    /// Remove a previous gallery original when replacing with a new extension.
    #[serde(default)]
    pub remove_dest_filename: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExifDisplayRow {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryPhotoEdit {
    pub id: String,
    pub dest_filename: String,
    pub image_path: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub location: Option<String>,
    pub captured_on: Option<String>,
    pub captured_at: Option<String>,
    pub collection_slug: Option<String>,
    pub camera: Option<String>,
    pub lens: Option<String>,
    pub alt: Option<String>,
    pub hidden: bool,
    pub sort_order: Option<f64>,
    pub copyright: Option<String>,
    pub uploaded_at: Option<String>,
    pub exif_display: Option<Vec<ExifDisplayRow>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryCollection {
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub cover_image_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryEquipment {
    pub slug: String,
    pub name: String,
    pub make: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryRegistries {
    pub collections: Vec<RegistryCollection>,
    pub cameras: Vec<RegistryEquipment>,
    pub lenses: Vec<RegistryEquipment>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryImageRef {
    pub id: String,
    pub title: String,
}

const DRAFT_SESSION_VERSION: u32 = 2;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionDefaultsDraft {
    #[serde(default)]
    pub tags: String,
    #[serde(default)]
    pub collection_select: String,
    #[serde(default)]
    pub hidden: Option<bool>,
    #[serde(default)]
    pub camera_select: String,
    #[serde(default)]
    pub lens_select: String,
    #[serde(default)]
    pub copyright: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub capture_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DraftUploadRow {
    pub id: String,
    pub source_path: String,
    pub title: String,
    pub description: String,
    pub tags: String,
    pub location: String,
    pub capture_date: String,
    pub capture_date_time_iso: String,
    pub collection_select: String,
    pub collection_set_cover: bool,
    pub camera_select: String,
    pub camera_custom: String,
    pub lens_select: String,
    pub lens_custom: String,
    pub alt: String,
    pub hidden: bool,
    pub sort_order: String,
    pub copyright: String,
    pub extension: String,
    pub dest_filename: String,
    pub edit_existing_id: Option<String>,
    pub preserve_uploaded_at: Option<String>,
    #[serde(default)]
    pub preserve_exif_display: Option<Vec<ExifDisplayRow>>,
    #[serde(default)]
    pub edit_gallery_image_path: Option<String>,
    #[serde(default)]
    pub edit_original_filename: Option<String>,
    #[serde(default)]
    pub replace_image_file: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DraftSession {
    pub version: u32,
    pub repo_url: String,
    pub branch: String,
    pub commit_message: String,
    pub selected_row_ids: Vec<String>,
    pub rows: Vec<DraftUploadRow>,
    #[serde(default)]
    pub session_defaults: Option<SessionDefaultsDraft>,
    #[serde(default)]
    pub compact_view: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadDraftSessionResult {
    pub session: Option<DraftSession>,
    pub skipped_paths: Vec<String>,
}

fn draft_session_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("draft-session.json"))
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn pat_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

fn git_command(workdir: &Path) -> Command {
    let mut c = Command::new("git");
    c.current_dir(workdir);
    apply_no_window(&mut c);
    c
}

fn npm_command(workdir: &Path) -> Command {
    #[cfg(windows)]
    let mut c = Command::new("npm.cmd");
    #[cfg(not(windows))]
    let mut c = Command::new("npm");
    c.current_dir(workdir);
    apply_no_window(&mut c);
    c
}

#[cfg(windows)]
fn apply_no_window(c: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    c.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_no_window(_c: &mut Command) {}

/// Keep photo sidecars in sync with site CI (`check-gallery-assets` / Pages deploy).
fn run_generate_assets_in_workdir(
    workdir: &Path,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let pkg = workdir.join("package.json");
    let script = workdir.join("scripts/generate-gallery-assets.mjs");
    if !pkg.is_file() || !script.is_file() {
        return Ok(());
    }
    emit_upload_progress(
        app,
        "Updating blurHash and exifDisplay in photo sidecars…",
    );
    let mut cmd = npm_command(workdir);
    cmd.args(["run", "generate-assets", "--silent"]);
    let out = cmd.output().map_err(|e| {
        format!(
            "Could not run npm run generate-assets ({e}). \
             Install Node.js and run npm install once in the gallery project folder."
        )
    })?;
    if out.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let detail = if stderr.is_empty() { stdout } else { stderr };
    Err(format!("generate-assets failed: {detail}"))
}

fn output_status(cmd: &mut Command) -> Result<String, String> {
    let out = cmd.output().map_err(|e| format!("failed to run git ({})", e))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("git exited with {}: {}", out.status, detail));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn git_worktree_status(workdir: &Path) -> String {
    let mut cmd = git_command(workdir);
    cmd.args(["status", "--short", "-b"]);
    match cmd.output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let mut text = stdout.trim().to_string();
            if !stderr.trim().is_empty() {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(stderr.trim());
            }
            if text.is_empty() {
                "(git status produced no output)".to_string()
            } else {
                text
            }
        }
        Err(e) => format!("(could not run git status: {e})"),
    }
}

fn format_git_failure(workdir: &Path, step: &str, detail: String) -> String {
    let repair_hint = if detail.contains("unmerged")
        || detail.contains("unmerged files")
        || git_worktree_needs_repair(workdir)
    {
        "\n\nThe gallery project folder has an unfinished merge or conflict. \
         Click “Repair gallery folder”, then try publishing again (Push without downloading first is fine if you just repaired)."
    } else {
        ""
    };
    format!(
        "Git {step} failed.\n\n{detail}{repair_hint}\n\n--- git status ---\n{}\n\nFix the gallery project folder (resolve conflicts, commit, or stash), then try again.",
        git_worktree_status(workdir)
    )
}

/// Pull with autostash so local edits do not block publish (matches site deploy.ps1).
fn git_pull_rebase_autostash(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
) -> Result<(), String> {
    let mut pull = git_command(workdir);
    pull.arg(&extra[0])
        .arg(&extra[1])
        .args(["pull", "--rebase", "--autostash", "origin", branch]);
    if let Err(e) = output_status(&mut pull) {
        return Err(format_git_failure(workdir, "pull --rebase", e));
    }
    Ok(())
}

/// Pull with merge (no rebase) when rebase keeps failing.
fn git_pull_merge_autostash(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
) -> Result<(), String> {
    let mut pull = git_command(workdir);
    pull.arg(&extra[0])
        .arg(&extra[1])
        .args(["pull", "--no-rebase", "--autostash", "origin", branch]);
    if let Err(e) = output_status(&mut pull) {
        return Err(format_git_failure(workdir, "pull (merge)", e));
    }
    Ok(())
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum PublishMode {
    Standard,
    SkipPull,
    MergeInstead,
    ForceWithLease,
    ForcePush,
}

fn parse_publish_mode(mode: Option<&str>) -> PublishMode {
    match mode.unwrap_or("standard").trim() {
        "skip_pull" => PublishMode::SkipPull,
        "merge_instead" => PublishMode::MergeInstead,
        "force_with_lease" => PublishMode::ForceWithLease,
        "force_push" => PublishMode::ForcePush,
        _ => PublishMode::Standard,
    }
}

fn git_pull_for_publish(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
    mode: PublishMode,
) -> Result<(), String> {
    match mode {
        PublishMode::SkipPull => Ok(()),
        PublishMode::MergeInstead => git_pull_merge_autostash(workdir, extra, branch),
        _ => git_pull_rebase_autostash(workdir, extra, branch),
    }
}

fn git_push_for_publish(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
    mode: PublishMode,
) -> Result<(), String> {
    let mut push = git_command(workdir);
    push.arg(&extra[0]).arg(&extra[1]).arg("push");
    if mode == PublishMode::ForceWithLease {
        push.arg("--force-with-lease");
    } else if mode == PublishMode::ForcePush {
        push.arg("--force");
    }
    push.arg("origin").arg(format!("HEAD:{branch}"));
    if let Err(e) = output_status(&mut push) {
        let step = match mode {
            PublishMode::ForceWithLease => "push --force-with-lease",
            PublishMode::ForcePush => "push --force",
            _ => "push",
        };
        return Err(format_git_failure(workdir, step, e));
    }
    Ok(())
}

fn git_in_progress_operation(workdir: &Path) -> Option<&'static str> {
    if workdir.join(".git/MERGE_HEAD").exists() {
        return Some("merge");
    }
    if workdir.join(".git/rebase-merge").exists() || workdir.join(".git/rebase-apply").exists() {
        return Some("rebase");
    }
    if workdir.join(".git/CHERRY_PICK_HEAD").exists() {
        return Some("cherry-pick");
    }
    None
}

fn git_has_unmerged_paths(workdir: &Path) -> bool {
    let mut cmd = git_command(workdir);
    cmd.args(["diff", "--name-only", "--diff-filter=U"]);
    match cmd.output() {
        Ok(out) if out.status.success() => !String::from_utf8_lossy(&out.stdout)
            .trim()
            .is_empty(),
        _ => false,
    }
}

fn git_worktree_needs_repair(workdir: &Path) -> bool {
    git_in_progress_operation(workdir).is_some() || git_has_unmerged_paths(workdir)
}

fn git_abort_operations(workdir: &Path) {
    for args in [
        ["merge", "--abort"],
        ["rebase", "--abort"],
        ["cherry-pick", "--abort"],
    ] {
        let mut cmd = git_command(workdir);
        cmd.args(args);
        let _ = cmd.output();
    }
}

/// Match local clone to origin/branch. Untracked files under public/gallery/ are kept.
fn git_reset_worktree_to_remote(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
) -> Result<(), String> {
    let mut fetch = git_command(workdir);
    fetch
        .arg(&extra[0])
        .arg(&extra[1])
        .args(["fetch", "origin", branch]);
    output_status(&mut fetch)?;

    let mut reset = git_command(workdir);
    reset.args(["reset", "--hard", &format!("origin/{branch}")]);
    output_status(&mut reset)?;
    Ok(())
}

fn git_repair_worktree(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
) -> Result<String, String> {
    let op = git_in_progress_operation(workdir);
    let unmerged = git_has_unmerged_paths(workdir);
    if op.is_none() && !unmerged {
        return Ok("Gallery project folder is already in a normal state.".into());
    }
    git_abort_operations(workdir);
    if git_in_progress_operation(workdir).is_some() || git_has_unmerged_paths(workdir) {
        git_reset_worktree_to_remote(workdir, extra, branch)?;
        restore_tracked_public_files(workdir)?;
        return Ok(format!(
            "Repaired the gallery project folder (was stuck in {}). \
             Your copied photos in public/gallery/ are still on disk if they were not committed yet.",
            op.unwrap_or("unmerged changes")
        ));
    }
    Ok("Aborted the unfinished git operation.".into())
}

fn git_prepare_worktree_for_pull(
    workdir: &Path,
    extra: &[String; 2],
    branch: &str,
    app: Option<&tauri::AppHandle>,
) -> Result<(), String> {
    if !git_worktree_needs_repair(workdir) {
        return Ok(());
    }
    if let Some(app) = app {
        emit_upload_progress(
            app,
            "Repairing gallery project folder (unfinished merge or conflict)…",
        );
    }
    git_repair_worktree(workdir, extra, branch)?;
    Ok(())
}

/// True when `.git/HEAD` exists so `git pull` / `git checkout` can run.
fn is_valid_git_worktree(workdir: &Path) -> bool {
    workdir.join(".git").join("HEAD").is_file()
}

fn reset_workdir(workdir: &Path) -> Result<(), String> {
    if !workdir.exists() {
        return Ok(());
    }
    std::fs::remove_dir_all(workdir).map_err(|e| {
        format!(
            "Could not reset the gallery project folder at {} (close the uploader and any Explorer windows there, then try Sync again): {e}",
            workdir.display()
        )
    })
}

/// Restore tracked site files when the worktree is missing them (e.g. broken partial clone).
fn restore_tracked_public_files(workdir: &Path) -> Result<(), String> {
    if !is_valid_git_worktree(workdir) {
        return Ok(());
    }
    for rel in ["public/site.json", "public/logo.svg", "public/CNAME"] {
        if workdir.join(rel).is_file() {
            continue;
        }
        let mut checkout = git_command(workdir);
        checkout.args(["checkout", "HEAD", "--", rel]);
        let _ = checkout.output();
    }
    Ok(())
}

fn authed_git_extra_args(pat: &str) -> Result<[String; 2], String> {
    let combined = format!("x-access-token:{pat}");
    let b64 = base64::engine::general_purpose::STANDARD.encode(combined.as_bytes());
    Ok([
        "-c".into(),
        format!("http.extraHeader=AUTHORIZATION: Basic {b64}"),
    ])
}

/// Stable folder name for a repo URL (FNV-1a 64-bit).
fn fnv1a64_url_id(repo_url: &str) -> u64 {
    const OFFSET: u64 = 14695981039346656037;
    const PRIME: u64 = 1099511628211;
    let normalized = repo_url.trim().to_lowercase();
    let mut hash = OFFSET;
    for b in normalized.as_bytes() {
        hash ^= u64::from(*b);
        hash = hash.wrapping_mul(PRIME);
    }
    hash
}

fn default_workdir_for_repo(repo_url: &str) -> PathBuf {
    let id = fnv1a64_url_id(repo_url);
    std::env::temp_dir()
        .join("galleree-gallery-uploader")
        .join(format!("work-{id:016x}"))
}

fn https_url_with_pat(repo_url: &str, pat: &str) -> Result<String, String> {
    let mut u = Url::parse(repo_url).map_err(|e| format!("invalid repo URL: {e}"))?;
    u.set_username("x-access-token")
        .map_err(|_| "could not set URL username".to_string())?;
    u.set_password(Some(pat))
        .map_err(|_| "could not set URL password (check PAT characters)".to_string())?;
    Ok(u.to_string())
}

fn gallery_root_from_config(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cfg = load_config(app.clone())?.ok_or("not configured")?;
    let gallery = PathBuf::from(&cfg.workdir).join("public").join("gallery");
    if !gallery.is_dir() {
        return Err("public/gallery missing — run “Prepare repository” first.".into());
    }
    Ok(gallery)
}

fn is_gallery_image_id(stem: &str) -> bool {
    stem.len() == 32 && stem.chars().all(|c| c.is_ascii_hexdigit())
}

fn sha256_hex_file(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("read {}: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[derive(Debug, Clone)]
struct GalleryHashHit {
    id: String,
    title: String,
    filename: String,
}

fn gallery_title_for_id(meta_dir: &Path, id: &str) -> String {
    let meta_path = meta_dir.join(format!("{id}.json"));
    if meta_path.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&meta_path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(t) = v.get("title").and_then(|x| x.as_str()) {
                    let t = t.trim();
                    if !t.is_empty() {
                        return t.to_string();
                    }
                }
            }
        }
    }
    id.to_string()
}

fn index_gallery_content_hashes(gallery_dir: &Path) -> Result<HashMap<String, GalleryHashHit>, String> {
    let meta_dir = gallery_dir.join("meta");
    let mut index = HashMap::new();
    for entry in std::fs::read_dir(gallery_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_gallery_image_id(stem) {
            continue;
        }
        let id = stem.to_lowercase();
        let filename = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(stem)
            .to_string();
        let hash = sha256_hex_file(&path)?;
        let title = gallery_title_for_id(&meta_dir, &id);
        index.insert(
            hash,
            GalleryHashHit {
                id,
                title,
                filename,
            },
        );
    }
    Ok(index)
}

const GALLERY_HASH_CACHE_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GalleryHashHitSer {
    id: String,
    title: String,
    filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GalleryHashCacheFile {
    version: u32,
    repo_url: String,
    branch: String,
    fingerprint: String,
    entries: HashMap<String, GalleryHashHitSer>,
}

fn gallery_hash_cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("gallery-hash-index.json"))
}

fn upload_preferences_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("upload-preferences.json"))
}

fn display_preview_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("display-previews");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn gallery_fingerprint(gallery_dir: &Path) -> Result<String, String> {
    let mut count = 0u64;
    let mut bytes = 0u64;
    for entry in std::fs::read_dir(gallery_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_gallery_image_id(stem) {
            continue;
        }
        count += 1;
        bytes += std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
    }
    Ok(format!("{count}:{bytes}"))
}

fn invalidate_gallery_hash_cache(app: &tauri::AppHandle) {
    if let Ok(p) = gallery_hash_cache_path(app) {
        let _ = std::fs::remove_file(p);
    }
}

fn index_gallery_content_hashes_cached(
    app: &tauri::AppHandle,
    gallery_dir: &Path,
) -> Result<HashMap<String, GalleryHashHit>, String> {
    let cfg = load_config(app.clone())?.ok_or("not configured")?;
    let fingerprint = gallery_fingerprint(gallery_dir)?;
    let cache_path = gallery_hash_cache_path(app)?;

    if cache_path.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&cache_path) {
            if let Ok(cached) = serde_json::from_str::<GalleryHashCacheFile>(&raw) {
                if cached.version == GALLERY_HASH_CACHE_VERSION
                    && cached.repo_url == cfg.repo_url
                    && cached.branch == cfg.branch
                    && cached.fingerprint == fingerprint
                {
                    let mut index = HashMap::new();
                    for (hash, hit) in cached.entries {
                        index.insert(
                            hash,
                            GalleryHashHit {
                                id: hit.id,
                                title: hit.title,
                                filename: hit.filename,
                            },
                        );
                    }
                    return Ok(index);
                }
            }
        }
    }

    let index = index_gallery_content_hashes(gallery_dir)?;
    let entries: HashMap<String, GalleryHashHitSer> = index
        .iter()
        .map(|(hash, hit)| {
            (
                hash.clone(),
                GalleryHashHitSer {
                    id: hit.id.clone(),
                    title: hit.title.clone(),
                    filename: hit.filename.clone(),
                },
            )
        })
        .collect();
    let file = GalleryHashCacheFile {
        version: GALLERY_HASH_CACHE_VERSION,
        repo_url: cfg.repo_url,
        branch: cfg.branch,
        fingerprint,
        entries,
    };
    if let Ok(json) = serde_json::to_string_pretty(&file) {
        let _ = std::fs::write(cache_path, format!("{json}\n"));
    }
    Ok(index)
}

/// Local lightbox-style preview (max width 2400 JPEG; production display WebP is built on CI).
const DISPLAY_MAX_WIDTH: u32 = 2400;

fn write_gallery_display(source: &Path, dest: &Path) -> Result<(), String> {
    let img = image::open(source).map_err(|e| e.to_string())?;
    let scaled = resize_to_max_side(&img, DISPLAY_MAX_WIDTH);
    let rgb = scaled.to_rgb8();
    let mut buf = Vec::new();
    let enc = JpegEncoder::new_with_quality(&mut buf, THUMB_JPEG_QUALITY);
    enc.write_image(
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        ExtendedColorType::Rgb8,
    )
    .map_err(|e| e.to_string())?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(dest, &buf).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn ensure_display_preview(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let src = PathBuf::from(&path);
    if !src.is_file() {
        return Err(format!("source not found: {path}"));
    }
    let meta = std::fs::metadata(&src).map_err(|e| e.to_string())?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let key = format!("{}:{}:{}", path, meta.len(), modified);
    let digest = format!("{:x}", Sha256::digest(key.as_bytes()));
    let cache = display_preview_cache_dir(&app)?.join(format!("{digest}.jpg"));
    if !cache.is_file() {
        write_gallery_display(&src, &cache)?;
    }
    cache
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| "invalid preview cache path".into())
}

#[tauri::command]
fn load_upload_preferences(app: tauri::AppHandle) -> Result<Option<SessionDefaultsDraft>, String> {
    let p = upload_preferences_path(&app)?;
    if !p.is_file() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let prefs = serde_json::from_str::<SessionDefaultsDraft>(&raw).map_err(|e| e.to_string())?;
    Ok(Some(prefs))
}

#[tauri::command]
fn save_upload_preferences(
    app: tauri::AppHandle,
    defaults: SessionDefaultsDraft,
) -> Result<(), String> {
    let p = upload_preferences_path(&app)?;
    let json = serde_json::to_string_pretty(&defaults).map_err(|e| e.to_string())?;
    std::fs::write(&p, format!("{json}\n")).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathDuplicate {
    pub path: String,
    pub match_kind: String,
    pub existing_id: Option<String>,
    pub existing_title: String,
    pub existing_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckDuplicatePathsResult {
    pub ok_paths: Vec<String>,
    pub duplicates: Vec<PathDuplicate>,
    pub gallery_image_count: usize,
}

fn is_safe_registry_asset_path(relative: &str) -> bool {
    if relative.contains("..") || relative.contains('\\') {
        return false;
    }
    let lower = relative.to_lowercase();
    (lower.starts_with("meta/cameras/") || lower.starts_with("meta/lenses/"))
        && (lower.ends_with(".png")
            || lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".webp"))
}

fn is_safe_registry_relative_path(relative: &str) -> bool {
    if relative.contains('\\') || relative.contains("..") {
        return false;
    }
    let allowed = relative.starts_with("meta/collections/")
        || relative.starts_with("meta/cameras/")
        || relative.starts_with("meta/lenses/");
    allowed && relative.ends_with(".json")
}

fn read_registry_collections(dir: &Path) -> Result<Vec<RegistryCollection>, String> {
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let v: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| format!("invalid {}: {e}", path.display()))?;
        let slug = v
            .get("slug")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty());
        let title = v
            .get("title")
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let (Some(slug), Some(title)) = (slug, title) else {
            continue;
        };
        let description = v
            .get("description")
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let cover_image_id = v
            .get("coverImageId")
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        out.push(RegistryCollection {
            slug,
            title: title.to_string(),
            description,
            cover_image_id,
        });
    }
    out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(out)
}

fn read_registry_equipment(dir: &Path) -> Result<Vec<RegistryEquipment>, String> {
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let v: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| format!("invalid {}: {e}", path.display()))?;
        let slug = v
            .get("slug")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty());
        let name = v
            .get("name")
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let (Some(slug), Some(name)) = (slug, name) else {
            continue;
        };
        let make = v
            .get("make")
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let model = v
            .get("model")
            .and_then(|x| x.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        out.push(RegistryEquipment {
            slug,
            name: name.to_string(),
            make,
            model,
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn ensure_galleree_layout(workdir: &Path) -> Result<(), String> {
    let gallery = workdir.join("public").join("gallery");
    if !gallery.is_dir() {
        return Err(
            "This checkout has no public/gallery folder. Point the tool at your galleree site repo."
                .into(),
        );
    }
    Ok(())
}

#[tauri::command]
fn load_draft_session(app: tauri::AppHandle) -> Result<LoadDraftSessionResult, String> {
    let p = draft_session_path(&app)?;
    if !p.is_file() {
        return Ok(LoadDraftSessionResult {
            session: None,
            skipped_paths: vec![],
        });
    }
    let raw = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let mut session: DraftSession = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if session.version != DRAFT_SESSION_VERSION && session.version != 1 {
        let _ = std::fs::remove_file(&p);
        return Ok(LoadDraftSessionResult {
            session: None,
            skipped_paths: vec![],
        });
    }
    let mut kept = Vec::new();
    let mut skipped = Vec::new();
    for row in session.rows.drain(..) {
        if PathBuf::from(&row.source_path).is_file() {
            kept.push(row);
        } else {
            skipped.push(row.source_path);
        }
    }
    session.rows = kept;
    let empty = session.rows.is_empty() && session.commit_message.trim().is_empty();
    Ok(LoadDraftSessionResult {
        session: if empty { None } else { Some(session) },
        skipped_paths: skipped,
    })
}

#[tauri::command]
fn save_draft_session(app: tauri::AppHandle, mut session: DraftSession) -> Result<(), String> {
    session.version = DRAFT_SESSION_VERSION;
    if session.rows.is_empty() && session.commit_message.trim().is_empty() {
        return clear_draft_session(app);
    }
    let p = draft_session_path(&app)?;
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    std::fs::write(&p, format!("{json}\n")).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_draft_session(app: tauri::AppHandle) -> Result<(), String> {
    let p = draft_session_path(&app)?;
    if p.is_file() {
        std::fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<Option<AppConfig>, String> {
    let p = config_path(&app)?;
    if !p.exists() {
        return Ok(None);
    }
    let s = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let mut c: AppConfig = serde_json::from_str(&s).map_err(|e| e.to_string())?;
    // Always use the temp-dir layout derived from the repo URL (ignore legacy custom paths).
    c.workdir = default_workdir_for_repo(&c.repo_url)
        .to_string_lossy()
        .into_owned();
    Ok(Some(c))
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, mut config: AppConfig) -> Result<(), String> {
    Url::parse(&config.repo_url).map_err(|e| format!("repo URL: {e}"))?;
    if config.branch.trim().is_empty() {
        return Err("branch is required".into());
    }
    config.workdir = default_workdir_for_repo(&config.repo_url)
        .to_string_lossy()
        .into_owned();
    let p = config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&p, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_pat(pat: String) -> Result<(), String> {
    if pat.trim().is_empty() {
        return Err("token is empty".into());
    }
    pat_entry()?.set_password(&pat).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_pat() -> Result<bool, String> {
    Ok(pat_entry()?.get_password().is_ok())
}

#[tauri::command]
fn clear_pat() -> Result<(), String> {
    let e = pat_entry()?;
    if e.get_password().is_ok() {
        e.delete_credential().map_err(|x| x.to_string())?;
    }
    Ok(())
}

fn field_ascii(exif: &exif::Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY)
        .map(|f| f.display_value().to_string().trim().to_string())
        .filter(|s| !s.is_empty())
}

#[tauri::command]
fn read_image_hints(path: String) -> Result<ImageHints, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err("not a file".into());
    }

    let exif = match std::fs::File::open(&p) {
        Ok(file) => match ExifReader::new().read_from_container(&mut BufReader::new(file)) {
            Ok(e) => e,
            Err(_) => {
                return Ok(ImageHints {
                    description: None,
                    date_time_original_iso: None,
                    make: None,
                    model: None,
                    lens_model: None,
                });
            }
        },
        Err(_) => {
            return Ok(ImageHints {
                description: None,
                date_time_original_iso: None,
                make: None,
                model: None,
                lens_model: None,
            });
        }
    };

    let description = field_ascii(&exif, Tag::ImageDescription);

    let make = field_ascii(&exif, Tag::Make);
    let model = field_ascii(&exif, Tag::Model);
    let lens_model = field_ascii(&exif, Tag::LensModel);

    let date_time_original_iso = exif
        .get_field(Tag::DateTimeOriginal, In::PRIMARY)
        .or_else(|| exif.get_field(Tag::DateTime, In::PRIMARY))
        .and_then(|f| {
            let raw = f.display_value().to_string();
            let raw = raw.trim();
            NaiveDateTime::parse_from_str(raw, "%Y:%m:%d %H:%M:%S").ok()
        })
        .and_then(|naive| match naive.and_local_timezone(Local) {
            MappedLocalTime::Single(dt) => Some(dt),
            MappedLocalTime::Ambiguous(dt, _) => Some(dt),
            MappedLocalTime::None => None,
        })
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string());

    Ok(ImageHints {
        description,
        date_time_original_iso,
        make,
        model,
        lens_model,
    })
}

fn rational_to_f64(r: &exif::Rational) -> f64 {
    if r.denom == 0 {
        return 0.0;
    }
    r.num as f64 / r.denom as f64
}

fn srational_to_f64(r: &exif::SRational) -> f64 {
    if r.denom == 0 {
        return 0.0;
    }
    r.num as f64 / r.denom as f64
}

fn exif_ascii_value(exif: &exif::Exif, tag: Tag) -> Option<String> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        exif::Value::Ascii(parts) => {
            let s: String = parts
                .iter()
                .flat_map(|p| p.iter().copied())
                .map(|b| b as char)
                .collect();
            let s = s.trim().trim_end_matches('\0').trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        }
        _ => {
            let s = field.display_value().to_string();
            let s = s.trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        }
    }
}

fn exif_number_value(exif: &exif::Exif, tag: Tag) -> Option<f64> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        exif::Value::Short(v) => v.first().map(|n| f64::from(*n)),
        exif::Value::Long(v) => v.first().map(|n| f64::from(*n)),
        exif::Value::SShort(v) => v.first().map(|n| f64::from(*n)),
        exif::Value::SLong(v) => v.first().map(|n| f64::from(*n)),
        exif::Value::Rational(v) => v.first().map(rational_to_f64),
        exif::Value::SRational(v) => v.first().map(srational_to_f64),
        _ => field
            .display_value()
            .to_string()
            .trim()
            .parse::<f64>()
            .ok(),
    }
}

fn push_exif_ascii(map: &mut serde_json::Map<String, serde_json::Value>, exif: &exif::Exif, tag: Tag, key: &str) {
    if let Some(s) = exif_ascii_value(exif, tag) {
        map.insert(key.to_string(), serde_json::Value::String(s));
    }
}

fn push_exif_number(map: &mut serde_json::Map<String, serde_json::Value>, exif: &exif::Exif, tag: Tag, key: &str) {
    if let Some(n) = exif_number_value(exif, tag) {
        if n.is_finite() {
            map.insert(
                key.to_string(),
                serde_json::Number::from_f64(n)
                    .map(serde_json::Value::Number)
                    .unwrap_or_else(|| serde_json::Value::String(n.to_string())),
            );
        }
    }
}

/// Raw EXIF map for `@galleree/exif-display` (same keys as exifr / generate-assets).
#[tauri::command]
fn read_exif_publish_raw(path: String) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err("not a file".into());
    }

    let file = std::fs::File::open(&p).map_err(|e| e.to_string())?;
    let exif = match ExifReader::new().read_from_container(&mut BufReader::new(file)) {
        Ok(e) => e,
        Err(_) => return Ok(serde_json::Map::new()),
    };

    let mut map = serde_json::Map::new();
    push_exif_ascii(&mut map, &exif, Tag::Make, "Make");
    push_exif_ascii(&mut map, &exif, Tag::Model, "Model");
    push_exif_ascii(&mut map, &exif, Tag::LensMake, "LensMake");
    push_exif_ascii(&mut map, &exif, Tag::LensModel, "LensModel");
    push_exif_number(&mut map, &exif, Tag::FocalLength, "FocalLength");
    push_exif_number(
        &mut map,
        &exif,
        Tag::FocalLengthIn35mmFilm,
        "FocalLengthIn35mmFormat",
    );
    push_exif_number(&mut map, &exif, Tag::FNumber, "FNumber");
    push_exif_number(&mut map, &exif, Tag::ExposureTime, "ExposureTime");
    push_exif_number(&mut map, &exif, Tag::PhotographicSensitivity, "ISO");
    push_exif_number(&mut map, &exif, Tag::ExposureProgram, "ExposureProgram");
    push_exif_number(&mut map, &exif, Tag::MeteringMode, "MeteringMode");
    push_exif_number(&mut map, &exif, Tag::Flash, "Flash");
    push_exif_number(&mut map, &exif, Tag::WhiteBalance, "WhiteBalance");
    push_exif_number(&mut map, &exif, Tag::Orientation, "Orientation");
    push_exif_ascii(&mut map, &exif, Tag::DateTimeOriginal, "DateTimeOriginal");
    push_exif_ascii(&mut map, &exif, Tag::DateTime, "CreateDate");
    push_exif_ascii(&mut map, &exif, Tag::DateTimeDigitized, "ModifyDate");
    push_exif_number(&mut map, &exif, Tag::ImageWidth, "ImageWidth");
    push_exif_number(&mut map, &exif, Tag::ImageLength, "ImageHeight");
    push_exif_number(&mut map, &exif, Tag::PixelXDimension, "ExifImageWidth");
    push_exif_number(&mut map, &exif, Tag::PixelYDimension, "ExifImageHeight");
    push_exif_number(&mut map, &exif, Tag::ColorSpace, "ColorSpace");
    push_exif_ascii(&mut map, &exif, Tag::Software, "Software");
    push_exif_ascii(&mut map, &exif, Tag::Artist, "Artist");
    push_exif_ascii(&mut map, &exif, Tag::Copyright, "Copyright");
    push_exif_ascii(&mut map, &exif, Tag::ImageDescription, "Description");
    Ok(map)
}

fn parse_exif_display_sidecar(v: &serde_json::Value) -> Option<Vec<ExifDisplayRow>> {
    let arr = v.as_array()?;
    let mut rows = Vec::new();
    for item in arr {
        let label = item.get("label")?.as_str()?.trim();
        let value = item.get("value")?.as_str()?.trim();
        if label.is_empty() || value.is_empty() {
            continue;
        }
        rows.push(ExifDisplayRow {
            label: label.to_string(),
            value: value.to_string(),
        });
    }
    if rows.is_empty() {
        None
    } else {
        Some(rows)
    }
}

#[tauri::command]
fn gallery_dest_exists(app: tauri::AppHandle, dest_filename: String) -> Result<bool, String> {
    if dest_filename.contains('/') || dest_filename.contains('\\') || dest_filename.contains("..") {
        return Err("invalid destination name".into());
    }
    let cfg = load_config(app.clone())?.ok_or("not configured")?;
    let gallery = PathBuf::from(&cfg.workdir)
        .join("public")
        .join("gallery")
        .join(&dest_filename);
    Ok(gallery.exists())
}

#[tauri::command]
fn ensure_repo_ready(app: tauri::AppHandle) -> Result<String, String> {
    let cfg = load_config(app.clone())?.ok_or("Save repository settings first.")?;
    let pat = pat_entry()?.get_password().map_err(|_| {
        "No Git token saved. Add a GitHub personal access token with repo scope.".to_string()
    })?;
    let workdir = PathBuf::from(&cfg.workdir);
    let branch = cfg.branch.trim();
    let url = https_url_with_pat(&cfg.repo_url, &pat)?;
    let extra = authed_git_extra_args(&pat)?;

    // Interrupted clone leaves a `.git` folder without HEAD; git commands then fail silently from the UI’s perspective.
    if workdir.join(".git").exists() && !is_valid_git_worktree(&workdir) {
        reset_workdir(&workdir)?;
    }

    if is_valid_git_worktree(&workdir) {
        ensure_galleree_layout(&workdir)?;
        git_prepare_worktree_for_pull(&workdir, &extra, branch, Some(&app))?;
        git_pull_rebase_autostash(&workdir, &extra, branch)?;
        restore_tracked_public_files(&workdir)?;
        invalidate_gallery_hash_cache(&app);
        return Ok("Repository is ready (pulled latest).".into());
    }

    if !workdir.exists() {
        let parent = workdir
            .parent()
            .ok_or("work directory must have a parent folder")?;
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut clone = Command::new("git");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            clone.creation_flags(0x0800_0000);
        }
        clone
            .arg(&extra[0])
            .arg(&extra[1])
            .args(["clone", "--branch", branch, "--", &url])
            .arg(&workdir);
        output_status(&mut clone)?;
        ensure_galleree_layout(&workdir)?;
        restore_tracked_public_files(&workdir)?;
        invalidate_gallery_hash_cache(&app);
        return Ok("Repository cloned.".into());
    }

    let mut read_dir = std::fs::read_dir(&workdir).map_err(|e| e.to_string())?;
    if read_dir.next().is_some() {
        reset_workdir(&workdir)?;
        let parent = workdir
            .parent()
            .ok_or("work directory must have a parent folder")?;
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut clone = Command::new("git");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            clone.creation_flags(0x0800_0000);
        }
        clone
            .arg(&extra[0])
            .arg(&extra[1])
            .args(["clone", "--branch", branch, "--", &url])
            .arg(&workdir);
        output_status(&mut clone)?;
        ensure_galleree_layout(&workdir)?;
        restore_tracked_public_files(&workdir)?;
        invalidate_gallery_hash_cache(&app);
        return Ok("Repository cloned (replaced invalid work folder).".into());
    }

    let mut clone = Command::new("git");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        clone.creation_flags(0x0800_0000);
    }
    clone
        .current_dir(&workdir)
        .arg(&extra[0])
        .arg(&extra[1])
        .args(["clone", "--branch", branch, "--", &url, "."]);
    output_status(&mut clone)?;
    ensure_galleree_layout(&workdir)?;
    restore_tracked_public_files(&workdir)?;
    invalidate_gallery_hash_cache(&app);
    Ok("Repository cloned.".into())
}

const ALLOWED_EXT: &[&str] = &["jpg", "jpeg", "png", "webp", "avif", "gif"];

/// GitHub rejects new blobs ≥ 100 MiB; stay slightly under so pushes succeed.
/// See: <https://docs.github.com/repositories/working-with-files/managing-large-files/about-large-files-on-github>
const GITHUB_BLOB_MAX_BYTES: u64 = 100 * 1024 * 1024 / 2; // half of 100 MiB

/// Largest staged file size we allow without re-encoding, and the target cap after shrinking.
const SAFE_MAX_STAGED_BYTES: u64 = GITHUB_BLOB_MAX_BYTES - 256 * 1024;

const LARGE_FILE_BYTES: u64 = SAFE_MAX_STAGED_BYTES;

const TARGET_STAGED_BYTES: u64 = SAFE_MAX_STAGED_BYTES;

const MIN_LONG_EDGE: u32 = 960;

/// Keep in sync with `schemas/gallery-asset-spec.json` → `uploaderPreviewThumb`.
const THUMB_MAX_WIDTH: u32 = 720;
const THUMB_JPEG_QUALITY: u8 = 82;

fn write_gallery_thumb(source: &Path, thumb_path: &Path) -> Result<(), String> {
    let img = image::open(source).map_err(|e| e.to_string())?;
    let thumb = resize_to_max_side(&img, THUMB_MAX_WIDTH);
    let rgb = thumb.to_rgb8();
    let mut buf = Vec::new();
    let enc = JpegEncoder::new_with_quality(&mut buf, THUMB_JPEG_QUALITY);
    enc.write_image(
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        ExtendedColorType::Rgb8,
    )
    .map_err(|e| e.to_string())?;
    if let Some(parent) = thumb_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(thumb_path, &buf).map_err(|e| e.to_string())?;
    Ok(())
}

fn resize_to_max_side(img: &DynamicImage, max_side: u32) -> DynamicImage {
    let (w, h) = img.dimensions();
    let m = w.max(h);
    if m <= max_side {
        return img.clone();
    }
    let scale = max_side as f64 / f64::from(m);
    let nw = ((f64::from(w) * scale).round() as u32).max(1);
    let nh = ((f64::from(h) * scale).round() as u32).max(1);
    img.resize(nw, nh, FilterType::Lanczos3)
}

fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let rgb = img.to_rgb8();
    let mut buf = Vec::new();
    let enc = JpegEncoder::new_with_quality(&mut buf, quality);
    enc.write_image(
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        ExtendedColorType::Rgb8,
    )
    .map_err(|e| e.to_string())?;
    Ok(buf)
}

fn encode_png(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let rgba = img.to_rgba8();
    let mut buf = Vec::new();
    let enc = PngEncoder::new_with_quality(&mut buf, CompressionType::Best, PngRowFilter::Adaptive);
    enc.write_image(
        rgba.as_raw(),
        rgba.width(),
        rgba.height(),
        ExtendedColorType::Rgba8,
    )
    .map_err(|e| e.to_string())?;
    Ok(buf)
}

fn encode_webp_lossless(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let rgba = img.to_rgba8();
    let mut buf = Vec::new();
    let enc = WebPEncoder::new_lossless(&mut buf);
    enc.encode(
        rgba.as_raw(),
        rgba.width(),
        rgba.height(),
        ExtendedColorType::Rgba8,
    )
    .map_err(|e| e.to_string())?;
    Ok(buf)
}

fn encode_gif(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    {
        let mut c = Cursor::new(&mut buf);
        img.write_to(&mut c, ImageFormat::Gif)
            .map_err(|e| e.to_string())?;
    }
    Ok(buf)
}

/// Copies files that are already under GitHub’s limit as-is; re-encodes and scales down only when
/// the source would exceed that limit.
fn copy_or_shrink_for_git(src: &Path, dest: &Path, dest_filename: &str) -> Result<(), String> {
    let meta = std::fs::metadata(src).map_err(|e| format!("{dest_filename}: {e}"))?;
    if meta.len() <= LARGE_FILE_BYTES {
        std::fs::copy(src, dest).map_err(|e| format!("copy {dest_filename}: {e}"))?;
        return Ok(());
    }

    let img = image::open(src).map_err(|e| {
        format!(
            "{} is {:.1} MiB; could not decode it to shrink ({e}). \
             For AVIF, export as JPEG or PNG first, or use a smaller source file.",
            dest_filename,
            meta.len() as f64 / (1024.0 * 1024.0)
        )
    })?;

    let ext = Path::new(dest_filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut max_side = 4096u32;
    let mut quality: u8 = 88;
    let mut best: Option<Vec<u8>> = None;

    for _ in 0..48 {
        let resized = resize_to_max_side(&img, max_side);
        let buf: Vec<u8> = match ext.as_str() {
            "jpg" | "jpeg" => encode_jpeg(&resized, quality)?,
            "png" => encode_png(&resized)?,
            "webp" => encode_webp_lossless(&resized)?,
            "gif" => encode_gif(&resized)?,
            "avif" => {
                return Err(format!(
                    "{dest_filename}: AVIF over GitHub’s 100 MiB blob limit is not auto-shrunk here; export as JPEG or PNG and try again."
                ));
            }
            _ => {
                return Err(format!(
                    "{dest_filename}: unsupported extension for shrinking"
                ));
            }
        };

        if (buf.len() as u64) <= TARGET_STAGED_BYTES {
            std::fs::write(dest, buf).map_err(|e| format!("write {dest_filename}: {e}"))?;
            return Ok(());
        }
        match &mut best {
            Some(b) if b.len() <= buf.len() => {}
            _ => best = Some(buf),
        }

        match ext.as_str() {
            "jpg" | "jpeg" => {
                if quality > 62 {
                    quality = quality.saturating_sub(6);
                } else {
                    max_side = (max_side * 4 / 5).max(MIN_LONG_EDGE);
                    quality = 82;
                }
            }
            _ => {
                max_side = (max_side * 4 / 5).max(MIN_LONG_EDGE);
            }
        }
    }

    let buf = best.ok_or_else(|| format!("{dest_filename}: could not produce a preview"))?;
    if (buf.len() as u64) > TARGET_STAGED_BYTES {
        return Err(format!(
            "{dest_filename}: still {:.1} MiB after shrinking (GitHub allows just under 100 MiB per file); try a smaller source or a more compressible format.",
            buf.len() as f64 / (1024.0 * 1024.0)
        ));
    }
    std::fs::write(dest, buf).map_err(|e| format!("write {dest_filename}: {e}"))?;
    Ok(())
}

fn validate_dest_filename(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("invalid destination filename".into());
    }
    let lower = name.to_lowercase();
    let ok = ALLOWED_EXT.iter().any(|e| lower.ends_with(&format!(".{e}")));
    if !ok {
        return Err(format!(
            "extension must be one of: {}",
            ALLOWED_EXT.join(", ")
        ));
    }
    Ok(())
}

#[tauri::command]
fn check_duplicate_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
    queued_paths: Vec<String>,
) -> Result<CheckDuplicatePathsResult, String> {
    let gallery_dir = gallery_root_from_config(&app)?;
    let gallery_index = index_gallery_content_hashes_cached(&app, &gallery_dir)?;
    let gallery_image_count = gallery_index.len();

    enum SeenKind {
        Queue,
        Batch,
    }

    struct SeenEntry {
        kind: SeenKind,
        label: String,
    }

    let mut seen: HashMap<String, SeenEntry> = HashMap::new();

    for q in &queued_paths {
        let qpath = PathBuf::from(q);
        if !qpath.is_file() {
            continue;
        }
        let hash = sha256_hex_file(&qpath)?;
        let label = qpath
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(q.as_str())
            .to_string();
        seen.insert(hash, SeenEntry {
            kind: SeenKind::Queue,
            label,
        });
    }

    let mut ok_paths = Vec::new();
    let mut duplicates = Vec::new();

    for path in paths {
        let p = PathBuf::from(&path);
        if !p.is_file() {
            continue;
        }
        let hash = sha256_hex_file(&p)?;
        let name = p
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(path.as_str())
            .to_string();

        if let Some(hit) = gallery_index.get(&hash) {
            duplicates.push(PathDuplicate {
                path,
                match_kind: "gallery".into(),
                existing_id: Some(hit.id.clone()),
                existing_title: hit.title.clone(),
                existing_path: hit.filename.clone(),
            });
            continue;
        }

        if let Some(prev) = seen.get(&hash) {
            let (match_kind, existing_id, existing_title, existing_path) = match prev.kind {
                SeenKind::Queue => ("queue", None, prev.label.clone(), prev.label.clone()),
                SeenKind::Batch => ("batch", None, prev.label.clone(), prev.label.clone()),
            };
            duplicates.push(PathDuplicate {
                path,
                match_kind: match_kind.into(),
                existing_id,
                existing_title,
                existing_path,
            });
            continue;
        }

        seen.insert(
            hash,
            SeenEntry {
                kind: SeenKind::Batch,
                label: name,
            },
        );
        ok_paths.push(path);
    }

    Ok(CheckDuplicatePathsResult {
        ok_paths,
        duplicates,
        gallery_image_count,
    })
}

#[tauri::command]
fn list_gallery_registries(app: tauri::AppHandle) -> Result<GalleryRegistries, String> {
    let gallery_dir = gallery_root_from_config(&app)?;
    let meta = gallery_dir.join("meta");
    Ok(GalleryRegistries {
        collections: read_registry_collections(&meta.join("collections"))?,
        cameras: read_registry_equipment(&meta.join("cameras"))?,
        lenses: read_registry_equipment(&meta.join("lenses"))?,
    })
}

#[tauri::command]
fn list_gallery_images(app: tauri::AppHandle) -> Result<Vec<GalleryImageRef>, String> {
    let gallery_dir = gallery_root_from_config(&app)?;
    let meta_dir = gallery_dir.join("meta");
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&gallery_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_gallery_image_id(stem) {
            continue;
        }
        let id = stem.to_lowercase();
        let mut title = id.clone();
        let meta_path = meta_dir.join(format!("{id}.json"));
        if meta_path.is_file() {
            if let Ok(raw) = std::fs::read_to_string(&meta_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if let Some(t) = v.get("title").and_then(|x| x.as_str()) {
                        let t = t.trim();
                        if !t.is_empty() {
                            title = t.to_string();
                        }
                    }
                }
            }
        }
        out.push(GalleryImageRef { id, title });
    }
    out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(out)
}

#[tauri::command]
fn list_gallery_tags(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let gallery_dir = gallery_root_from_config(&app)?;
    let meta_dir = gallery_dir.join("meta");
    let mut tags = std::collections::BTreeSet::<String>::new();
    if !meta_dir.is_dir() {
        return Ok(Vec::new());
    }
    for entry in std::fs::read_dir(&meta_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_gallery_image_id(stem) {
            continue;
        }
        let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
            continue;
        };
        let Some(arr) = v.get("tags").and_then(|x| x.as_array()) else {
            continue;
        };
        for item in arr {
            if let Some(s) = item.as_str() {
                let t = s.trim();
                if !t.is_empty() {
                    tags.insert(t.to_string());
                }
            }
        }
    }
    let mut out: Vec<String> = tags.into_iter().collect();
    out.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(out)
}

fn find_gallery_image_file(gallery_dir: &Path, id: &str) -> Option<PathBuf> {
    const EXT: &[&str] = &["jpg", "jpeg", "png", "webp", "avif", "gif"];
    for ext in EXT {
        let p = gallery_dir.join(format!("{id}.{ext}"));
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

#[tauri::command]
fn get_gallery_photo_for_edit(app: tauri::AppHandle, id: String) -> Result<GalleryPhotoEdit, String> {
    let id = id.trim().to_lowercase();
    if !is_gallery_image_id(&id) {
        return Err("invalid gallery id".into());
    }
    let gallery_dir = gallery_root_from_config(&app)?;
    let image_path = find_gallery_image_file(&gallery_dir, &id)
        .ok_or_else(|| format!("no image file found for {id}"))?;
    let meta_path = gallery_dir.join("meta").join(format!("{id}.json"));
    if !meta_path.is_file() {
        return Err(format!("meta/{id}.json not found"));
    }
    let raw = std::fs::read_to_string(&meta_path).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let title = v
        .get("title")
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| id.clone());

    let tags: Vec<String> = v
        .get("tags")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    Ok(GalleryPhotoEdit {
        id: id.clone(),
        dest_filename: image_path
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{id}.jpg")),
        image_path: image_path.to_string_lossy().into_owned(),
        title,
        description: v
            .get("description")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        tags,
        location: v
            .get("location")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        captured_on: v
            .get("capturedOn")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        captured_at: v
            .get("capturedAt")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        collection_slug: v
            .get("collectionSlug")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty()),
        camera: v
            .get("camera")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        lens: v
            .get("lens")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        alt: v
            .get("alt")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        hidden: v.get("hidden").and_then(|x| x.as_bool()).unwrap_or(false),
        sort_order: v.get("sortOrder").and_then(|x| x.as_f64()),
        copyright: v
            .get("copyright")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        uploaded_at: v
            .get("uploadedAt")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        exif_display: v.get("exifDisplay").and_then(parse_exif_display_sidecar),
    })
}

fn site_json_path(workdir: &Path) -> PathBuf {
    workdir.join("public").join("site.json")
}

#[tauri::command]
fn read_site_json(app: tauri::AppHandle) -> Result<String, String> {
    let cfg = load_config(app)?.ok_or("not configured")?;
    let workdir = PathBuf::from(&cfg.workdir);
    if workdir.join(".git").exists() && !is_valid_git_worktree(&workdir) {
        return Err(format!(
            "The gallery project folder has a broken git checkout (often after an interrupted sync).\nPath: {}\nClick “Sync gallery project” to repair it.",
            workdir.display()
        ));
    }
    if !is_valid_git_worktree(&workdir) {
        return Err("Gallery project not cloned yet — click “Sync gallery project” first.".into());
    }
    let path = site_json_path(&workdir);
    if !path.is_file() {
        restore_tracked_public_files(&workdir)?;
    }
    if !path.is_file() {
        return Err(format!(
            "public/site.json not found in the local copy.\nPath: {}\nSync the gallery project, or add site.json on branch “{}” in the repo.",
            path.display(),
            cfg.branch.trim()
        ));
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_site_json(app: tauri::AppHandle, json: String) -> Result<(), String> {
    if json.len() > 256 * 1024 {
        return Err("site.json is too large (max 256 KiB)".into());
    }
    let _: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| format!("invalid JSON: {e}"))?;
    let cfg = load_config(app)?.ok_or("not configured")?;
    let path = site_json_path(&PathBuf::from(&cfg.workdir));
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(
        &serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::write(&path, format!("{pretty}\n")).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn write_registry_asset(
    app: tauri::AppHandle,
    relative_path: String,
    source_path: String,
) -> Result<(), String> {
    let relative = relative_path.trim().replace('\\', "/");
    if !is_safe_registry_asset_path(&relative) {
        return Err(
            "asset path must be meta/cameras/{slug}.png or meta/lenses/{slug}.png".into(),
        );
    }
    let gallery_dir = gallery_root_from_config(&app)?;
    let dest = gallery_dir.join(&relative);
    let src = PathBuf::from(&source_path);
    if !src.is_file() {
        return Err(format!("image file not found: {}", source_path));
    }
    let img = image::open(&src).map_err(|e| format!("could not open image: {e}"))?;
    let resized = resize_to_max_side(&img, 1600);
    let buf = encode_png(&resized)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&dest, buf).map_err(|e| format!("write {relative}: {e}"))?;
    Ok(())
}

#[tauri::command]
fn read_gallery_registry_file(app: tauri::AppHandle, relative_path: String) -> Result<String, String> {
    let relative = relative_path.trim().replace('\\', "/");
    if !is_safe_registry_relative_path(&relative) {
        return Err("registry path must be meta/collections|cameras|lenses/{slug}.json".into());
    }
    let gallery_dir = gallery_root_from_config(&app)?;
    let path = gallery_dir.join(&relative);
    if !path.is_file() {
        return Err(format!("registry file not found: {relative}"));
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_gallery_relative_path(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<String, String> {
    let relative = relative_path.trim().replace('\\', "/");
    if relative.contains("..") || relative.contains('\\') {
        return Err("invalid relative path".into());
    }
    let gallery_dir = gallery_root_from_config(&app)?;
    let path = gallery_dir.join(&relative);
    if !path.is_file() {
        return Err(format!("file not found: {relative}"));
    }
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn write_gallery_registry_file(
    app: tauri::AppHandle,
    relative_path: String,
    json: String,
) -> Result<(), String> {
    let relative = relative_path.trim().replace('\\', "/");
    if !is_safe_registry_relative_path(&relative) {
        return Err("registry path must be meta/collections|cameras|lenses/{slug}.json".into());
    }
    if json.len() > 64 * 1024 {
        return Err("registry JSON is too large (max 64 KiB)".into());
    }
    if serde_json::from_str::<serde_json::Value>(&json).is_err() {
        return Err("registry JSON is invalid".into());
    }
    let gallery_dir = gallery_root_from_config(&app)?;
    let dest = gallery_dir.join(&relative);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&dest, json.as_bytes())
        .map_err(|e| format!("write {relative}: {e}"))?;
    Ok(())
}

fn stage_gallery_files_blocking(
    app: &tauri::AppHandle,
    items: Vec<StageItem>,
) -> Result<Vec<String>, String> {
    let gallery_dir = gallery_root_from_config(app)?;

    let mut copied = Vec::new();
    let total = items.len();
    for (index, it) in items.into_iter().enumerate() {
        if total > 1 {
            emit_upload_progress(
                app,
                format!("Copying photo {} of {} into gallery project…", index + 1, total),
            );
        } else {
            emit_upload_progress(app, "Copying photo into gallery project…");
        }
        validate_dest_filename(&it.dest_filename)?;
        let src = PathBuf::from(&it.source_path);
        if !src.is_file() {
            return Err(format!("source not found: {}", it.source_path));
        }
        let dest = gallery_dir.join(&it.dest_filename);
        if it.skip_image_copy {
            if !dest.is_file() {
                return Err(format!(
                    "gallery image missing for {} (metadata-only update)",
                    it.dest_filename
                ));
            }
        } else {
            copy_or_shrink_for_git(&src, &dest, &it.dest_filename)?;
            if let Some(old_name) = it.remove_dest_filename.as_ref() {
                validate_dest_filename(old_name)?;
                if old_name != &it.dest_filename {
                    let old_path = gallery_dir.join(old_name);
                    if old_path.is_file() {
                        std::fs::remove_file(&old_path).map_err(|e| {
                            format!("remove old gallery file {}: {e}", old_name)
                        })?;
                    }
                }
            }
        }

        if let Some(json) = it.meta_json.as_ref() {
            if json.len() > 64 * 1024 {
                return Err(format!(
                    "metadata for {} is too large (max 64 KiB)",
                    it.dest_filename
                ));
            }
            let stem = Path::new(&it.dest_filename)
                .file_stem()
                .and_then(|s| s.to_str())
                .ok_or_else(|| format!("invalid destination name: {}", it.dest_filename))?;
            if stem.len() != 32
                || !stem
                    .chars()
                    .all(|c| c.is_ascii_digit() || matches!(c, 'a'..='f' | 'A'..='F'))
            {
                return Err(format!(
                    "invalid gallery id in {} (expected 32 hex characters)",
                    it.dest_filename
                ));
            }
            let meta_dir = gallery_dir.join("meta");
            std::fs::create_dir_all(&meta_dir).map_err(|e| e.to_string())?;
            let meta_path = meta_dir.join(format!("{stem}.json"));
            let body = if json.ends_with('\n') {
                json.clone()
            } else {
                format!("{json}\n")
            };
            std::fs::write(&meta_path, body.as_bytes())
                .map_err(|e| format!("write meta/{stem}.json: {e}"))?;

            let thumbs_dir = gallery_dir.join("thumbs");
            let thumb_path = thumbs_dir.join(format!("{stem}.jpg"));
            write_gallery_thumb(&dest, &thumb_path)?;
        }

        copied.push(it.dest_filename);
    }
    invalidate_gallery_hash_cache(app);
    Ok(copied)
}

#[tauri::command]
async fn stage_gallery_files(
    app: tauri::AppHandle,
    items: Vec<StageItem>,
) -> Result<Vec<String>, String> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || stage_gallery_files_blocking(&app, items))
        .await
        .map_err(|e| format!("copy task failed: {e}"))?
}

#[tauri::command]
fn repair_gallery_worktree(app: tauri::AppHandle) -> Result<String, String> {
    let cfg = load_config(app.clone())?.ok_or("not configured")?;
    let pat = pat_entry()?.get_password().map_err(|_| "missing PAT")?;
    let workdir = PathBuf::from(&cfg.workdir);
    let branch = cfg.branch.trim();
    if !is_valid_git_worktree(&workdir) {
        return Err("not a git repository — click “Sync gallery project” first".into());
    }
    let extra = authed_git_extra_args(&pat)?;
    let msg = git_repair_worktree(&workdir, &extra, branch)?;
    invalidate_gallery_hash_cache(&app);
    Ok(msg)
}

fn git_commit_and_push_blocking(
    app: &tauri::AppHandle,
    message: &str,
    publish_mode: Option<&str>,
) -> Result<String, String> {
    let cfg = load_config(app.clone())?.ok_or("not configured")?;
    let pat = pat_entry()?.get_password().map_err(|_| "missing PAT")?;
    let workdir = PathBuf::from(&cfg.workdir);
    let branch = cfg.branch.trim();
    if !is_valid_git_worktree(&workdir) {
        return Err("not a git repository — click “Sync gallery project” first".into());
    }

    let extra = authed_git_extra_args(&pat)?;
    let mode = parse_publish_mode(publish_mode);

    if mode == PublishMode::SkipPull {
        emit_upload_progress(app, "Skipping download — publishing local copy…");
    } else if mode == PublishMode::MergeInstead {
        emit_upload_progress(app, "Pulling latest from GitHub (merge)…");
    } else {
        emit_upload_progress(app, "Pulling latest from GitHub…");
    }
    git_prepare_worktree_for_pull(&workdir, &extra, branch, Some(app))?;
    git_pull_for_publish(&workdir, &extra, branch, mode)?;
    restore_tracked_public_files(&workdir)?;
    run_generate_assets_in_workdir(&workdir, app)?;

    emit_upload_progress(app, "Staging files for commit…");
    // Originals and meta under public/gallery/ are tracked; thumbs/ and display/ are gitignored build output.
    let mut add_paths = vec!["public/gallery"];
    for rel in ["public/site.json", "public/logo.svg", "public/CNAME"] {
        if workdir.join(rel).is_file() {
            add_paths.push(rel);
        }
    }
    let mut add = git_command(&workdir);
    add.arg("add").arg("--");
    for p in &add_paths {
        add.arg(p);
    }
    output_status(&mut add)?;

    let mut staged_names = git_command(&workdir);
    staged_names.arg("diff").arg("--cached").arg("--name-only");
    let staged = output_status(&mut staged_names)?;
    if staged.trim().is_empty() {
        return Err(
            "Nothing staged after git add. \
             If you used Upload, the copy step may have failed, or files on disk match the last commit exactly."
                .into(),
        );
    }

    emit_upload_progress(app, "Creating commit…");
    let mut commit = git_command(&workdir);
    commit.args(["commit", "-m", message]);
    let commit_out = output_status(&mut commit);
    if let Err(e) = commit_out {
        if e.contains("nothing to commit") {
            return Ok("Nothing new to commit.".into());
        }
        return Err(e);
    }

    emit_upload_progress(app, "Pushing to GitHub…");
    git_push_for_publish(&workdir, &extra, branch, mode)?;
    Ok("Committed and pushed.".into())
}

#[tauri::command]
async fn git_commit_and_push(
    app: tauri::AppHandle,
    message: String,
    publish_mode: Option<String>,
) -> Result<String, String> {
    let app = app.clone();
    let mode = publish_mode;
    tauri::async_runtime::spawn_blocking(move || {
        git_commit_and_push_blocking(&app, &message, mode.as_deref())
    })
    .await
    .map_err(|e| format!("publish task failed: {e}"))?
}

fn is_allowed_image_path(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    let ext = ext.to_ascii_lowercase();
    ALLOWED_EXT.iter().any(|allowed| *allowed == ext)
}

fn collect_images_recursive(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| format!("read {}: {e}", dir.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_images_recursive(&path, out)?;
        } else if path.is_file() && is_allowed_image_path(&path) {
            out.push(path);
        }
    }
    Ok(())
}

#[tauri::command]
fn list_images_in_directory(dir: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(dir.trim());
    if !root.is_dir() {
        return Err(format!("not a directory: {}", root.display()));
    }
    let mut paths = Vec::new();
    collect_images_recursive(&root, &mut paths)?;
    paths.sort();
    Ok(paths
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect())
}

fn raw_uploader_version_url(repo_url: &str, branch: &str) -> Result<String, String> {
    let u = Url::parse(repo_url.trim()).map_err(|e| format!("invalid repo URL: {e}"))?;
    let host = u.host_str().unwrap_or("");
    if host != "github.com" && host != "www.github.com" {
        return Err("update check only supports github.com HTTPS repo URLs".into());
    }
    let segments: Vec<&str> = u
        .path()
        .trim_matches('/')
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();
    if segments.len() < 2 {
        return Err("repo URL must look like https://github.com/owner/repo".into());
    }
    let owner = segments[0];
    let repo = segments[1].trim_end_matches(".git");
    let branch = branch.trim();
    Ok(format!(
        "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/tools/gallery-uploader/uploader-version.json"
    ))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub download_url: Option<String>,
    pub notes: Option<String>,
    pub update_available: bool,
}

#[tauri::command]
fn check_for_app_update(app: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    let current = app.package_info().version.to_string();
    let cfg = match load_config(app)? {
        Some(c) => c,
        None => {
            return Ok(UpdateCheckResult {
                current_version: current,
                latest_version: None,
                download_url: None,
                notes: None,
                update_available: false,
            });
        }
    };
    let url = raw_uploader_version_url(&cfg.repo_url, &cfg.branch)?;
    let body = ureq::get(&url)
        .call()
        .map_err(|e| format!("could not fetch version info: {e}"))?
        .into_string()
        .map_err(|e| e.to_string())?;
    let value: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("invalid version JSON: {e}"))?;
    let latest = value
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let download_url = value
        .get("downloadUrl")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let notes = value
        .get("notes")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let update_available = latest
        .as_ref()
        .map(|l| l != &current)
        .unwrap_or(false);
    Ok(UpdateCheckResult {
        current_version: current,
        latest_version: latest,
        download_url,
        notes,
        update_available,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_config,
            load_draft_session,
            save_draft_session,
            clear_draft_session,
            save_config,
            save_pat,
            has_pat,
            clear_pat,
            read_image_hints,
            read_exif_publish_raw,
            gallery_dest_exists,
            ensure_repo_ready,
            list_gallery_registries,
            list_gallery_images,
            list_gallery_tags,
            get_gallery_photo_for_edit,
            read_site_json,
            write_site_json,
            read_gallery_registry_file,
            resolve_gallery_relative_path,
            write_gallery_registry_file,
            write_registry_asset,
            stage_gallery_files,
            git_commit_and_push,
            repair_gallery_worktree,
            list_images_in_directory,
            check_duplicate_paths,
            check_for_app_update,
            ensure_display_preview,
            load_upload_preferences,
            save_upload_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
