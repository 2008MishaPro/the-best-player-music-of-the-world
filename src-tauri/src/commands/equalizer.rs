use crate::{
    dto::{EqualizerBundleDto, EqualizerPresetDto, EqualizerStateDto},
    equalizer,
    error::{AppError, AppResult},
    state::AppState,
};
use tauri::State;
use uuid::Uuid;

fn state_from(
    enabled: bool,
    bands: Vec<f32>,
    preamp_db: f32,
    active_preset_id: Option<String>,
) -> AppResult<EqualizerStateDto> {
    equalizer::validate(&bands, preamp_db)?;
    Ok(EqualizerStateDto {
        enabled,
        bands,
        preamp_db,
        active_preset_id,
    })
}

#[tauri::command]
pub async fn equalizer_get(state: State<'_, AppState>) -> AppResult<EqualizerBundleDto> {
    Ok(EqualizerBundleDto {
        frequencies: equalizer::EQ_FREQUENCIES.to_vec(),
        state: equalizer::load_state(&state.db).await?,
        presets: equalizer::all_presets(&state.db).await?,
    })
}

#[tauri::command]
pub fn equalizer_preview(
    enabled: bool,
    bands: Vec<f32>,
    preamp_db: f32,
    state: State<'_, AppState>,
) -> AppResult<EqualizerStateDto> {
    let value = state_from(enabled, bands, preamp_db, None)?;
    state
        .audio
        .set_equalizer(value.enabled, &value.bands, value.preamp_db);
    Ok(value)
}

#[tauri::command]
pub async fn equalizer_set(
    enabled: bool,
    bands: Vec<f32>,
    preamp_db: f32,
    active_preset_id: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<EqualizerStateDto> {
    let value = state_from(enabled, bands, preamp_db, active_preset_id)?;
    state
        .audio
        .set_equalizer(value.enabled, &value.bands, value.preamp_db);
    equalizer::save_state(&state.db, &value).await?;
    Ok(value)
}

#[tauri::command]
pub async fn equalizer_save_preset(
    name: String,
    bands: Vec<f32>,
    preamp_db: f32,
    state: State<'_, AppState>,
) -> AppResult<EqualizerPresetDto> {
    let name = name.trim();
    let length = name.chars().count();
    if !(1..=32).contains(&length) {
        return Err(AppError::validation(
            "Название пресета должно содержать от 1 до 32 символов",
        ));
    }
    equalizer::validate(&bands, preamp_db)?;
    let normalized_name = name.to_lowercase();
    let custom_names = sqlx::query_scalar::<_, String>("SELECT name FROM equalizer_presets")
        .fetch_all(&state.db)
        .await?;
    if equalizer::builtin_presets()
        .iter()
        .map(|preset| preset.name.to_lowercase())
        .chain(custom_names.into_iter().map(|name| name.to_lowercase()))
        .any(|existing| existing == normalized_name)
    {
        return Err(AppError::validation(
            "Пресет с таким названием уже существует",
        ));
    }
    let now = chrono::Utc::now().timestamp_millis();
    let preset = EqualizerPresetDto {
        id: Uuid::new_v4().to_string(),
        name: name.into(),
        is_builtin: false,
        bands,
        preamp_db,
        created_at: now,
        updated_at: now,
    };
    let bands_json = serde_json::to_string(&preset.bands)
        .map_err(|error| AppError::new("DATABASE_ERROR", error.to_string()))?;
    sqlx::query(
        "INSERT INTO equalizer_presets(id,name,is_builtin,bands_json,preamp_db,created_at,updated_at) \
         VALUES(?,?,0,?,?,?,?)",
    )
    .bind(&preset.id)
    .bind(&preset.name)
    .bind(bands_json)
    .bind(preset.preamp_db)
    .bind(preset.created_at)
    .bind(preset.updated_at)
    .execute(&state.db)
    .await?;
    Ok(preset)
}

#[tauri::command]
pub async fn equalizer_delete_preset(
    preset_id: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM equalizer_presets WHERE id=? AND is_builtin=0")
        .bind(&preset_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found("Пользовательский пресет не найден"));
    }
    let mut current = equalizer::load_state(&state.db).await?;
    if current.active_preset_id.as_deref() == Some(preset_id.as_str()) {
        current.active_preset_id = None;
        equalizer::save_state(&state.db, &current).await?;
    }
    Ok(())
}
