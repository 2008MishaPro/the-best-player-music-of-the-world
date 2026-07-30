import { action, atom } from "@reatom/core";
import {
  applyQueue,
  queueApi,
  queueAtom,
  type QueueSource,
} from "@/entities/playback-queue";

export { queueAtom };
export const queueOpenAtom = atom(false, "queueOpenAtom");

export const loadQueueAction = action(async () => applyQueue(await queueApi.get()), "loadQueueAction");
export const replaceQueueAction = action(async (itemIds: string[], source: QueueSource | null, currentIndex = 0) =>
  applyQueue(await queueApi.replace(itemIds, source, currentIndex)), "replaceQueueAction");
export const appendQueueAction = action(async (trackIds: string[]) => applyQueue(await queueApi.append(trackIds)), "appendQueueAction");
export const insertNextAction = action(async (trackId: string) => applyQueue(await queueApi.insertNext(trackId)), "insertNextAction");
export const removeQueueItemAction = action(async (index: number) => applyQueue(await queueApi.remove(index)), "removeQueueItemAction");
export const reorderQueueAction = action(async (from: number, to: number) => applyQueue(await queueApi.reorder(from, to)), "reorderQueueAction");
export const clearQueueAction = action(async () => applyQueue(await queueApi.clear()), "clearQueueAction");
