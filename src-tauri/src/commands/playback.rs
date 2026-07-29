use crate::{
    audio::PlaybackSnapshot,
    error::{AppError, AppResult},
    state::AppState,
};
use std::path::PathBuf;
use tauri::State;

async fn path_for(state: &AppState, id: &str) -> AppResult<PathBuf> {
    let path: Option<String> =
        sqlx::query_scalar("SELECT file_path FROM tracks WHERE id=? AND is_missing=0")
            .bind(id)
            .fetch_optional(&state.db)
            .await?;
    Ok(PathBuf::from(path.ok_or_else(|| {
        AppError::new("FILE_MISSING", "Файл трека не найден")
    })?))
}
#[tauri::command]
pub async fn playback_load(
    track_id: String,
    state: State<'_, AppState>,
) -> AppResult<PlaybackSnapshot> {
    let path = path_for(&state, &track_id).await?;
    state.audio.load(track_id, path, 0)
}
#[tauri::command]
pub fn playback_play(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    state.audio.play()
}
#[tauri::command]
pub fn playback_pause(state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.pause()
}
#[tauri::command]
pub fn playback_stop(state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.stop()
}
#[tauri::command]
pub fn playback_seek(position_ms: u64, state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    state.audio.seek(position_ms)
}
#[tauri::command]
pub fn playback_set_volume(volume: f32, state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.set_volume(volume)
}
#[tauri::command]
pub fn playback_set_repeat(repeat: String, state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.set_repeat(&repeat)
}
#[tauri::command]
pub fn playback_set_shuffle(shuffle: bool, state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.set_shuffle(shuffle)
}
#[tauri::command]
pub fn playback_get_snapshot(state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.snapshot()
}
#[tauri::command]
pub async fn playback_next(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    let id = {
        let mut queue = state
            .queue
            .write()
            .map_err(|_| AppError::playback("Очередь недоступна"))?;
        if queue.item_ids.is_empty() {
            return Err(AppError::playback("Очередь пуста"));
        }
        queue.current_index = (queue.current_index + 1).min(queue.item_ids.len() as i32 - 1);
        queue.item_ids[queue.current_index as usize].clone()
    };
    let path = path_for(&state, &id).await?;
    state.audio.load(id, path, 0)?;
    state.audio.play()
}
#[tauri::command]
pub async fn playback_previous(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    let id = {
        let mut queue = state
            .queue
            .write()
            .map_err(|_| AppError::playback("Очередь недоступна"))?;
        if queue.item_ids.is_empty() {
            return Err(AppError::playback("Очередь пуста"));
        }
        queue.current_index = (queue.current_index - 1).max(0);
        queue.item_ids[queue.current_index as usize].clone()
    };
    let path = path_for(&state, &id).await?;
    state.audio.load(id, path, 0)?;
    state.audio.play()
}
