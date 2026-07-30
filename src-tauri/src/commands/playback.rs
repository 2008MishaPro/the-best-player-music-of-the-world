use crate::{
    audio::PlaybackSnapshot,
    commands::queue as queue_commands,
    dto::PlaybackQueueDto,
    error::{AppError, AppResult},
    state::AppState,
};
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

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

async fn persist_setting<T: Serialize>(state: &AppState, key: &str, value: &T) -> AppResult<()> {
    let value = serde_json::to_string(value)
        .map_err(|error| AppError::new("DATABASE_ERROR", error.to_string()))?;
    sqlx::query(
        "INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?) \
         ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .bind(chrono::Utc::now().timestamp_millis())
    .execute(&state.db)
    .await?;
    Ok(())
}

async fn record_playback_start(state: &AppState, track_id: &str) -> AppResult<()> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut transaction = state.db.begin().await?;
    sqlx::query(
        "INSERT INTO playback_history(track_id,started_at,listened_ms,completed) \
         VALUES(?,?,0,0)",
    )
    .bind(track_id)
    .bind(now)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "UPDATE tracks SET last_played_at=?,play_count=play_count+1,updated_at=? WHERE id=?",
    )
    .bind(now)
    .bind(now)
    .bind(track_id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(())
}

async fn finish_playback_history(state: &AppState, completed: bool) -> AppResult<()> {
    let snapshot = state.audio.snapshot();
    let Some(track_id) = snapshot.track_id else {
        return Ok(());
    };
    sqlx::query(
        "UPDATE playback_history SET listened_ms=MAX(listened_ms,?),completed=MAX(completed,?) \
         WHERE id=(SELECT id FROM playback_history WHERE track_id=? ORDER BY id DESC LIMIT 1)",
    )
    .bind(snapshot.position_ms as i64)
    .bind(completed)
    .bind(track_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

fn synchronize_current(queue: &mut PlaybackQueueDto, track_id: Option<&str>) {
    if queue.item_ids.is_empty() {
        queue.current_index = -1;
        return;
    }
    if let Some(track_id) = track_id {
        let current_matches = queue
            .item_ids
            .get(queue.current_index.max(0) as usize)
            .is_some_and(|id| id == track_id);
        if !current_matches {
            if let Some(index) = queue.item_ids.iter().position(|id| id == track_id) {
                queue.current_index = index as i32;
            }
        }
    }
    queue.current_index = queue
        .current_index
        .clamp(0, queue.item_ids.len() as i32 - 1);
}

fn random_candidate(candidates: &[usize]) -> Option<usize> {
    if candidates.is_empty() {
        None
    } else {
        Some(candidates[Uuid::new_v4().as_u128() as usize % candidates.len()])
    }
}

fn select_next(
    queue: &mut PlaybackQueueDto,
    shuffle: bool,
    repeat: &str,
    automatic: bool,
) -> Option<usize> {
    if queue.item_ids.is_empty() {
        queue.current_index = -1;
        return None;
    }
    synchronize_current(queue, None);
    let current = queue.current_index as usize;
    if automatic && repeat == "one" {
        return Some(current);
    }
    if shuffle {
        let current_id = queue.item_ids[current].clone();
        if queue.history.last() != Some(&current_id) {
            queue.history.push(current_id.clone());
        }
        if queue.history.len() > queue.item_ids.len().saturating_mul(2).max(32) {
            let excess = queue.history.len() - queue.item_ids.len().max(16);
            queue.history.drain(..excess);
        }
        let available = |history: &[String]| {
            queue
                .item_ids
                .iter()
                .enumerate()
                .filter_map(|(index, id)| {
                    (index != current && !history.contains(id)).then_some(index)
                })
                .collect::<Vec<_>>()
        };
        let mut candidates = available(&queue.history);
        if candidates.is_empty() && repeat == "all" {
            queue.history.clear();
            candidates = available(&queue.history);
            if candidates.is_empty() && queue.item_ids.len() == 1 {
                return Some(current);
            }
        }
        let next = random_candidate(&candidates)?;
        queue.current_index = next as i32;
        return Some(next);
    }
    queue.history.clear();
    let next = if current + 1 < queue.item_ids.len() {
        current + 1
    } else if repeat == "all" {
        0
    } else {
        return None;
    };
    queue.current_index = next as i32;
    Some(next)
}

fn select_previous(queue: &mut PlaybackQueueDto, shuffle: bool, repeat: &str) -> Option<usize> {
    if queue.item_ids.is_empty() {
        queue.current_index = -1;
        return None;
    }
    synchronize_current(queue, None);
    let current = queue.current_index as usize;
    if shuffle {
        while let Some(previous_id) = queue.history.pop() {
            if let Some(index) =
                queue.item_ids.iter().enumerate().find_map(|(index, id)| {
                    (index != current && id == &previous_id).then_some(index)
                })
            {
                queue.current_index = index as i32;
                return Some(index);
            }
        }
        return None;
    }
    let previous = if current > 0 {
        current - 1
    } else if repeat == "all" {
        queue.item_ids.len() - 1
    } else {
        return None;
    };
    queue.current_index = previous as i32;
    Some(previous)
}

#[derive(Clone, Copy)]
enum Direction {
    Next,
    Previous,
}

async fn start_track(
    state: &AppState,
    track_id: String,
    path: PathBuf,
) -> AppResult<PlaybackSnapshot> {
    state.audio.load(track_id.clone(), path, 0)?;
    record_playback_start(state, &track_id).await?;
    state.audio.play()
}

async fn advance(
    state: &AppState,
    direction: Direction,
    automatic: bool,
) -> AppResult<PlaybackSnapshot> {
    let current_snapshot = state.audio.snapshot();
    if matches!(direction, Direction::Previous)
        && !automatic
        && current_snapshot.position_ms > 3_000
    {
        return state.audio.seek(0);
    }
    if automatic {
        finish_playback_history(state, true).await?;
    }
    let repeat = state.audio.repeat_mode();
    let shuffle = state.audio.shuffle_enabled();
    if automatic && repeat == "one" {
        if let Some(track_id) = current_snapshot.track_id {
            let path = path_for(state, &track_id).await?;
            return start_track(state, track_id, path).await;
        }
    }
    {
        let mut queue = state
            .queue
            .write()
            .map_err(|_| AppError::playback("Очередь недоступна"))?;
        synchronize_current(&mut queue, current_snapshot.track_id.as_deref());
    }
    let attempts = state
        .queue
        .read()
        .map_err(|_| AppError::playback("Очередь недоступна"))?
        .item_ids
        .len()
        .max(1);
    for _ in 0..attempts {
        let (candidate, queue_snapshot) = {
            let mut queue = state
                .queue
                .write()
                .map_err(|_| AppError::playback("Очередь недоступна"))?;
            let index = match direction {
                Direction::Next => select_next(&mut queue, shuffle, repeat, automatic),
                Direction::Previous => select_previous(&mut queue, shuffle, repeat),
            };
            let candidate = index.and_then(|index| queue.item_ids.get(index).cloned());
            (candidate, queue.clone())
        };
        queue_commands::persist(state, &queue_snapshot).await?;
        let Some(track_id) = candidate else {
            if matches!(direction, Direction::Previous)
                && !automatic
                && current_snapshot.track_id.is_some()
            {
                return state.audio.seek(0);
            }
            return Ok(state.audio.snapshot());
        };
        match path_for(state, &track_id).await {
            Ok(path) => {
                if !automatic {
                    finish_playback_history(state, false).await?;
                }
                return start_track(state, track_id, path).await;
            }
            Err(error) if error.code == "FILE_MISSING" => continue,
            Err(error) => return Err(error),
        }
    }
    Ok(state.audio.snapshot())
}
#[tauri::command]
pub async fn playback_load(
    track_id: String,
    state: State<'_, AppState>,
) -> AppResult<PlaybackSnapshot> {
    let path = path_for(&state, &track_id).await?;
    let queue_snapshot = {
        let mut queue = state
            .queue
            .write()
            .map_err(|_| AppError::playback("Очередь недоступна"))?;
        let previous_index = queue.current_index;
        synchronize_current(&mut queue, Some(&track_id));
        if queue.current_index != previous_index {
            queue.history.clear();
            Some(queue.clone())
        } else {
            None
        }
    };
    if let Some(queue) = queue_snapshot {
        queue_commands::persist(&state, &queue).await?;
    }
    let snapshot = state.audio.load(track_id.clone(), path, 0)?;
    record_playback_start(&state, &track_id).await?;
    Ok(snapshot)
}
#[tauri::command]
pub async fn playback_play(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    let snapshot = state.audio.snapshot();
    if snapshot.status == "stopped" {
        if let Some(track_id) = snapshot.track_id {
            let path = path_for(&state, &track_id).await?;
            state.audio.load(track_id.clone(), path, 0)?;
            record_playback_start(&state, &track_id).await?;
        }
    }
    state.audio.play()
}
#[tauri::command]
pub fn playback_pause(state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.pause()
}
#[tauri::command]
pub async fn playback_stop(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    finish_playback_history(&state, false).await?;
    Ok(state.audio.stop())
}
#[tauri::command]
pub fn playback_seek(position_ms: u64, state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    state.audio.seek(position_ms)
}
#[tauri::command]
pub async fn playback_set_volume(
    volume: f32,
    state: State<'_, AppState>,
) -> AppResult<PlaybackSnapshot> {
    let volume = volume.clamp(0.0, 1.0);
    let snapshot = state.audio.set_volume(volume);
    persist_setting(&state, "playback_volume", &volume).await?;
    Ok(snapshot)
}
#[tauri::command]
pub async fn playback_set_repeat(
    repeat: String,
    state: State<'_, AppState>,
) -> AppResult<PlaybackSnapshot> {
    if !matches!(repeat.as_str(), "off" | "all" | "one") {
        return Err(AppError::validation("Неизвестный режим повтора"));
    }
    let snapshot = state.audio.set_repeat(&repeat);
    persist_setting(&state, "playback_repeat", &repeat).await?;
    Ok(snapshot)
}
#[tauri::command]
pub async fn playback_set_shuffle(
    shuffle: bool,
    state: State<'_, AppState>,
) -> AppResult<PlaybackSnapshot> {
    let snapshot = state.audio.set_shuffle(shuffle);
    let queue_snapshot = if !shuffle {
        let mut queue = state
            .queue
            .write()
            .map_err(|_| AppError::playback("Очередь недоступна"))?;
        queue.history.clear();
        Some(queue.clone())
    } else {
        None
    };
    if let Some(queue) = queue_snapshot {
        queue_commands::persist(&state, &queue).await?;
    }
    persist_setting(&state, "playback_shuffle", &shuffle).await?;
    Ok(snapshot)
}
#[tauri::command]
pub fn playback_get_snapshot(state: State<'_, AppState>) -> PlaybackSnapshot {
    state.audio.snapshot()
}
#[tauri::command]
pub async fn playback_next(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    advance(&state, Direction::Next, false).await
}
#[tauri::command]
pub async fn playback_previous(state: State<'_, AppState>) -> AppResult<PlaybackSnapshot> {
    advance(&state, Direction::Previous, false).await
}

pub(crate) async fn handle_track_completion(state: &AppState) -> AppResult<()> {
    advance(state, Direction::Next, true).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn queue(current_index: i32) -> PlaybackQueueDto {
        PlaybackQueueDto {
            source: None,
            item_ids: vec!["a".into(), "b".into(), "c".into()],
            current_index,
            history: vec![],
        }
    }

    #[test]
    fn sequential_navigation_stops_or_wraps_at_the_end() {
        let mut stopped = queue(2);
        assert_eq!(select_next(&mut stopped, false, "off", true), None);
        assert_eq!(stopped.current_index, 2);

        let mut wrapped = queue(2);
        assert_eq!(select_next(&mut wrapped, false, "all", true), Some(0));
        assert_eq!(wrapped.current_index, 0);
    }

    #[test]
    fn repeat_one_restarts_only_after_natural_completion() {
        let mut automatic = queue(1);
        assert_eq!(select_next(&mut automatic, false, "one", true), Some(1));

        let mut manual = queue(1);
        assert_eq!(select_next(&mut manual, false, "one", false), Some(2));
    }

    #[test]
    fn shuffle_avoids_current_and_already_played_tracks() {
        let mut shuffled = queue(1);
        shuffled.history.push("a".into());
        assert_eq!(select_next(&mut shuffled, true, "off", true), Some(2));
        assert_eq!(shuffled.current_index, 2);
    }

    #[test]
    fn shuffle_previous_uses_real_playback_history() {
        let mut shuffled = queue(2);
        shuffled.history = vec!["a".into(), "b".into()];
        assert_eq!(select_previous(&mut shuffled, true, "off"), Some(1));
        assert_eq!(shuffled.current_index, 1);
    }
}
