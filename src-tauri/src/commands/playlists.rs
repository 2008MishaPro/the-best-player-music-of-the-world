use crate::{
    dto::{PlaylistDetailsDto, PlaylistDto, PlaylistItemDto},
    error::{AppError, AppResult},
    library,
    state::AppState,
};
use tauri::State;
use uuid::Uuid;

async fn get_all(state: &AppState) -> AppResult<Vec<PlaylistDto>> {
    Ok(sqlx::query_as::<_, PlaylistDto>("SELECT p.id,p.name,p.description,p.cover_path,p.is_pinned,p.position,p.created_at,p.updated_at,COUNT(pt.id) AS track_count FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id GROUP BY p.id ORDER BY p.is_pinned DESC,p.position,p.updated_at DESC").fetch_all(&state.db).await?)
}

async fn get_playlist(state: &AppState, id: &str) -> AppResult<PlaylistDto> {
    sqlx::query_as::<_, PlaylistDto>("SELECT p.id,p.name,p.description,p.cover_path,p.is_pinned,p.position,p.created_at,p.updated_at,COUNT(pt.id) AS track_count FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id WHERE p.id=? GROUP BY p.id")
        .bind(id).fetch_optional(&state.db).await?.ok_or_else(|| AppError::not_found("Плейлист не найден"))
}

#[tauri::command]
pub async fn playlist_get_all(state: State<'_, AppState>) -> AppResult<Vec<PlaylistDto>> {
    get_all(&state).await
}

#[tauri::command]
pub async fn playlist_get_by_id(
    playlist_id: String,
    state: State<'_, AppState>,
) -> AppResult<PlaylistDetailsDto> {
    let playlist = get_playlist(&state, &playlist_id).await?;
    let rows = sqlx::query_as::<_, (String, String, i64, i64)>("SELECT id,track_id,position,added_at FROM playlist_tracks WHERE playlist_id=? ORDER BY position").bind(&playlist_id).fetch_all(&state.db).await?;
    let mut items = Vec::with_capacity(rows.len());
    for (id, track_id, position, added_at) in rows {
        let track = library::one(&state.db, &track_id).await?;
        items.push(PlaylistItemDto {
            id,
            playlist_id: playlist_id.clone(),
            track_id,
            position,
            added_at,
            track,
        });
    }
    Ok(PlaylistDetailsDto {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        cover_path: playlist.cover_path,
        is_pinned: playlist.is_pinned,
        position: playlist.position,
        created_at: playlist.created_at,
        updated_at: playlist.updated_at,
        track_count: playlist.track_count,
        items,
    })
}

#[tauri::command]
pub async fn playlist_create(name: String, state: State<'_, AppState>) -> AppResult<PlaylistDto> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::validation("Название не может быть пустым"));
    }
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let position: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position),-1)+1 FROM playlists")
        .fetch_one(&state.db)
        .await?;
    sqlx::query("INSERT INTO playlists(id,name,position,created_at,updated_at) VALUES(?,?,?,?,?)")
        .bind(&id)
        .bind(name)
        .bind(position)
        .bind(now)
        .bind(now)
        .execute(&state.db)
        .await?;
    get_playlist(&state, &id).await
}

#[tauri::command]
pub async fn playlist_update(
    playlist_id: String,
    name: String,
    description: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<PlaylistDto> {
    if name.trim().is_empty() {
        return Err(AppError::validation("Название не может быть пустым"));
    }
    sqlx::query("UPDATE playlists SET name=?,description=?,updated_at=? WHERE id=?")
        .bind(name.trim())
        .bind(description)
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(&playlist_id)
        .execute(&state.db)
        .await?;
    get_playlist(&state, &playlist_id).await
}

#[tauri::command]
pub async fn playlist_delete(playlist_id: String, state: State<'_, AppState>) -> AppResult<()> {
    sqlx::query("DELETE FROM playlists WHERE id=?")
        .bind(playlist_id)
        .execute(&state.db)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn playlist_add_tracks(
    playlist_id: String,
    track_ids: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<u64> {
    get_playlist(&state, &playlist_id).await?;
    let mut transaction = state.db.begin().await?;
    let mut position: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position),-1)+1 FROM playlist_tracks WHERE playlist_id=?",
    )
    .bind(&playlist_id)
    .fetch_one(&mut *transaction)
    .await?;
    let now = chrono::Utc::now().timestamp_millis();
    let mut inserted_count = 0;
    for track_id in track_ids {
        let result = sqlx::query("INSERT INTO playlist_tracks(id,playlist_id,track_id,position,added_at) VALUES(?,?,?,?,?) ON CONFLICT(playlist_id,track_id) DO NOTHING").bind(Uuid::new_v4().to_string()).bind(&playlist_id).bind(track_id).bind(position).bind(now).execute(&mut *transaction).await?;
        if result.rows_affected() > 0 {
            position += 1;
            inserted_count += 1;
        }
    }
    if inserted_count > 0 {
        sqlx::query("UPDATE playlists SET updated_at=? WHERE id=?")
            .bind(now)
            .bind(&playlist_id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(inserted_count)
}

#[tauri::command]
pub async fn playlist_remove_items(
    playlist_id: String,
    item_ids: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let mut transaction = state.db.begin().await?;
    for id in item_ids {
        sqlx::query("DELETE FROM playlist_tracks WHERE id=? AND playlist_id=?")
            .bind(id)
            .bind(&playlist_id)
            .execute(&mut *transaction)
            .await?;
    }
    let remaining: Vec<String> =
        sqlx::query_scalar("SELECT id FROM playlist_tracks WHERE playlist_id=? ORDER BY position")
            .bind(&playlist_id)
            .fetch_all(&mut *transaction)
            .await?;
    sqlx::query("UPDATE playlist_tracks SET position=-position-1 WHERE playlist_id=?")
        .bind(&playlist_id)
        .execute(&mut *transaction)
        .await?;
    for (position, id) in remaining.iter().enumerate() {
        sqlx::query("UPDATE playlist_tracks SET position=? WHERE id=?")
            .bind(position as i64)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(())
}

#[tauri::command]
pub async fn playlist_reorder_items(
    playlist_id: String,
    item_ids: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let current: Vec<String> =
        sqlx::query_scalar("SELECT id FROM playlist_tracks WHERE playlist_id=? ORDER BY position")
            .bind(&playlist_id)
            .fetch_all(&state.db)
            .await?;
    if current.len() != item_ids.len() || !current.iter().all(|id| item_ids.contains(id)) {
        return Err(AppError::validation(
            "Список элементов плейлиста некорректен",
        ));
    }
    let mut transaction = state.db.begin().await?;
    sqlx::query("UPDATE playlist_tracks SET position=-position-1 WHERE playlist_id=?")
        .bind(&playlist_id)
        .execute(&mut *transaction)
        .await?;
    for (position, id) in item_ids.iter().enumerate() {
        sqlx::query("UPDATE playlist_tracks SET position=? WHERE id=? AND playlist_id=?")
            .bind(position as i64)
            .bind(id)
            .bind(&playlist_id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(())
}

#[tauri::command]
pub async fn playlist_set_pinned(
    playlist_id: String,
    pinned: bool,
    state: State<'_, AppState>,
) -> AppResult<PlaylistDto> {
    sqlx::query("UPDATE playlists SET is_pinned=?,updated_at=? WHERE id=?")
        .bind(pinned)
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(&playlist_id)
        .execute(&state.db)
        .await?;
    get_playlist(&state, &playlist_id).await
}

#[tauri::command]
pub async fn playlist_reorder(
    playlist_ids: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let current: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM playlists ORDER BY is_pinned DESC,position,updated_at DESC",
    )
    .fetch_all(&state.db)
    .await?;
    if current.len() != playlist_ids.len() || !current.iter().all(|id| playlist_ids.contains(id)) {
        return Err(AppError::validation("Список плейлистов некорректен"));
    }
    let mut transaction = state.db.begin().await?;
    for (position, id) in playlist_ids.iter().enumerate() {
        sqlx::query("UPDATE playlists SET position=? WHERE id=?")
            .bind(position as i64)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(())
}
