use serde::Serialize;
use serde_json::Value;
use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", message)
    }
    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("VALIDATION_ERROR", message)
    }
    pub fn playback(message: impl Into<String>) -> Self {
        Self::new("PLAYBACK_ERROR", message)
    }
    pub fn analysis(message: impl Into<String>) -> Self {
        Self::new("ANALYSIS_ERROR", message)
    }
}

impl Display for AppError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}
impl std::error::Error for AppError {}
impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        Self::new("DATABASE_ERROR", error.to_string())
    }
}
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::new("UNKNOWN", error.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
