use crate::error::{AppError, AppResult};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::{path::Path, str::FromStr};

pub async fn connect(path: &Path) -> AppResult<SqlitePool> {
    let url = format!("sqlite://{}", path.to_string_lossy().replace('\\', "/"));
    let options = SqliteConnectOptions::from_str(&url)
        .map_err(|error| AppError::new("DATABASE_ERROR", error.to_string()))?
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|error| AppError::new("DATABASE_ERROR", error.to_string()))?;
    Ok(pool)
}
