ALTER TABLE playlists ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY is_pinned DESC, updated_at DESC, id) - 1 AS next_position
    FROM playlists
)
UPDATE playlists
SET position = (SELECT next_position FROM ordered WHERE ordered.id = playlists.id);
