import { reatomComponent } from "@reatom/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Disc3, Heart, Library, Pin, Sparkles } from "lucide-react";
import { favoritesAtom, recentlyAddedAtom, tracksAtom } from "@/entities/track";
import { pinnedPlaylistsAtom } from "@/entities/playlist";
import { ImportButtons } from "@/features/import-music";
import { Button } from "@/shared/ui";
import { TrackList } from "@/widgets/track-list";

export const HomePage = reatomComponent(() => {
  const tracks = tracksAtom();
  const recent = recentlyAddedAtom();
  const favorites = favoritesAtom();
  const pinned = pinnedPlaylistsAtom();
  if (!tracks.length) return <section className="empty-hero"><span className="hero-disc"><Disc3 /></span><div><p className="eyebrow"><Sparkles /> Ваша музыка, локально</p><h1>Соберите медиатеку<br />без облака и подписок</h1><p>Добавьте папку с музыкой. Файлы останутся на месте, а Resonance сохранит метаданные и подготовит анализ.</p><ImportButtons /></div></section>;
  return <section className="page"><header className="page-header"><div><p className="eyebrow">Добрый вечер</p><h1>Главная</h1><p>Продолжайте слушать или откройте недавние добавления.</p></div><ImportButtons /></header>
    {!!pinned.length && <div className="section-block"><div className="section-title"><h2><Pin />Закреплённые плейлисты</h2></div><div className="playlist-grid">{pinned.map((playlist) => <Link className="playlist-card" key={playlist.id} to="/playlist/$playlistId" params={{ playlistId: playlist.id }}><span><Library /></span><strong>{playlist.name}</strong><small>{playlist.trackCount} треков</small></Link>)}</div></div>}
    <div className="section-block"><div className="section-title"><h2>Недавно добавлено</h2><Button variant="ghost" asChild><Link to="/library">Все треки <ArrowRight /></Link></Button></div><TrackList tracks={recent.slice(0, 6)} /></div>
    {!!favorites.length && <div className="stats-strip"><Heart /><div><strong>{favorites.length}</strong><span>треков в избранном</span></div><Button variant="secondary" asChild><Link to="/favorites">Открыть</Link></Button></div>}
  </section>;
}, "HomePage");
