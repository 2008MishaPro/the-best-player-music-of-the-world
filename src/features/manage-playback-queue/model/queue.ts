import { action, atom } from "@reatom/core";
import { EMPTY_QUEUE, queueApi, type PlaybackQueue, type QueueSource } from "@/entities/playback-queue";

export const queueAtom = atom<PlaybackQueue>(EMPTY_QUEUE, "queueAtom");
export const queueOpenAtom = atom(false, "queueOpenAtom");

const apply = (queue: PlaybackQueue) => queueAtom.set(queue);
export const loadQueueAction = action(async () => apply(await queueApi.get()), "loadQueueAction");
export const replaceQueueAction = action(async (itemIds: string[], source: QueueSource | null, currentIndex = 0) =>
  apply(await queueApi.replace(itemIds, source, currentIndex)), "replaceQueueAction");
export const appendQueueAction = action(async (trackIds: string[]) => apply(await queueApi.append(trackIds)), "appendQueueAction");
export const insertNextAction = action(async (trackId: string) => apply(await queueApi.insertNext(trackId)), "insertNextAction");
export const removeQueueItemAction = action(async (index: number) => apply(await queueApi.remove(index)), "removeQueueItemAction");
export const reorderQueueAction = action(async (from: number, to: number) => apply(await queueApi.reorder(from, to)), "reorderQueueAction");
export const clearQueueAction = action(async () => apply(await queueApi.clear()), "clearQueueAction");
