import { useState, type FormEvent } from "react";
import { Check, ListMusic, LoaderCircle, Music2 } from "lucide-react";
import { reatomComponent } from "@reatom/react";
import { toast } from "sonner";
import { playlistsAtom, type Playlist } from "@/entities/playlist";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";
import { addTrackToPlaylistsAction } from "../model/playlist-tracks.ts";

type AddTrackToPlaylistDialogProps = {
  open: boolean;
  trackId: string | null;
  trackTitle: string;
  onOpenChange: (open: boolean) => void;
};

export const AddTrackToPlaylistDialog = reatomComponent<AddTrackToPlaylistDialogProps>(({
  open,
  trackId,
  trackTitle,
  onOpenChange,
}) => {
  const playlists = playlistsAtom();
  if (!open) return null;
  return <OpenAddTrackToPlaylistDialog playlists={playlists} trackId={trackId} trackTitle={trackTitle} onOpenChange={onOpenChange} />;
}, "AddTrackToPlaylistDialog");

type OpenAddTrackToPlaylistDialogProps = Omit<AddTrackToPlaylistDialogProps, "open"> & {
  playlists: Playlist[];
};

function OpenAddTrackToPlaylistDialog({ playlists, trackId, trackTitle, onOpenChange }: OpenAddTrackToPlaylistDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const togglePlaylist = (playlistId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackId || !selectedIds.size) return;
    const playlistIds = [...selectedIds];

    setSubmitting(true);
    setError(null);
    try {
      const insertedCount = await addTrackToPlaylistsAction(playlistIds, trackId);
      if (insertedCount === 0) {
        toast.info("Трек уже есть в выбранных плейлистах");
      } else {
        toast.success("Трек добавлен", {
          description: insertedCount === 1 && playlistIds.length === 1
            ? playlists.find((playlist) => playlist.id === playlistIds[0])?.name
            : `Новых добавлений: ${insertedCount} из ${playlistIds.length}`,
        });
      }
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent className="dialog-content--playlist-picker">
        <form onSubmit={submit}>
          <DialogHeader>
            <span className="dialog-icon"><ListMusic /></span>
            <div>
              <DialogTitle>Добавить в плейлист</DialogTitle>
              <DialogDescription>Выберите один или несколько плейлистов для трека «{trackTitle}».</DialogDescription>
            </div>
          </DialogHeader>

          {playlists.length ? (
            <div className="playlist-picker" role="group" aria-label="Плейлисты">
              {playlists.map((playlist) => {
                const selected = selectedIds.has(playlist.id);
                return (
                  <label className={`playlist-option ${selected ? "playlist-option--selected" : ""}`} key={playlist.id}>
                    <input
                      type="checkbox"
                      name="playlists"
                      value={playlist.id}
                      checked={selected}
                      onChange={() => togglePlaylist(playlist.id)}
                    />
                    <span className="playlist-option-art"><Music2 /></span>
                    <span className="playlist-option-copy">
                      <strong>{playlist.name}</strong>
                      <small>{playlist.trackCount} треков</small>
                    </span>
                    <span className="playlist-check"><Check /></span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="dialog-empty"><ListMusic /><strong>Плейлистов пока нет</strong><span>Сначала создайте плейлист кнопкой «+» в боковой панели.</span></div>
          )}

          {error && <p className="dialog-error">{error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={submitting}>Отмена</Button></DialogClose>
            <Button type="submit" disabled={submitting || !selectedIds.size || !trackId}>
              {submitting && <LoaderCircle className="spin" />}
              {selectedIds.size ? `Добавить · ${selectedIds.size}` : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
