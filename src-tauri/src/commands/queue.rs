use crate::{
    dto::{PlaybackQueueDto, QueueSource},
    error::{AppError, AppResult},
    state::AppState,
};
use tauri::State;

async fn persist(state: &AppState, queue: &PlaybackQueueDto) -> AppResult<()> {
    let value = serde_json::to_string(queue)
        .map_err(|error| AppError::new("UNKNOWN", error.to_string()))?;
    sqlx::query("INSERT INTO settings(key,value_json,updated_at) VALUES('playback_queue',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at")
        .bind(value).bind(chrono::Utc::now().timestamp_millis()).execute(&state.db).await?;
    Ok(())
}
fn read(state: &AppState) -> AppResult<PlaybackQueueDto> {
    state
        .queue
        .read()
        .map(|queue| queue.clone())
        .map_err(|_| AppError::new("UNKNOWN", "Очередь недоступна"))
}
async fn write(state: &AppState, queue: PlaybackQueueDto) -> AppResult<PlaybackQueueDto> {
    *state
        .queue
        .write()
        .map_err(|_| AppError::new("UNKNOWN", "Очередь недоступна"))? = queue.clone();
    persist(state, &queue).await?;
    Ok(queue)
}

#[tauri::command]
pub fn queue_get(state: State<'_, AppState>) -> AppResult<PlaybackQueueDto> {
    read(&state)
}
#[tauri::command]
pub async fn queue_replace(
    item_ids: Vec<String>,
    source: Option<QueueSource>,
    current_index: i32,
    state: State<'_, AppState>,
) -> AppResult<PlaybackQueueDto> {
    let index = if item_ids.is_empty() {
        -1
    } else {
        current_index.clamp(0, item_ids.len() as i32 - 1)
    };
    write(
        &state,
        PlaybackQueueDto {
            source,
            item_ids,
            current_index: index,
            history: vec![],
        },
    )
    .await
}
#[tauri::command]
pub async fn queue_append(
    track_ids: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<PlaybackQueueDto> {
    let mut queue = read(&state)?;
    queue.item_ids.extend(track_ids);
    if queue.current_index < 0 && !queue.item_ids.is_empty() {
        queue.current_index = 0;
    }
    write(&state, queue).await
}
#[tauri::command]
pub async fn queue_insert_next(
    track_id: String,
    state: State<'_, AppState>,
) -> AppResult<PlaybackQueueDto> {
    let mut queue = read(&state)?;
    let index = (queue.current_index + 1).max(0) as usize;
    queue
        .item_ids
        .insert(index.min(queue.item_ids.len()), track_id);
    write(&state, queue).await
}
#[tauri::command]
pub async fn queue_remove(index: usize, state: State<'_, AppState>) -> AppResult<PlaybackQueueDto> {
    let mut queue = read(&state)?;
    if index >= queue.item_ids.len() {
        return Err(AppError::validation("Индекс за пределами очереди"));
    }
    queue.item_ids.remove(index);
    if queue.item_ids.is_empty() {
        queue.current_index = -1;
    } else if index as i32 <= queue.current_index {
        queue.current_index = (queue.current_index - 1).max(0);
    }
    write(&state, queue).await
}
#[tauri::command]
pub async fn queue_reorder(
    from: usize,
    to: usize,
    state: State<'_, AppState>,
) -> AppResult<PlaybackQueueDto> {
    let mut queue = read(&state)?;
    if from >= queue.item_ids.len() || to >= queue.item_ids.len() {
        return Err(AppError::validation("Индекс за пределами очереди"));
    }
    let item = queue.item_ids.remove(from);
    queue.item_ids.insert(to, item);
    queue.current_index = to as i32;
    write(&state, queue).await
}
#[tauri::command]
pub async fn queue_clear(state: State<'_, AppState>) -> AppResult<PlaybackQueueDto> {
    write(&state, PlaybackQueueDto::default()).await
}
