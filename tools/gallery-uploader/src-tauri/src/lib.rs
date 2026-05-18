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
use std::io::{BufReader, Cursor};
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
    pub meta_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryCollection {
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
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
        out.push(RegistryCollection {
            slug,
            title: title.to_string(),
            description,
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

/// GitHub rejects new blobs ≥ 100 MiB; stay slightly under so pushes succeed.
/// See: <https://docs.github.com/repositories/working-with-files/managing-large-files/about-large-files-on-github>
const GITHUB_BLOB_MAX_BYTES: u64 = 100 * 1024 * 1024 / 2; // half of 100 MiB

/// Largest staged file size we allow without re-encoding, and the target cap after shrinking.
const SAFE_MAX_STAGED_BYTES: u64 = GITHUB_BLOB_MAX_BYTES - 256 * 1024;

const LARGE_FILE_BYTES: u64 = SAFE_MAX_STAGED_BYTES;

const TARGET_STAGED_BYTES: u64 = SAFE_MAX_STAGED_BYTES;

const MIN_LONG_EDGE: u32 = 960;

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

#[tauri::command]
fn stage_gallery_files(app: tauri::AppHandle, items: Vec<StageItem>) -> Result<Vec<String>, String> {
    let gallery_dir = gallery_root_from_config(&app)?;

    let mut copied = Vec::new();
    for it in items {
        validate_dest_filename(&it.dest_filename)?;
        let src = PathBuf::from(&it.source_path);
        if !src.is_file() {
            return Err(format!("source not found: {}", it.source_path));
        }
        let dest = gallery_dir.join(&it.dest_filename);
        copy_or_shrink_for_git(&src, &dest, &it.dest_filename)?;

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
            std::fs::write(&meta_path, json.as_bytes())
                .map_err(|e| format!("write meta/{stem}.json: {e}"))?;
        }

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

    // Gallery images, meta, and thumbs are gitignored (see .gitignore); normal `git add` skips them.
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
            list_gallery_registries,
            list_gallery_images,
            write_gallery_registry_file,
            write_registry_asset,
            stage_gallery_files,
            git_commit_and_push,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
