use crate::{
    dto::TrackDto,
    error::{AppError, AppResult},
    library,
    state::AppState,
};
use tauri::State;
use uuid::Uuid;

const TAG_COLORS: [&str; 7] = [
    "amber", "rose", "violet", "blue", "cyan", "emerald", "slate",
];

#[tauri::command]
pub async fn track_tag_create(
    track_id: String,
    label: String,
    color: String,
    state: State<'_, AppState>,
) -> AppResult<TrackDto> {
    let label = label.trim();
    let length = label.chars().count();
    if !(1..=24).contains(&length) {
        return Err(AppError::validation(
            "Тег должен содержать от 1 до 24 символов",
        ));
    }
    if !TAG_COLORS.contains(&color.as_str()) {
        return Err(AppError::validation("Выбран недопустимый цвет тега"));
    }
    library::one(&state.db, &track_id).await?;
    let duplicate: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM track_tags WHERE track_id=? AND label=? COLLATE NOCASE",
    )
    .bind(&track_id)
    .bind(label)
    .fetch_one(&state.db)
    .await?;
    if duplicate > 0 {
        return Err(AppError::validation("Такой тег у трека уже есть"));
    }
    sqlx::query("INSERT INTO track_tags(id,track_id,label,color,created_at) VALUES(?,?,?,?,?)")
        .bind(Uuid::new_v4().to_string())
        .bind(&track_id)
        .bind(label)
        .bind(color)
        .bind(chrono::Utc::now().timestamp_millis())
        .execute(&state.db)
        .await?;
    library::one(&state.db, &track_id).await
}

#[tauri::command]
pub async fn track_tag_delete(
    track_id: String,
    tag_id: String,
    state: State<'_, AppState>,
) -> AppResult<TrackDto> {
    sqlx::query("DELETE FROM track_tags WHERE id=? AND track_id=?")
        .bind(tag_id)
        .bind(&track_id)
        .execute(&state.db)
        .await?;
    library::one(&state.db, &track_id).await
}
