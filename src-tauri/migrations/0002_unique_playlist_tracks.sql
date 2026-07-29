DELETE FROM playlist_tracks
WHERE id NOT IN (
    SELECT MIN(id)
    FROM playlist_tracks
    GROUP BY playlist_id, track_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_unique_track
    ON playlist_tracks(playlist_id, track_id);
