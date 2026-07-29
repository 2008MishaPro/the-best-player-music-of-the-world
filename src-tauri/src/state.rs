use crate::{
    audio::AudioEngine,
    database,
    dto::PlaybackQueueDto,
    error::{AppError, AppResult},
};
use sqlx::SqlitePool;
use std::{
    path::PathBuf,
    sync::{Arc, RwLock},
};
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub db: SqlitePool,
    pub data_dir: PathBuf,
    pub queue: Arc<RwLock<PlaybackQueueDto>>,
    pub audio: Arc<AudioEngine>,
}

impl AppState {
    pub async fn initialize(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| AppError::new("UNKNOWN", error.to_string()))?;
        for path in [
            data_dir.clone(),
            data_dir.join("logs"),
            data_dir.join("cache/waveforms"),
            data_dir.join("cache/peaks"),
            data_dir.join("cache/analysis"),
        ] {
            std::fs::create_dir_all(path)?;
        }
        let db = database::connect(&data_dir.join("library.sqlite")).await?;
        let queue = sqlx::query_scalar::<_, String>(
            "SELECT value_json FROM settings WHERE key = 'playback_queue'",
        )
        .fetch_optional(&db)
        .await?
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_default();
        let audio = Arc::new(AudioEngine::new()?);
        Ok(Self {
            db,
            data_dir,
            queue: Arc::new(RwLock::new(queue)),
            audio,
        })
    }
}
