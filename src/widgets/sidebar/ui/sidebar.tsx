import { useState } from "react";
import { reatomComponent } from "@reatom/react";
import { Link } from "@tanstack/react-router";
import { AudioWaveform, Clock3, Heart, Home, Library, ListMusic, Pin, Plus, Settings } from "lucide-react";
import { playlistsAtom } from "@/entities/playlist";
import { CreatePlaylistDialog } from "@/features/create-playlist";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";

const navigation = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/library", label: "Медиатека", icon: Library },
  { to: "/favorites", label: "Избранное", icon: Heart },
  { to: "/recent", label: "Недавние", icon: Clock3 },
] as const;

export const Sidebar = reatomComponent(() => {
  const playlists = playlistsAtom();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [mobilePlaylistsOpen, setMobilePlaylistsOpen] = useState(false);

  return (
    <>
      <header className="mobile-header">
        <Link to="/" className="mobile-brand" aria-label="Resonance — главная">
          <span className="brand-mark"><AudioWaveform /></span>
          <span>Resonance<small>local audio</small></span>
        </Link>
        <div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCreateDialogOpen(true)}
            aria-label="Создать плейлист"
          >
            <Plus />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobilePlaylistsOpen(true)}
            aria-label="Открыть плейлисты"
          >
            <ListMusic />
          </Button>
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
              <Link key={playlist.id} to="/playlist/$playlistId" params={{ playlistId: playlist.id }}>
                <ListMusic />
                <span>{playlist.name}</span>
                {playlist.isPinned && <Pin className="playlist-pin" aria-label="Закреплён" />}
              </Link>
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
            <div>
              <DialogTitle>Плейлисты</DialogTitle>
              <DialogDescription>Ваши подборки музыки.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="mobile-playlist-list">
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                to="/playlist/$playlistId"
                params={{ playlistId: playlist.id }}
                onClick={() => setMobilePlaylistsOpen(false)}
              >
                <span><ListMusic /></span>
                <span><strong>{playlist.name}</strong><small>{playlist.trackCount} треков</small></span>
                {playlist.isPinned && <Pin className="playlist-pin" aria-label="Закреплён" />}
              </Link>
            ))}
            {!playlists.length && <div className="dialog-empty"><ListMusic /><strong>Плейлистов пока нет</strong><span>Создайте первый плейлист и добавьте в него любимые треки.</span></div>}
          </div>
          <Button onClick={() => {
            setMobilePlaylistsOpen(false);
            setCreateDialogOpen(true);
          }}>
            <Plus /> Создать плейлист
          </Button>
        </DialogContent>
      </Dialog>
      <CreatePlaylistDialog
        open={createDialogOpen}
        suggestedName={`Плейлист ${playlists.length + 1}`}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}, "Sidebar");
