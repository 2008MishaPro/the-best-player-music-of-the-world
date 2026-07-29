import { reatomComponent } from "@reatom/react";
import { Heart } from "lucide-react";
import { favoritesAtom } from "@/entities/track";
import { TrackList } from "@/widgets/track-list";

export const FavoritesPage = reatomComponent(() => <section className="page"><header className="page-header"><div><p className="eyebrow"><Heart /> Быстрый доступ</p><h1>Избранное</h1><p>Любимые треки в одном месте.</p></div></header><TrackList tracks={favoritesAtom()} emptyMessage="Отмечайте треки сердцем — они появятся здесь" /></section>, "FavoritesPage");
