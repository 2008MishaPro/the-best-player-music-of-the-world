import { useEffect } from "react";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { useParams } from "@tanstack/react-router";
import { ListMusic, Pin, PinOff, Play, Shuffle, Trash2 } from "lucide-react";
import { activePlaylistAtom, loadPlaylistAction } from "@/entities/playlist";
import { deletePlaylistAction, pinPlaylistAction } from "@/features/edit-playlist";
import { removePlaylistItemsAction, reorderPlaylistItemsAction } from "@/features/add-track-to-playlist";
import { loadTrackAction, playAction } from "@/features/control-playback";
import { replaceQueueAction } from "@/features/manage-playback-queue";
import { Button } from "@/shared/ui";
import { TrackList } from "@/widgets/track-list";

export const PlaylistPage = reatomComponent(() => {
  const { playlistId } = useParams({ from: "/playlist/$playlistId" });
  const playlist = activePlaylistAtom();
  useEffect(() => { void loadPlaylistAction(playlistId); }, [playlistId]);
  if (!playlist || playlist.id !== playlistId) return <section className="page"><div className="empty-inline">Загрузка плейлиста…</div></section>;
  const play = async (shuffle: boolean) => {
    const ids = playlist.items.map((item) => item.trackId);
    if (shuffle) ids.sort(() => Math.random() - 0.5);
    if (!ids.length) return;
    await replaceQueueAction(ids, { type: "playlist", playlistId }, 0);
    await loadTrackAction(ids[0]);
    await playAction();
  };
  const itemByTrackId = new Map(playlist.items.map((item) => [item.trackId, item.id]));
  const removeTracks = (trackIds: string[]) => removePlaylistItemsAction(
    playlist.id,
    trackIds.map((trackId) => itemByTrackId.get(trackId)).filter((itemId): itemId is string => Boolean(itemId)),
  );
  const reorderTracks = (trackIds: string[]) => reorderPlaylistItemsAction(
    playlist.id,
    trackIds.map((trackId) => itemByTrackId.get(trackId)).filter((itemId): itemId is string => Boolean(itemId)),
  );
  return <section className="page"><header className="playlist-hero"><span className="playlist-art"><ListMusic /></span><div><p className="eyebrow">Плейлист</p><h1>{playlist.name}</h1><p>{playlist.description || "Личная подборка"} · {playlist.items.length} треков</p><div className="button-group"><Button onClick={wrap(() => play(false))}><Play fill="currentColor" />Слушать</Button><Button variant="secondary" onClick={wrap(() => play(true))}><Shuffle />Перемешать</Button><Button className="mobile-icon-action" variant="ghost" aria-label={playlist.isPinned ? "Открепить" : "Закрепить"} title={playlist.isPinned ? "Открепить" : "Закрепить"} onClick={wrap(() => pinPlaylistAction(playlist.id, !playlist.isPinned))}>{playlist.isPinned ? <PinOff /> : <Pin />}{playlist.isPinned ? "Открепить" : "Закрепить"}</Button><Button className="mobile-icon-action" variant="ghost" aria-label="Удалить плейлист" title="Удалить плейлист" onClick={wrap(() => deletePlaylistAction(playlist.id))}><Trash2 /></Button></div></div></header><TrackList tracks={playlist.items.map((item) => item.track)} emptyMessage="В этом плейлисте пока нет треков" onRemoveFromPlaylist={removeTracks} onReorderTracks={reorderTracks} /></section>;
}, "PlaylistPage");
