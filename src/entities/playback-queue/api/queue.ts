import { command } from "@/shared/api";
import type { PlaybackQueue, QueueSource } from "../model/types.ts";

export const queueApi = {
  get: () => command<PlaybackQueue>("queue_get"),
  replace: (itemIds: string[], source: QueueSource | null, currentIndex = 0) => command<PlaybackQueue>("queue_replace", { itemIds, source, currentIndex }),
  append: (trackIds: string[]) => command<PlaybackQueue>("queue_append", { trackIds }),
  insertNext: (trackId: string) => command<PlaybackQueue>("queue_insert_next", { trackId }),
  remove: (index: number) => command<PlaybackQueue>("queue_remove", { index }),
  reorder: (from: number, to: number) => command<PlaybackQueue>("queue_reorder", { from, to }),
  clear: () => command<PlaybackQueue>("queue_clear"),
};
