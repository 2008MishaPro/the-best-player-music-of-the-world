use crate::{
    dto::{ImportSummary, TrackDto},
    error::AppResult,
    library,
    state::AppState,
};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn library_get_tracks(state: State<'_, AppState>) -> AppResult<Vec<TrackDto>> {
    library::all(&state.db).await
}
#[tauri::command]
pub async fn library_get_track(
    track_id: String,
    state: State<'_, AppState>,
) -> AppResult<TrackDto> {
    library::one(&state.db, &track_id).await
}
#[tauri::command]
pub async fn library_import_files(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<ImportSummary> {
    Ok(library::import_paths(&state.db, paths.into_iter().map(PathBuf::from).collect()).await)
}
#[tauri::command]
pub async fn library_import_directory(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<ImportSummary> {
    library::import_directory(&state.db, PathBuf::from(path)).await
}
#[tauri::command]
pub async fn library_check_missing(state: State<'_, AppState>) -> AppResult<Vec<TrackDto>> {
    library::check_missing(&state.db).await
}
#[tauri::command]
pub async fn library_set_favorite(
    track_id: String,
    favorite: bool,
    state: State<'_, AppState>,
) -> AppResult<TrackDto> {
    sqlx::query("UPDATE tracks SET is_favorite=?,updated_at=? WHERE id=?")
        .bind(favorite)
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(&track_id)
        .execute(&state.db)
        .await?;
    library::one(&state.db, &track_id).await
}
#[tauri::command]
pub async fn library_remove_track(track_id: String, state: State<'_, AppState>) -> AppResult<()> {
    sqlx::query("DELETE FROM tracks WHERE id=?")
        .bind(track_id)
        .execute(&state.db)
        .await?;
    Ok(())
}
