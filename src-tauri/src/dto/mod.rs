use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackDto {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub modified_at: i64,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub track_number: Option<i64>,
    pub duration_ms: i64,
    pub sample_rate: Option<i64>,
    pub channels: Option<i64>,
    pub codec: Option<String>,
    pub added_at: i64,
    pub last_played_at: Option<i64>,
    pub play_count: i64,
    pub is_favorite: bool,
    pub is_missing: bool,
    #[sqlx(skip)]
    pub tags: Vec<TrackTagDto>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackTagDto {
    pub id: String,
    pub track_id: String,
    pub label: String,
    pub color: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EqualizerStateDto {
    pub enabled: bool,
    pub bands: Vec<f32>,
    pub preamp_db: f32,
    pub active_preset_id: Option<String>,
}

impl Default for EqualizerStateDto {
    fn default() -> Self {
        Self {
            enabled: false,
            bands: vec![0.0; 10],
            preamp_db: 0.0,
            active_preset_id: Some("builtin-flat".into()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EqualizerPresetDto {
    pub id: String,
    pub name: String,
    pub is_builtin: bool,
    pub bands: Vec<f32>,
    pub preamp_db: f32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EqualizerBundleDto {
    pub frequencies: Vec<f32>,
    pub state: EqualizerStateDto,
    pub presets: Vec<EqualizerPresetDto>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub imported: u32,
    pub updated: u32,
    pub skipped: u32,
    pub unsupported: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub is_pinned: bool,
    pub position: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub track_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItemDto {
    pub id: String,
    pub playlist_id: String,
    pub track_id: String,
    pub position: i64,
    pub added_at: i64,
    pub track: TrackDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDetailsDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub is_pinned: bool,
    pub position: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub track_count: i64,
    pub items: Vec<PlaylistItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum QueueSource {
    Playlist {
        #[serde(rename = "playlistId")]
        playlist_id: String,
    },
    Library,
    Favorites,
    Recent,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackQueueDto {
    pub source: Option<QueueSource>,
    pub item_ids: Vec<String>,
    pub current_index: i32,
    pub history: Vec<String>,
}

impl Default for PlaybackQueueDto {
    fn default() -> Self {
        Self {
            source: None,
            item_ids: Vec::new(),
            current_index: -1,
            history: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackAnalysisDto {
    pub track_id: String,
    pub status: String,
    pub progress: f64,
    pub integrated_lufs: Option<f64>,
    pub true_peak_db: Option<f64>,
    pub dynamic_range_db: Option<f64>,
    pub analyzed_at: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformPoint {
    pub min: f32,
    pub max: f32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeakFrame {
    pub time_ms: u32,
    pub peak_db: f32,
    pub rms_db: f32,
    pub crest_factor_db: f32,
    pub clipping_samples: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisCache {
    pub waveform: Vec<WaveformPoint>,
    pub peaks: Vec<PeakFrame>,
}
