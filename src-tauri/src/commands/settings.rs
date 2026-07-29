use crate::{error::AppResult, state::AppState};
use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn settings_get_all(state: State<'_, AppState>) -> AppResult<HashMap<String, Value>> {
    let rows = sqlx::query_as::<_, (String, String)>("SELECT key,value_json FROM settings")
        .fetch_all(&state.db)
        .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(key, value)| serde_json::from_str(&value).ok().map(|value| (key, value)))
        .collect())
}
#[tauri::command]
pub async fn settings_set(key: String, value: Value, state: State<'_, AppState>) -> AppResult<()> {
    sqlx::query("INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").bind(key).bind(value.to_string()).bind(chrono::Utc::now().timestamp_millis()).execute(&state.db).await?;
    Ok(())
}
