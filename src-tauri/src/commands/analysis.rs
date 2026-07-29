use crate::{
    analysis::{self, ANALYSIS_VERSION},
    dto::{AnalysisCache, PeakFrame, TrackAnalysisDto, WaveformPoint},
    error::{AppError, AppResult},
    state::AppState,
};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn analysis_start(
    track_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<TrackAnalysisDto> {
    let (path, modified): (String, i64) =
        sqlx::query_as("SELECT file_path,modified_at FROM tracks WHERE id=?")
            .bind(&track_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::not_found("Трек не найден"))?;
    sqlx::query("INSERT INTO track_analysis(track_id,analysis_version,source_modified_at,status,progress) VALUES(?,?,?,'running',0) ON CONFLICT(track_id) DO UPDATE SET analysis_version=excluded.analysis_version,source_modified_at=excluded.source_modified_at,status='running',progress=0,error=NULL").bind(&track_id).bind(ANALYSIS_VERSION).bind(modified).execute(&state.db).await?;
    let initial = analysis::status(&state.db, &track_id).await?;
    let _ = app.emit("analysis://progress", &initial);
    let db = state.db.clone();
    let data_dir = state.data_dir.clone();
    let task_id = track_id.clone();
    tauri::async_runtime::spawn(async move {
        let path_buf = std::path::PathBuf::from(path);
        let result =
            tauri::async_runtime::spawn_blocking(move || analysis::analyze(&path_buf)).await;
        match result {
            Ok(Ok((cache, lufs, peak, dynamic))) => {
                let cache_path = analysis::cache_path(&data_dir, &task_id);
                let saved = serde_json::to_vec(&cache)
                    .map_err(|e| e.to_string())
                    .and_then(|bytes| {
                        std::fs::write(&cache_path, bytes).map_err(|e| e.to_string())
                    });
                if let Err(error) = saved {
                    let _ = sqlx::query(
                        "UPDATE track_analysis SET status='failed',error=? WHERE track_id=?",
                    )
                    .bind(error)
                    .bind(&task_id)
                    .execute(&db)
                    .await;
                } else {
                    let _=sqlx::query("UPDATE track_analysis SET status='ready',progress=1,waveform_path=?,peaks_path=?,integrated_lufs=?,true_peak_db=?,dynamic_range_db=?,analyzed_at=? WHERE track_id=?").bind(cache_path.to_string_lossy().to_string()).bind(cache_path.to_string_lossy().to_string()).bind(lufs).bind(peak).bind(dynamic).bind(chrono::Utc::now().timestamp_millis()).bind(&task_id).execute(&db).await;
                }
            }
            Ok(Err(error)) => {
                let _ = sqlx::query(
                    "UPDATE track_analysis SET status='failed',error=? WHERE track_id=?",
                )
                .bind(error.to_string())
                .bind(&task_id)
                .execute(&db)
                .await;
            }
            Err(error) => {
                let _ = sqlx::query(
                    "UPDATE track_analysis SET status='failed',error=? WHERE track_id=?",
                )
                .bind(error.to_string())
                .bind(&task_id)
                .execute(&db)
                .await;
            }
        }
        if let Ok(status) = analysis::status(&db, &task_id).await {
            let _ = app.emit("analysis://progress", status);
        }
    });
    Ok(initial)
}
#[tauri::command]
pub async fn analysis_get_status(
    track_id: String,
    state: State<'_, AppState>,
) -> AppResult<TrackAnalysisDto> {
    analysis::status(&state.db, &track_id).await
}
async fn cache(track_id: &str, state: &AppState) -> AppResult<AnalysisCache> {
    let path: Option<String> = sqlx::query_scalar(
        "SELECT waveform_path FROM track_analysis WHERE track_id=? AND status='ready'",
    )
    .bind(track_id)
    .fetch_optional(&state.db)
    .await?
    .flatten();
    let bytes = std::fs::read(path.ok_or_else(|| AppError::not_found("Кэш анализа не найден"))?)?;
    serde_json::from_slice(&bytes).map_err(|e| AppError::analysis(e.to_string()))
}
#[tauri::command]
pub async fn analysis_get_waveform(
    track_id: String,
    start_ms: u64,
    end_ms: Option<u64>,
    level: u8,
    state: State<'_, AppState>,
) -> AppResult<Vec<WaveformPoint>> {
    let data = cache(&track_id, &state).await?.waveform;
    let step = 1usize << level.min(3);
    let start = (start_ms / 100) as usize;
    let end = end_ms
        .map(|v| (v / 100) as usize)
        .unwrap_or(data.len())
        .min(data.len());
    Ok(data
        .get(start.min(end)..end)
        .unwrap_or(&[])
        .iter()
        .step_by(step)
        .cloned()
        .collect())
}
#[tauri::command]
pub async fn analysis_get_peak_map(
    track_id: String,
    state: State<'_, AppState>,
) -> AppResult<Vec<PeakFrame>> {
    Ok(cache(&track_id, &state).await?.peaks)
}
#[tauri::command]
pub async fn analysis_cancel(track_id: String, state: State<'_, AppState>) -> AppResult<()> {
    sqlx::query("UPDATE track_analysis SET status='failed',error='Отменено пользователем' WHERE track_id=? AND status='running'").bind(track_id).execute(&state.db).await?;
    Ok(())
}
