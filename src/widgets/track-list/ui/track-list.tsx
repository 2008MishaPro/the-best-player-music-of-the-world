import { useEffect, useState, type DragEvent, type MouseEvent } from "react";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import {
  AlertTriangle,
  FolderOpen,
  Heart,
  ListMusic,
  ListPlus,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Trash2,
  X,
} from "lucide-react";
import {
  selectedTrackIdsAtom,
  trackDisplayArtist,
  trackDisplayTitle,
  type Track,
} from "@/entities/track";
import { AddTrackToPlaylistDialog } from "@/features/add-track-to-playlist";
import {
  loadTrackAction,
  pauseAction,
  playbackSnapshotAtom,
  playAction,
} from "@/features/control-playback";
import {
  removeTracksFromLibraryAction,
  revealTrackAction,
  TrackActionsMenu,
} from "@/features/manage-track";
import { TrackTags } from "@/features/manage-track-tags";
import { appendQueueAction, replaceQueueAction } from "@/features/manage-playback-queue";
import { setTracksFavoriteAction, toggleFavoriteAction } from "@/features/toggle-track-favorite";
import { formatDuration } from "@/shared/lib/format.ts";
import {
  hasTrackDragData,
  readTrackDragData,
  writeTrackDragData,
} from "@/shared/lib/track-drag.ts";
import {
  Badge,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";
import { toast } from "sonner";

type TrackListProps = {
  tracks: Track[];
  emptyMessage?: string;
  onRemoveFromPlaylist?: (trackIds: string[]) => Promise<void>;
  onReorderTracks?: (trackIds: string[]) => Promise<void>;
};

const sameOrder = (first: string[], second: string[]) =>
  first.length === second.length && first.every((id, index) => id === second[index]);

export const TrackList = reatomComponent<TrackListProps>(({
  tracks,
  emptyMessage = "Треков пока нет",
  onRemoveFromPlaylist,
  onReorderTracks,
}) => {
  const playback = playbackSnapshotAtom();
  const selectedTrackIds = selectedTrackIdsAtom();
  const selectedSet = new Set(selectedTrackIds);
  const visibleSelectedIds = tracks.filter((track) => selectedSet.has(track.id)).map((track) => track.id);
  const visibleTrackKey = tracks.map((track) => track.id).join("\u0000");
  const [tracksToAdd, setTracksToAdd] = useState<string[]>([]);
  const [tracksToRemove, setTracksToRemove] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

  useEffect(() => {
    const visibleIds = new Set(visibleTrackKey.split("\u0000").filter(Boolean));
    selectedTrackIdsAtom.set((current) => current.filter((id) => visibleIds.has(id)));
  }, [visibleTrackKey]);

  useEffect(() => {
    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") selectedTrackIdsAtom.set([]);
    };
    document.addEventListener("keydown", clearOnEscape);
    return () => document.removeEventListener("keydown", clearOnEscape);
  }, []);

  const actionIds = (trackId: string) => selectedSet.has(trackId) && visibleSelectedIds.length
    ? visibleSelectedIds
    : [trackId];

  const toggleSelection = (event: MouseEvent<HTMLDivElement>, trackId: string) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    selectedTrackIdsAtom.set((current) => current.includes(trackId)
      ? current.filter((id) => id !== trackId)
      : [...current, trackId]);
  };

  const playTrack = async (track: Track) => {
    if (playback.trackId === track.id) {
      await (playback.status === "playing" ? pauseAction() : playAction());
      return;
    }
    const index = tracks.findIndex((item) => item.id === track.id);
    await replaceQueueAction(tracks.map((item) => item.id), { type: "library" }, index);
    await loadTrackAction(track.id);
    await playAction();
  };

  const run = async (operation: () => Promise<unknown>, success?: string) => {
    try {
      await operation();
      if (success) toast.success(success);
    } catch (error) {
      toast.error("Не удалось выполнить действие", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startDrag = (event: DragEvent<HTMLDivElement>, track: Track) => {
    const ids = actionIds(track.id);
    if (!selectedSet.has(track.id)) selectedTrackIdsAtom.set(ids);
    const draggedTracks = tracks.filter((item) => ids.includes(item.id) && !item.isMissing);
    if (!draggedTracks.length) {
      event.preventDefault();
      return;
    }
    writeTrackDragData(event.dataTransfer, draggedTracks);
  };

  const dropTracks = async (event: DragEvent<HTMLDivElement>, targetTrackId: string) => {
    setDragOverTrackId(null);
    if (!onReorderTracks || !hasTrackDragData(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const draggedIds = readTrackDragData(event.dataTransfer);
    if (!draggedIds.length || draggedIds.includes(targetTrackId)) return;
    const orderedIds = tracks.map((track) => track.id);
    const movingIds = orderedIds.filter((id) => draggedIds.includes(id));
    const remainingIds = orderedIds.filter((id) => !draggedIds.includes(id));
    const targetIndex = remainingIds.indexOf(targetTrackId);
    if (targetIndex < 0) return;
    const targetBounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientY >= targetBounds.top + targetBounds.height / 2;
    const insertIndex = targetIndex + (insertAfter ? 1 : 0);
    const nextIds = [
      ...remainingIds.slice(0, insertIndex),
      ...movingIds,
      ...remainingIds.slice(insertIndex),
    ];
    if (!sameOrder(orderedIds, nextIds)) {
      await run(() => onReorderTracks(nextIds));
    }
  };

  const confirmRemove = async () => {
    setRemoving(true);
    try {
      await removeTracksFromLibraryAction(tracksToRemove);
      selectedTrackIdsAtom.set([]);
      setTracksToRemove([]);
      toast.success(tracksToRemove.length === 1
        ? "Трек удалён из медиатеки"
        : `Удалено треков: ${tracksToRemove.length}`);
    } catch (error) {
      toast.error("Не удалось удалить треки", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRemoving(false);
    }
  };

  if (!tracks.length) return <div className="empty-inline"><Music2 />{emptyMessage}</div>;

  return (
    <>
      {visibleSelectedIds.length > 0 && (
        <div className="track-selection-bar">
          <span><strong>Выбрано: {visibleSelectedIds.length}</strong><small>Ctrl + клик — изменить выбор</small></span>
          <Button size="icon" variant="ghost" onClick={() => selectedTrackIdsAtom.set([])} aria-label="Снять выделение"><X /></Button>
        </div>
      )}
      <div className="track-list" role="table" aria-label="Треки">
        <div className="track-row track-row--head" role="row">
          <span>#</span><span>Название</span><span>Метки</span><span>Альбом</span><span>Время</span><span />
        </div>
        {tracks.map((track, index) => {
          const current = playback.trackId === track.id;
          const playing = current && playback.status === "playing";
          const selected = selectedSet.has(track.id);
          const menuIds = actionIds(track.id);
          const menuTracks = tracks.filter((item) => menuIds.includes(item.id));
          const allFavorite = menuTracks.every((item) => item.isFavorite);
          const rowClassName = [
            "track-row",
            track.isMissing && "track-row--missing",
            current && "track-row--current",
            selected && "track-row--selected",
            dragOverTrackId === track.id && "track-row--drag-over",
          ].filter(Boolean).join(" ");

          return (
            <ContextMenu key={track.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={rowClassName}
                  role="row"
                  aria-current={current ? "true" : undefined}
                  aria-selected={selected}
                  draggable={!track.isMissing}
                  onClickCapture={(event) => toggleSelection(event, track.id)}
                  onDragStart={(event) => startDrag(event, track)}
                  onDragEnd={() => setDragOverTrackId(null)}
                  onDragOver={(event) => {
                    if (!onReorderTracks || !hasTrackDragData(event.dataTransfer)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverTrackId(track.id);
                  }}
                  onDragLeave={() => setDragOverTrackId((currentId) => currentId === track.id ? null : currentId)}
                  onDrop={(event) => void dropTracks(event, track.id)}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={wrap(() => playTrack(track))}
                    disabled={track.isMissing}
                    aria-label={playing ? `Поставить на паузу ${trackDisplayTitle(track)}` : `Воспроизвести ${trackDisplayTitle(track)}`}
                  >
                    {track.isMissing
                      ? <AlertTriangle />
                      : <><span className="track-index">{index + 1}</span>{playing ? <Pause className="track-play" /> : <Play className="track-play" />}</>}
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
                    <Button size="icon" variant="ghost" className="track-add-playlist" onClick={() => setTracksToAdd([track.id])} aria-label="Добавить в плейлист"><ListPlus /></Button>
                    <Button size="icon" variant="ghost" className={track.isFavorite ? "is-favorite" : ""} onClick={wrap(() => toggleFavoriteAction(track.id))} aria-label="Избранное"><Heart fill={track.isFavorite ? "currentColor" : "none"} /></Button>
                    <TrackActionsMenu track={track} />
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => setTracksToAdd(menuIds)}>
                  <ListPlus /><span>Добавить в плейлист{menuIds.length > 1 ? ` (${menuIds.length})` : ""}</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void run(() => appendQueueAction(menuIds), "Добавлено в очередь")}>
                  <ListMusic /><span>Добавить в очередь</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void run(
                  () => setTracksFavoriteAction(menuIds, !allFavorite),
                  allFavorite ? "Удалено из избранного" : "Добавлено в избранное",
                )}>
                  <Heart fill={allFavorite ? "currentColor" : "none"} />
                  <span>{allFavorite ? "Убрать из избранного" : "Добавить в избранное"}</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  disabled={menuIds.length !== 1 || track.isMissing}
                  onSelect={() => void run(() => revealTrackAction(track.filePath))}
                >
                  <FolderOpen /><span>Открыть расположение</span>
                </ContextMenuItem>
                {onRemoveFromPlaylist && (
                  <ContextMenuItem onSelect={() => void run(
                    async () => {
                      await onRemoveFromPlaylist(menuIds);
                      selectedTrackIdsAtom.set([]);
                    },
                    menuIds.length === 1 ? "Трек убран из плейлиста" : "Треки убраны из плейлиста",
                  )}>
                    <Trash2 /><span>Убрать из этого плейлиста</span>
                  </ContextMenuItem>
                )}
                <ContextMenuItem destructive onSelect={() => setTracksToRemove(menuIds)}>
                  <Trash2 /><span>Удалить из медиатеки</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      <AddTrackToPlaylistDialog
        open={tracksToAdd.length > 0}
        trackIds={tracksToAdd}
        trackTitle={tracksToAdd.length === 1
          ? trackDisplayTitle(tracks.find((track) => track.id === tracksToAdd[0]) ?? tracks[0])
          : ""}
        onOpenChange={(open) => !open && setTracksToAdd([])}
      />

      <Dialog open={tracksToRemove.length > 0} onOpenChange={(open) => !removing && !open && setTracksToRemove([])}>
        <DialogContent className="dialog-content--compact">
          <DialogHeader>
            <span className="dialog-icon dialog-icon--danger"><Trash2 /></span>
            <div>
              <DialogTitle>{tracksToRemove.length === 1 ? "Удалить трек из медиатеки?" : `Удалить ${tracksToRemove.length} трека из медиатеки?`}</DialogTitle>
              <DialogDescription>Треки исчезнут из коллекции и плейлистов, но исходные аудиофайлы останутся на диске.</DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={removing}>Отмена</Button></DialogClose>
            <Button type="button" variant="destructive" disabled={removing} onClick={() => void confirmRemove()}>
              {removing && <LoaderCircle className="spin" />}Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}, "TrackList");
