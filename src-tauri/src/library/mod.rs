use crate::{
    dto::{ImportSummary, TrackDto, TrackTagDto},
    error::{AppError, AppResult},
};
use blake3::Hasher;
use sqlx::SqlitePool;
use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use symphonia::core::{
    formats::FormatOptions, io::MediaSourceStream, meta::MetadataOptions, probe::Hint,
};
use uuid::Uuid;
use walkdir::WalkDir;

const TRACK_FIELDS: &str = "id,file_path,file_name,file_size,modified_at,title,artist,album,album_artist,genre,year,track_number,duration_ms,sample_rate,channels,codec,added_at,last_played_at,play_count,is_favorite,is_missing";
const SUPPORTED: [&str; 3] = ["mp3", "flac", "wav"];

fn timestamp(metadata: &std::fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as i64)
        .unwrap_or_default()
}

fn fingerprint(path: &Path, size: u64) -> AppResult<String> {
    let mut file = File::open(path)?;
    let mut hasher = Hasher::new();
    hasher.update(&size.to_le_bytes());
    let sample = 64 * 1024usize;
    let mut buffer = vec![0_u8; sample.min(size as usize)];
    file.read_exact(&mut buffer)?;
    hasher.update(&buffer);
    if size > sample as u64 {
        file.seek(SeekFrom::End(-(sample.min(size as usize) as i64)))?;
        let read = file.read(&mut buffer)?;
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

fn audio_info(path: &Path) -> AppResult<(i64, Option<i64>, Option<i64>, Option<String>)> {
    let file = File::open(path)?;
    let stream = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(extension) = path.extension().and_then(|value| value.to_str()) {
        hint.with_extension(extension);
    }
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            stream,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|error| AppError::new("UNSUPPORTED_FORMAT", error.to_string()))?;
    let params = &probed
        .format
        .default_track()
        .ok_or_else(|| AppError::new("UNSUPPORTED_FORMAT", "В файле нет аудиодорожки"))?
        .codec_params;
    let sample_rate = params.sample_rate.map(i64::from);
    let channels = params.channels.map(|value| value.count() as i64);
    let duration = match (params.n_frames, params.sample_rate) {
        (Some(frames), Some(rate)) => (frames.saturating_mul(1000) / u64::from(rate)) as i64,
        _ => 0,
    };
    let codec = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_uppercase());
    Ok((duration, sample_rate, channels, codec))
}

async fn attach_tags(db: &SqlitePool, tracks: &mut [TrackDto]) -> AppResult<()> {
    if tracks.is_empty() {
        return Ok(());
    }
    let tags = sqlx::query_as::<_, TrackTagDto>(
        "SELECT id,track_id,label,color,created_at FROM track_tags ORDER BY created_at",
    )
    .fetch_all(db)
    .await?;
    let mut tags_by_track = HashMap::<String, Vec<TrackTagDto>>::new();
    for tag in tags {
        tags_by_track
            .entry(tag.track_id.clone())
            .or_default()
            .push(tag);
    }
    for track in tracks {
        track.tags = tags_by_track.remove(&track.id).unwrap_or_default();
    }
    Ok(())
}

pub async fn all(db: &SqlitePool) -> AppResult<Vec<TrackDto>> {
    let mut tracks = sqlx::query_as::<_, TrackDto>(&format!(
        "SELECT {TRACK_FIELDS} FROM tracks ORDER BY added_at DESC"
    ))
    .fetch_all(db)
    .await?;
    attach_tags(db, &mut tracks).await?;
    Ok(tracks)
}

pub async fn one(db: &SqlitePool, id: &str) -> AppResult<TrackDto> {
    let track =
        sqlx::query_as::<_, TrackDto>(&format!("SELECT {TRACK_FIELDS} FROM tracks WHERE id=?"))
            .bind(id)
            .fetch_optional(db)
            .await?
            .ok_or_else(|| AppError::not_found("Трек не найден"))?;
    let mut tracks = vec![track];
    attach_tags(db, &mut tracks).await?;
    tracks
        .pop()
        .ok_or_else(|| AppError::not_found("Трек не найден"))
}

async fn import_one(db: &SqlitePool, path: &Path, summary: &mut ImportSummary) -> AppResult<()> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !SUPPORTED.contains(&extension.as_str()) {
        summary.unsupported += 1;
        return Ok(());
    }
    let canonical = path.canonicalize()?;
    let canonical_text = canonical.to_string_lossy().to_string();
    let metadata = canonical.metadata()?;
    if !metadata.is_file() {
        return Err(AppError::validation("Путь не является файлом"));
    }
    let file_size = metadata.len() as i64;
    let modified_at = timestamp(&metadata);
    let existing = sqlx::query_as::<_, (String, i64, i64)>(
        "SELECT id,file_size,modified_at FROM tracks WHERE file_path=?",
    )
    .bind(&canonical_text)
    .fetch_optional(db)
    .await?;
    if existing
        .as_ref()
        .is_some_and(|(_, size, modified)| *size == file_size && *modified == modified_at)
    {
        summary.skipped += 1;
        return Ok(());
    }
    let (duration, sample_rate, channels, codec) = audio_info(&canonical)?;
    let file_name = canonical
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio")
        .to_string();
    let title = canonical
        .file_stem()
        .and_then(|value| value.to_str())
        .map(str::to_string);
    let now = chrono::Utc::now().timestamp_millis();
    let id = existing
        .as_ref()
        .map(|value| value.0.clone())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let hash = fingerprint(&canonical, metadata.len())?;
    sqlx::query("INSERT INTO tracks(id,file_path,file_name,file_size,modified_at,content_fingerprint,title,duration_ms,sample_rate,channels,codec,added_at,updated_at,is_missing) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0) ON CONFLICT(file_path) DO UPDATE SET file_name=excluded.file_name,file_size=excluded.file_size,modified_at=excluded.modified_at,content_fingerprint=excluded.content_fingerprint,title=COALESCE(tracks.title,excluded.title),duration_ms=excluded.duration_ms,sample_rate=excluded.sample_rate,channels=excluded.channels,codec=excluded.codec,updated_at=excluded.updated_at,is_missing=0")
        .bind(id).bind(canonical_text).bind(file_name).bind(file_size).bind(modified_at).bind(hash).bind(title).bind(duration).bind(sample_rate).bind(channels).bind(codec).bind(now).bind(now).execute(db).await?;
    if existing.is_some() {
        summary.updated += 1;
    } else {
        summary.imported += 1;
    }
    Ok(())
}

pub async fn import_paths(db: &SqlitePool, paths: Vec<PathBuf>) -> ImportSummary {
    let mut summary = ImportSummary::default();
    for path in paths {
        if let Err(error) = import_one(db, &path, &mut summary).await {
            summary.failed += 1;
            summary
                .errors
                .push(format!("{}: {}", path.display(), error));
        }
    }
    summary
}

pub async fn import_directory(db: &SqlitePool, root: PathBuf) -> AppResult<ImportSummary> {
    let canonical = root.canonicalize()?;
    if !canonical.is_dir() {
        return Err(AppError::validation("Выбранный путь не является папкой"));
    }
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("INSERT INTO library_roots(id,path,created_at,last_scan_at) VALUES(?,?,?,?) ON CONFLICT(path) DO UPDATE SET enabled=1,last_scan_at=excluded.last_scan_at")
        .bind(Uuid::new_v4().to_string()).bind(canonical.to_string_lossy().to_string()).bind(now).bind(now).execute(db).await?;
    let paths = WalkDir::new(&canonical)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .collect();
    Ok(import_paths(db, paths).await)
}

pub async fn check_missing(db: &SqlitePool) -> AppResult<Vec<TrackDto>> {
    let paths = sqlx::query_as::<_, (String, String)>("SELECT id,file_path FROM tracks")
        .fetch_all(db)
        .await?;
    let mut transaction = db.begin().await?;
    for (id, path) in paths {
        sqlx::query("UPDATE tracks SET is_missing=? WHERE id=?")
            .bind(!Path::new(&path).is_file())
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    all(db).await
}
