CREATE TABLE IF NOT EXISTS track_tags (
    id TEXT PRIMARY KEY NOT NULL,
    track_id TEXT NOT NULL,
    label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 24),
    color TEXT NOT NULL CHECK(color IN ('amber', 'rose', 'violet', 'blue', 'cyan', 'emerald', 'slate')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_track_tags_unique_label
    ON track_tags(track_id, label COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_track_tags_track
    ON track_tags(track_id, created_at);
