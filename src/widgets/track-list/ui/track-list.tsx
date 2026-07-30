import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { AlertTriangle, Heart, ListPlus, Music2, Play } from "lucide-react";
import type { Track } from "@/entities/track";
import { trackDisplayArtist, trackDisplayTitle } from "@/entities/track";
import { loadTrackAction, playAction } from "@/features/control-playback";
import { TrackActionsMenu } from "@/features/manage-track";
import { TrackTags } from "@/features/manage-track-tags";
import { replaceQueueAction } from "@/features/manage-playback-queue";
import { toggleFavoriteAction } from "@/features/toggle-track-favorite";
import { formatDuration } from "@/shared/lib/format.ts";
import { Badge, Button } from "@/shared/ui";

type TrackListProps = {
  tracks: Track[];
  emptyMessage?: string;
  onAddToPlaylist?: (trackId: string) => void;
};

export const TrackList = reatomComponent<TrackListProps>(({ tracks, emptyMessage = "Треков пока нет", onAddToPlaylist }) => {
  const playTrack = async (track: Track) => {
    const index = tracks.findIndex((item) => item.id === track.id);
    await replaceQueueAction(tracks.map((item) => item.id), { type: "library" }, index);
    await loadTrackAction(track.id);
    await playAction();
  };

  if (!tracks.length) return <div className="empty-inline"><Music2 />{emptyMessage}</div>;

  return (
    <div className="track-list" role="table" aria-label="Треки">
      <div className="track-row track-row--head" role="row">
        <span>#</span><span>Название</span><span>Метки</span><span>Альбом</span><span>Время</span><span />
      </div>
      {tracks.map((track, index) => (
        <div className={`track-row ${track.isMissing ? "track-row--missing" : ""}`} role="row" key={track.id}>
          <Button size="icon" variant="ghost" onClick={wrap(() => playTrack(track))} disabled={track.isMissing} aria-label={`Воспроизвести ${trackDisplayTitle(track)}`}>
            {track.isMissing ? <AlertTriangle /> : <><span className="track-index">{index + 1}</span><Play className="track-play" /></>}
          </Button>
          <div className="track-title-cell">
            <span className="track-cover"><Music2 /></span>
            <span><strong>{trackDisplayTitle(track)}</strong><small>{trackDisplayArtist(track)}</small></span>
            {track.isMissing && <Badge>Файл не найден</Badge>}
          </div>
          <TrackTags track={track} />
          <span className="muted ellipsis">{track.album || "Без альбома"}</span>
          <span className="muted mono">{formatDuration(track.durationMs)}</span>
          <div className="track-actions">
            {onAddToPlaylist && <Button size="icon" variant="ghost" className="track-add-playlist" onClick={() => onAddToPlaylist(track.id)} aria-label="Добавить в плейлист"><ListPlus /></Button>}
            <Button size="icon" variant="ghost" className={track.isFavorite ? "is-favorite" : ""} onClick={wrap(() => toggleFavoriteAction(track.id))} aria-label="Избранное"><Heart fill={track.isFavorite ? "currentColor" : "none"} /></Button>
            <TrackActionsMenu track={track} />
          </div>
        </div>
      ))}
    </div>
  );
}, "TrackList");
