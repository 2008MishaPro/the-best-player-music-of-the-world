import { atom } from "@reatom/core";
import { EMPTY_QUEUE, type PlaybackQueue } from "./types.ts";

export const queueAtom = atom<PlaybackQueue>(EMPTY_QUEUE, "queueAtom");
export const applyQueue = (queue: PlaybackQueue) => {
  queueAtom.set(queue);
  return queue;
};
