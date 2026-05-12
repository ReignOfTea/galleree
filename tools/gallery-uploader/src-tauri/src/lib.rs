#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use chrono::{Local, MappedLocalTime, NaiveDateTime};
use exif::{In, Reader as ExifReader, Tag};
use serde::{Deserialize, Serialize};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;
use url::Url;

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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageItem {
    pub source_path: String,
    pub dest_filename: String,
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
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c
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
                });
            }
        },
        Err(_) => {
            return Ok(ImageHints {
                description: None,
                date_time_original_iso: None,
                make: None,
                model: None,
            });
        }
    };

    let description = field_ascii(&exif, Tag::ImageDescription);

    let make = field_ascii(&exif, Tag::Make);
    let model = field_ascii(&exif, Tag::Model);

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
    })
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
    let cfg = load_config(app)?.ok_or("Save repository settings first.")?;
    let pat = pat_entry()?.get_password().map_err(|_| {
        "No Git token saved. Add a GitHub personal access token with repo scope.".to_string()
    })?;
    let workdir = PathBuf::from(&cfg.workdir);
    let branch = cfg.branch.trim();

    if workdir.join(".git").is_dir() {
        ensure_galleree_layout(&workdir)?;
        let extra = authed_git_extra_args(&pat)?;
        let mut pull = git_command(&workdir);
        pull.arg(&extra[0])
            .arg(&extra[1])
            .args(["pull", "--rebase", "origin", branch]);
        output_status(&mut pull)?;
        return Ok("Repository is ready (pulled latest).".into());
    }

    let url = https_url_with_pat(&cfg.repo_url, &pat)?;

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
        clone.args(["clone", "--branch", branch, "--", &url]).arg(&workdir);
        output_status(&mut clone)?;
        ensure_galleree_layout(&workdir)?;
        return Ok("Repository cloned.".into());
    }

    let mut read_dir = std::fs::read_dir(&workdir).map_err(|e| e.to_string())?;
    if read_dir.next().is_some() {
        return Err(
            "Work directory exists but is not a git clone. Delete that folder and try again, or change the repository URL."
                .into(),
        );
    }

    let mut clone = Command::new("git");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        clone.creation_flags(0x0800_0000);
    }
    clone
        .current_dir(&workdir)
        .args(["clone", "--branch", branch, "--", &url, "."]);
    output_status(&mut clone)?;
    ensure_galleree_layout(&workdir)?;
    Ok("Repository cloned.".into())
}

const ALLOWED_EXT: &[&str] = &["jpg", "jpeg", "png", "webp", "avif", "gif"];

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
fn stage_gallery_files(app: tauri::AppHandle, items: Vec<StageItem>) -> Result<Vec<String>, String> {
    let cfg = load_config(app)?.ok_or("not configured")?;
    let workdir = PathBuf::from(&cfg.workdir);
    let gallery_dir = workdir.join("public").join("gallery");
    if !gallery_dir.is_dir() {
        return Err("public/gallery missing — run “Prepare repository” first.".into());
    }

    let mut copied = Vec::new();
    for it in items {
        validate_dest_filename(&it.dest_filename)?;
        let src = PathBuf::from(&it.source_path);
        if !src.is_file() {
            return Err(format!("source not found: {}", it.source_path));
        }
        let dest = gallery_dir.join(&it.dest_filename);
        std::fs::copy(&src, &dest).map_err(|e| format!("copy {}: {e}", it.dest_filename))?;
        copied.push(it.dest_filename);
    }
    Ok(copied)
}

#[tauri::command]
fn git_commit_and_push(app: tauri::AppHandle, message: String) -> Result<String, String> {
    let cfg = load_config(app)?.ok_or("not configured")?;
    let pat = pat_entry()?.get_password().map_err(|_| "missing PAT")?;
    let workdir = PathBuf::from(&cfg.workdir);
    let branch = cfg.branch.trim();
    if !workdir.join(".git").is_dir() {
        return Err("not a git repository — prepare the clone first".into());
    }

    let extra = authed_git_extra_args(&pat)?;

    let mut pull = git_command(&workdir);
    pull.arg(&extra[0])
        .arg(&extra[1])
        .args(["pull", "--rebase", "origin", branch]);
    output_status(&mut pull)?;

    // Gallery binaries are gitignored in galleree (see .gitignore); normal `git add` skips them.
    let mut add = git_command(&workdir);
    add.args(["add", "-f", "--", "public/gallery"]);
    output_status(&mut add)?;

    let mut staged_names = git_command(&workdir);
    staged_names.args([
        "diff",
        "--cached",
        "--name-only",
        "--",
        "public/gallery",
    ]);
    let staged = output_status(&mut staged_names)?;
    if staged.trim().is_empty() {
        return Err(
            "Nothing staged under public/gallery after git add -f. \
             If you used Upload pics, the copy step may have failed, or files on disk match the last commit exactly."
                .into(),
        );
    }

    let mut commit = git_command(&workdir);
    commit.args(["commit", "-m", &message]);
    let commit_out = output_status(&mut commit);
    if let Err(e) = commit_out {
        if e.contains("nothing to commit") {
            return Ok("Nothing new to commit.".into());
        }
        return Err(e);
    }

    let mut push = git_command(&workdir);
    push.arg(&extra[0])
        .arg(&extra[1])
        .args(["push", "origin", &format!("HEAD:{branch}")]);
    output_status(&mut push)?;
    Ok("Committed and pushed.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            save_pat,
            has_pat,
            clear_pat,
            read_image_hints,
            gallery_dest_exists,
            ensure_repo_ready,
            stage_gallery_files,
            git_commit_and_push,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
