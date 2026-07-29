mod analysis;
mod audio;
mod commands;
mod database;
mod dto;
mod error;
mod library;
mod state;

use commands::{
    analysis::*, library::*, playback::*, playlists::*, queue::*, settings::*, tags::*,
};
use state::AppState;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let state = tauri::async_runtime::block_on(AppState::initialize(app.handle()))?;
            let audio = state.audio.clone();
            let handle = app.handle().clone();
            app.manage(state);
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_millis(33));
                loop {
                    interval.tick().await;
                    if handle
                        .emit("playback://snapshot", audio.snapshot())
                        .is_err()
                    {
                        break;
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library_get_tracks,
            library_get_track,
            library_import_files,
            library_import_directory,
            library_check_missing,
            library_set_favorite,
            library_remove_track,
            track_tag_create,
            track_tag_delete,
            playlist_get_all,
            playlist_get_by_id,
            playlist_create,
            playlist_update,
            playlist_delete,
            playlist_add_tracks,
            playlist_remove_items,
            playlist_reorder_items,
            playlist_set_pinned,
            queue_get,
            queue_replace,
            queue_append,
            queue_insert_next,
            queue_remove,
            queue_reorder,
            queue_clear,
            playback_load,
            playback_play,
            playback_pause,
            playback_stop,
            playback_seek,
            playback_set_volume,
            playback_set_repeat,
            playback_set_shuffle,
            playback_get_snapshot,
            playback_next,
            playback_previous,
            analysis_start,
            analysis_cancel,
            analysis_get_status,
            analysis_get_waveform,
            analysis_get_peak_map,
            settings_get_all,
            settings_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
