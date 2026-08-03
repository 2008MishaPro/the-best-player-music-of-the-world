export const TRACK_DRAG_TYPE = "application/x-resonance-track-ids";
export const PLAYLIST_DRAG_TYPE = "application/x-resonance-playlist-id";

type DraggableTrack = {
  id: string;
  filePath: string;
  fileName: string;
};

const normalizeWindowsExtendedPath = (path: string) => {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice(8)}`;
  if (path.startsWith("\\\\?\\")) return path.slice(4);
  return path;
};

const pathToFileUrl = (path: string) => {
  const normalized = normalizeWindowsExtendedPath(path).replace(/\\/g, "/");
  const url = new URL("file:///");
  url.pathname = normalized.startsWith("//") ? normalized : `/${normalized}`;
  return url.href;
};

export const writeTrackDragData = (dataTransfer: DataTransfer, tracks: DraggableTrack[]) => {
  dataTransfer.effectAllowed = "copyMove";
  dataTransfer.setData(TRACK_DRAG_TYPE, JSON.stringify(tracks.map((track) => track.id)));
  dataTransfer.setData("text/plain", tracks.map((track) => normalizeWindowsExtendedPath(track.filePath)).join("\r\n"));
  dataTransfer.setData("text/uri-list", tracks.map((track) => pathToFileUrl(track.filePath)).join("\r\n"));
  if (tracks.length === 1) {
    dataTransfer.setData(
      "DownloadURL",
      `application/octet-stream:${tracks[0].fileName}:${pathToFileUrl(tracks[0].filePath)}`,
    );
  }
};

export const readTrackDragData = (dataTransfer: DataTransfer): string[] => {
  try {
    const value = JSON.parse(dataTransfer.getData(TRACK_DRAG_TYPE));
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export const hasTrackDragData = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).includes(TRACK_DRAG_TYPE);
