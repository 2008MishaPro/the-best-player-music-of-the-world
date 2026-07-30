use crate::{
    dto::{EqualizerPresetDto, EqualizerStateDto},
    error::{AppError, AppResult},
};
use sqlx::SqlitePool;

pub const EQ_FREQUENCIES: [f32; 10] = [
    31.0, 62.0, 125.0, 250.0, 500.0, 1_000.0, 2_000.0, 4_000.0, 8_000.0, 16_000.0,
];
pub const EQ_MIN_DB: f32 = -12.0;
pub const EQ_MAX_DB: f32 = 12.0;
pub const PREAMP_MIN_DB: f32 = -12.0;
pub const PREAMP_MAX_DB: f32 = 0.0;
const STATE_KEY: &str = "equalizer_state";

fn builtin(id: &str, name: &str, bands: [f32; 10], preamp_db: f32) -> EqualizerPresetDto {
    EqualizerPresetDto {
        id: id.into(),
        name: name.into(),
        is_builtin: true,
        bands: bands.to_vec(),
        preamp_db,
        created_at: 0,
        updated_at: 0,
    }
}

pub fn builtin_presets() -> Vec<EqualizerPresetDto> {
    vec![
        builtin("builtin-flat", "Без изменений", [0.0; 10], 0.0),
        builtin(
            "builtin-bass",
            "Глубокий бас",
            [6.0, 5.0, 4.0, 2.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0],
            -6.0,
        ),
        builtin(
            "builtin-bright",
            "Яркость",
            [-1.0, -1.0, 0.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
            -6.0,
        ),
        builtin(
            "builtin-vocal",
            "Вокал",
            [-2.0, -1.0, 0.0, 2.0, 4.0, 4.0, 2.0, 1.0, 0.0, -1.0],
            -4.0,
        ),
        builtin(
            "builtin-rock",
            "Рок",
            [4.0, 3.0, 1.0, -1.0, -2.0, 1.0, 3.0, 4.0, 4.0, 3.0],
            -4.0,
        ),
        builtin(
            "builtin-electronic",
            "Электроника",
            [5.0, 4.0, 1.0, -1.0, -2.0, 1.0, 2.0, 4.0, 5.0, 6.0],
            -6.0,
        ),
        builtin(
            "builtin-acoustic",
            "Акустика",
            [2.0, 2.0, 1.0, 0.0, 1.0, 2.0, 3.0, 3.0, 2.0, 1.0],
            -3.0,
        ),
    ]
}

pub fn validate(bands: &[f32], preamp_db: f32) -> AppResult<()> {
    if bands.len() != EQ_FREQUENCIES.len() {
        return Err(AppError::validation("Эквалайзер должен содержать 10 полос"));
    }
    if bands
        .iter()
        .any(|gain| !gain.is_finite() || !(EQ_MIN_DB..=EQ_MAX_DB).contains(gain))
    {
        return Err(AppError::validation(
            "Усиление каждой полосы должно быть от -12 до +12 дБ",
        ));
    }
    if !preamp_db.is_finite() || !(PREAMP_MIN_DB..=PREAMP_MAX_DB).contains(&preamp_db) {
        return Err(AppError::validation(
            "Предусиление должно быть от -12 до 0 дБ",
        ));
    }
    Ok(())
}

pub async fn load_state(db: &SqlitePool) -> AppResult<EqualizerStateDto> {
    let state = sqlx::query_scalar::<_, String>("SELECT value_json FROM settings WHERE key=?")
        .bind(STATE_KEY)
        .fetch_optional(db)
        .await?
        .and_then(|value| serde_json::from_str::<EqualizerStateDto>(&value).ok())
        .unwrap_or_default();
    if validate(&state.bands, state.preamp_db).is_ok() {
        Ok(state)
    } else {
        Ok(EqualizerStateDto::default())
    }
}

pub async fn save_state(db: &SqlitePool, state: &EqualizerStateDto) -> AppResult<()> {
    validate(&state.bands, state.preamp_db)?;
    let value = serde_json::to_string(state)
        .map_err(|error| AppError::new("DATABASE_ERROR", error.to_string()))?;
    sqlx::query(
        "INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?) \
         ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
    )
    .bind(STATE_KEY)
    .bind(value)
    .bind(chrono::Utc::now().timestamp_millis())
    .execute(db)
    .await?;
    Ok(())
}

pub async fn all_presets(db: &SqlitePool) -> AppResult<Vec<EqualizerPresetDto>> {
    let rows = sqlx::query_as::<_, (String, String, bool, String, f32, i64, i64)>(
        "SELECT id,name,is_builtin,bands_json,preamp_db,created_at,updated_at \
         FROM equalizer_presets ORDER BY updated_at DESC",
    )
    .fetch_all(db)
    .await?;
    let mut presets = builtin_presets();
    presets.extend(rows.into_iter().filter_map(
        |(id, name, is_builtin, bands_json, preamp_db, created_at, updated_at)| {
            let bands = serde_json::from_str::<Vec<f32>>(&bands_json).ok()?;
            validate(&bands, preamp_db).ok()?;
            Some(EqualizerPresetDto {
                id,
                name,
                is_builtin,
                bands,
                preamp_db,
                created_at,
                updated_at,
            })
        },
    ));
    Ok(presets)
}
