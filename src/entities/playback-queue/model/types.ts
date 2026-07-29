export type QueueSource =
  | { type: "playlist"; playlistId: string }
  | { type: "library" }
  | { type: "favorites" }
  | { type: "recent" }
  | { type: "manual" };

export type PlaybackQueue = {
  source: QueueSource | null;
  itemIds: string[];
  currentIndex: number;
  history: string[];
};

export const EMPTY_QUEUE: PlaybackQueue = { source: null, itemIds: [], currentIndex: -1, history: [] };
