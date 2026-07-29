import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { ListMusic, Trash2, X } from "lucide-react";
import { trackDisplayArtist, trackDisplayTitle, tracksAtom } from "@/entities/track";
import { clearQueueAction, queueAtom, queueOpenAtom, removeQueueItemAction } from "@/features/manage-playback-queue";
import { Button } from "@/shared/ui";

export const PlaybackQueuePanel = reatomComponent(() => {
  if (!queueOpenAtom()) return null;
  const queue = queueAtom();
  const trackMap = new Map(tracksAtom().map((track) => [track.id, track]));
  return (
    <aside className="queue-panel">
      <header><div><ListMusic /><strong>Очередь</strong></div><Button size="icon" variant="ghost" onClick={() => queueOpenAtom.set(false)}><X /></Button></header>
      <div className="queue-source">Источник: {queue.source?.type ?? "не выбран"}</div>
      <div className="queue-items">
        {queue.itemIds.map((id, index) => {
          const track = trackMap.get(id);
          if (!track) return null;
          return <div className={index === queue.currentIndex ? "queue-item queue-item--current" : "queue-item"} key={`${id}-${index}`}><span>{index + 1}</span><div><strong>{trackDisplayTitle(track)}</strong><small>{trackDisplayArtist(track)}</small></div><Button size="icon" variant="ghost" onClick={wrap(() => removeQueueItemAction(index))}><X /></Button></div>;
        })}
        {!queue.itemIds.length && <div className="empty-inline">Очередь пуста</div>}
      </div>
      <Button variant="secondary" onClick={wrap(clearQueueAction)} disabled={!queue.itemIds.length}><Trash2 />Очистить очередь</Button>
    </aside>
  );
}, "PlaybackQueuePanel");
