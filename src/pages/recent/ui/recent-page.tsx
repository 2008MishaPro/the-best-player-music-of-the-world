import { reatomComponent } from "@reatom/react";
import { Clock3 } from "lucide-react";
import { recentTracksAtom } from "@/entities/track";
import { TrackList } from "@/widgets/track-list";

export const RecentPage = reatomComponent(() => <section className="page"><header className="page-header"><div><p className="eyebrow"><Clock3 /> История</p><h1>Недавно прослушано</h1><p>Треки, к которым хочется вернуться.</p></div></header><TrackList tracks={recentTracksAtom()} emptyMessage="История появится после первого прослушивания" /></section>, "RecentPage");
