import { reatomComponent } from "@reatom/react";
import { Search } from "lucide-react";
import {
  filteredTracksAtom,
  libraryErrorAtom,
  libraryLoadingAtom,
  missingTracksCountAtom,
  tracksQueryAtom,
} from "@/entities/track";
import { ImportButtons } from "@/features/import-music";
import { Badge, Input } from "@/shared/ui";
import { TrackList } from "@/widgets/track-list";

export const LibraryPage = reatomComponent(() => {
  const tracks = filteredTracksAtom();
  const loading = libraryLoadingAtom();
  const error = libraryErrorAtom();
  const missing = missingTracksCountAtom();
  return (
    <section className="page"><header className="page-header"><div><p className="eyebrow">Локальная коллекция</p><h1>Медиатека</h1><p>{tracks.length} треков {missing > 0 && <Badge>{missing} недоступно</Badge>}</p></div><ImportButtons /></header>
      <div className="toolbar"><label className="search-field"><Search /><Input value={tracksQueryAtom()} onChange={(event) => tracksQueryAtom.set(event.currentTarget.value)} placeholder="Исполнитель, альбом или трек" /></label></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="empty-inline">Загрузка медиатеки…</div> : <TrackList tracks={tracks} emptyMessage="Добавьте файлы или папку с музыкой" />}
    </section>
  );
}, "LibraryPage");
