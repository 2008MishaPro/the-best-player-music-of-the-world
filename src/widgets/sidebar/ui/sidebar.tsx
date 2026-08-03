import { useState, type DragEvent } from "react";
import { reatomComponent } from "@reatom/react";
import { Link } from "@tanstack/react-router";
import {
  AudioWaveform,
  Clock3,
  Heart,
  Home,
  Library,
  ListMusic,
  Pin,
  PinOff,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { playlistsAtom, type Playlist } from "@/entities/playlist";
import { addTracksToPlaylistAction } from "@/features/add-track-to-playlist";
import { CreatePlaylistDialog } from "@/features/create-playlist";
import {
  deletePlaylistAction,
  pinPlaylistAction,
  reorderPlaylistsAction,
} from "@/features/edit-playlist";
import {
  hasTrackDragData,
  PLAYLIST_DRAG_TYPE,
  readTrackDragData,
} from "@/shared/lib/track-drag.ts";
import {
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

const navigation = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/library", label: "Медиатека", icon: Library },
  { to: "/favorites", label: "Избранное", icon: Heart },
  { to: "/recent", label: "Недавние", icon: Clock3 },
] as const;

const hasPlaylistDragData = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).includes(PLAYLIST_DRAG_TYPE);

export const Sidebar = reatomComponent(() => {
  const playlists = playlistsAtom();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [mobilePlaylistsOpen, setMobilePlaylistsOpen] = useState(false);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [deleting, setDeleting] = useState(false);

  const startPlaylistDrag = (event: DragEvent<HTMLAnchorElement>, playlistId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(PLAYLIST_DRAG_TYPE, playlistId);
    event.dataTransfer.setData("text/plain", playlistId);
  };

  const dropOnPlaylist = async (event: DragEvent<HTMLAnchorElement>, targetPlaylistId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverPlaylistId(null);
    const trackIds = readTrackDragData(event.dataTransfer);
    if (trackIds.length) {
      try {
        const insertedCount = await addTracksToPlaylistAction(targetPlaylistId, trackIds);
        const playlist = playlists.find((item) => item.id === targetPlaylistId);
        toast.success(insertedCount
          ? `Добавлено треков: ${insertedCount}`
          : "Эти треки уже есть в плейлисте", {
          description: playlist?.name,
        });
      } catch (error) {
        toast.error("Не удалось добавить треки", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    const draggedPlaylistId = event.dataTransfer.getData(PLAYLIST_DRAG_TYPE);
    if (!draggedPlaylistId || draggedPlaylistId === targetPlaylistId) return;
    const nextIds = playlists.map((playlist) => playlist.id);
    const from = nextIds.indexOf(draggedPlaylistId);
    const target = nextIds.indexOf(targetPlaylistId);
    if (from < 0 || target < 0) return;
    nextIds.splice(from, 1);
    nextIds.splice(target, 0, draggedPlaylistId);
    try {
      await reorderPlaylistsAction(nextIds);
    } catch (error) {
      toast.error("Не удалось переместить плейлист", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const togglePinned = async (playlist: Playlist) => {
    try {
      await pinPlaylistAction(playlist.id, !playlist.isPinned);
      toast.success(playlist.isPinned ? "Плейлист откреплён" : "Плейлист закреплён");
    } catch (error) {
      toast.error("Не удалось изменить плейлист", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const removePlaylist = async () => {
    if (!playlistToDelete) return;
    setDeleting(true);
    try {
      await deletePlaylistAction(playlistToDelete.id);
      toast.success("Плейлист удалён", { description: playlistToDelete.name });
      setPlaylistToDelete(null);
    } catch (error) {
      toast.error("Не удалось удалить плейлист", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <header className="mobile-header">
        <Link to="/" className="mobile-brand" aria-label="Resonance — главная">
          <span className="brand-mark"><AudioWaveform /></span>
          <span>Resonance<small>local audio</small></span>
        </Link>
        <div>
          <Button size="icon" variant="ghost" onClick={() => setCreateDialogOpen(true)} aria-label="Создать плейлист"><Plus /></Button>
          <Button size="icon" variant="ghost" onClick={() => setMobilePlaylistsOpen(true)} aria-label="Открыть плейлисты"><ListMusic /></Button>
        </div>
      </header>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><AudioWaveform /></span><span>Resonance<small>local audio</small></span></div>
        <nav className="sidebar-nav">
          {navigation.map(({ to, label, icon: Icon }) => <Link key={to} to={to} activeProps={{ className: "active" }}><Icon />{label}</Link>)}
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-heading"><span>Плейлисты</span><Button size="icon" variant="ghost" onClick={() => setCreateDialogOpen(true)} aria-label="Создать плейлист"><Plus /></Button></div>
          <div className="playlist-links">
            {playlists.map((playlist) => (
              <ContextMenu key={playlist.id}>
                <ContextMenuTrigger asChild>
                  <Link
                    to="/playlist/$playlistId"
                    params={{ playlistId: playlist.id }}
                    className={dragOverPlaylistId === playlist.id ? "playlist-link--drag-over" : undefined}
                    draggable
                    onDragStart={(event) => startPlaylistDrag(event, playlist.id)}
                    onDragEnd={() => setDragOverPlaylistId(null)}
                    onDragOver={(event) => {
                      if (!hasTrackDragData(event.dataTransfer) && !hasPlaylistDragData(event.dataTransfer)) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = hasTrackDragData(event.dataTransfer) ? "copy" : "move";
                      setDragOverPlaylistId(playlist.id);
                    }}
                    onDragLeave={() => setDragOverPlaylistId((current) => current === playlist.id ? null : current)}
                    onDrop={(event) => void dropOnPlaylist(event, playlist.id)}
                  >
                    <ListMusic />
                    <span>{playlist.name}</span>
                    {playlist.isPinned && <Pin className="playlist-pin" aria-label="Закреплён" />}
                  </Link>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => void togglePinned(playlist)}>
                    {playlist.isPinned ? <PinOff /> : <Pin />}
                    <span>{playlist.isPinned ? "Открепить плейлист" : "Закрепить плейлист"}</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem destructive onSelect={() => setPlaylistToDelete(playlist)}>
                    <Trash2 /><span>Удалить плейлист</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            {!playlists.length && <span className="sidebar-hint">Создайте первый плейлист</span>}
          </div>
        </div>
        <Link className="settings-link" to="/settings" activeProps={{ className: "active" }}><Settings />Настройки</Link>
      </aside>
      <Dialog open={mobilePlaylistsOpen} onOpenChange={setMobilePlaylistsOpen}>
        <DialogContent className="mobile-playlists-dialog">
          <DialogHeader>
            <span className="dialog-icon"><ListMusic /></span>
            <div><DialogTitle>Плейлисты</DialogTitle><DialogDescription>Ваши подборки музыки.</DialogDescription></div>
          </DialogHeader>
          <div className="mobile-playlist-list">
            {playlists.map((playlist) => (
              <Link key={playlist.id} to="/playlist/$playlistId" params={{ playlistId: playlist.id }} onClick={() => setMobilePlaylistsOpen(false)}>
                <span><ListMusic /></span>
                <span><strong>{playlist.name}</strong><small>{playlist.trackCount} треков</small></span>
                {playlist.isPinned && <Pin className="playlist-pin" aria-label="Закреплён" />}
              </Link>
            ))}
            {!playlists.length && <div className="dialog-empty"><ListMusic /><strong>Плейлистов пока нет</strong><span>Создайте первый плейлист и добавьте в него любимые треки.</span></div>}
          </div>
          <Button onClick={() => { setMobilePlaylistsOpen(false); setCreateDialogOpen(true); }}><Plus /> Создать плейлист</Button>
        </DialogContent>
      </Dialog>
      <CreatePlaylistDialog open={createDialogOpen} suggestedName={`Плейлист ${playlists.length + 1}`} onOpenChange={setCreateDialogOpen} />
      <Dialog open={Boolean(playlistToDelete)} onOpenChange={(open) => !deleting && !open && setPlaylistToDelete(null)}>
        <DialogContent className="dialog-content--compact">
          <DialogHeader>
            <span className="dialog-icon dialog-icon--danger"><Trash2 /></span>
            <div><DialogTitle>Удалить плейлист?</DialogTitle><DialogDescription>«{playlistToDelete?.name}» будет удалён. Треки останутся в медиатеке.</DialogDescription></div>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={deleting}>Отмена</Button></DialogClose>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void removePlaylist()}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}, "Sidebar");
