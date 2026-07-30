use crate::{
    audio::AudioEngine,
    database,
    dto::PlaybackQueueDto,
    equalizer,
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
        let volume = sqlx::query_scalar::<_, String>(
            "SELECT value_json FROM settings WHERE key = 'playback_volume'",
        )
        .fetch_optional(&db)
        .await?
        .and_then(|value| serde_json::from_str::<f32>(&value).ok())
        .unwrap_or(0.8)
        .clamp(0.0, 1.0);
        let repeat = sqlx::query_scalar::<_, String>(
            "SELECT value_json FROM settings WHERE key = 'playback_repeat'",
        )
        .fetch_optional(&db)
        .await?
        .and_then(|value| serde_json::from_str::<String>(&value).ok())
        .filter(|value| matches!(value.as_str(), "off" | "all" | "one"))
        .unwrap_or_else(|| "off".into());
        let shuffle = sqlx::query_scalar::<_, String>(
            "SELECT value_json FROM settings WHERE key = 'playback_shuffle'",
        )
        .fetch_optional(&db)
        .await?
        .and_then(|value| serde_json::from_str::<bool>(&value).ok())
        .unwrap_or(false);
        let equalizer_state = equalizer::load_state(&db).await?;
        let audio = Arc::new(AudioEngine::new()?);
        audio.set_volume(volume);
        audio.set_repeat(&repeat);
        audio.set_shuffle(shuffle);
        audio.set_equalizer(
            equalizer_state.enabled,
            &equalizer_state.bands,
            equalizer_state.preamp_db,
        );
        Ok(Self {
            db,
            data_dir,
            queue: Arc::new(RwLock::new(queue)),
            audio,
        })
    }
}
