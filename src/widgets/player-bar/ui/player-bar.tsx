import { useRef, useState } from "react";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { AudioWaveform, BarChart3, Heart, ListMusic, Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { trackDisplayArtist, trackDisplayTitle } from "@/entities/track";
import {
  currentTrackAtom, nextAction, playbackSnapshotAtom, previousAction, seekAction,
  setRepeatAction, setShuffleAction, setVolumeAction, togglePlaybackAction,
} from "@/features/control-playback";
import { queueOpenAtom } from "@/features/manage-playback-queue";
import { toggleFavoriteAction } from "@/features/toggle-track-favorite";
import { formatDuration } from "@/shared/lib/format.ts";
import { Button } from "@/shared/ui";
import { PlayerWaveformPanel } from "./player-waveform-panel.tsx";
import { SpectrumWindow } from "./spectrum-window.tsx";

type SeekControlProps = {
  positionMs: number;
  durationMs: number;
};

function SeekControl({ positionMs, durationMs }: SeekControlProps) {
  const [draftPosition, setDraftPosition] = useState<number | null>(null);
  const latestCommit = useRef(0);
  const shownPosition = draftPosition ?? positionMs;

  const commit = async (value: number) => {
    if (durationMs <= 0) return;
    const target = Math.max(0, Math.min(value, durationMs));
    const commitId = ++latestCommit.current;
    setDraftPosition(target);
    try {
      await seekAction(target);
    } finally {
      if (commitId === latestCommit.current) setDraftPosition(null);
    }
  };

  return (
    <div className="seek-row">
      <span>{formatDuration(shownPosition)}</span>
      <input
        aria-label="Позиция"
        type="range"
        min={0}
        max={Math.max(durationMs, 1)}
        value={Math.min(shownPosition, durationMs)}
        disabled={durationMs <= 0}
        onChange={(event) => setDraftPosition(Number(event.currentTarget.value))}
        onPointerUp={(event) => void commit(Number(event.currentTarget.value))}
        onPointerCancel={() => setDraftPosition(null)}
        onKeyUp={(event) => {
          if (draftPosition !== null) void commit(Number(event.currentTarget.value));
        }}
      />
      <span>{formatDuration(durationMs)}</span>
    </div>
  );
}

export const PlayerBar = reatomComponent(() => {
  const snapshot = playbackSnapshotAtom();
  const track = currentTrackAtom();
  const [waveformOpen, setWaveformOpen] = useState(false);
  const [spectrumOpen, setSpectrumOpen] = useState(false);
  const repeatIcon = snapshot.repeat === "one" ? <Repeat1 /> : <Repeat />;
  const cycleRepeat = () => setRepeatAction(snapshot.repeat === "off" ? "all" : snapshot.repeat === "all" ? "one" : "off");
  const trackTitle = track ? trackDisplayTitle(track) : "";
  return (
    <>
      <footer className="player-bar">
      <div className="now-playing">
        <span className="now-cover"><Music2 /></span>
        <span className="now-copy"><strong>{track ? trackDisplayTitle(track) : "Ничего не играет"}</strong><small>{track ? trackDisplayArtist(track) : "Выберите трек"}</small></span>
        {track && <Button size="icon" variant="ghost" className={track.isFavorite ? "is-favorite" : ""} onClick={wrap(() => toggleFavoriteAction(track.id))}><Heart fill={track.isFavorite ? "currentColor" : "none"} /></Button>}
      </div>
      <div className="transport">
        <div className="transport-buttons">
          <Button size="icon" variant="ghost" className={snapshot.shuffle ? "is-active" : ""} onClick={wrap(() => setShuffleAction(!snapshot.shuffle))}><Shuffle /></Button>
          <Button size="icon" variant="ghost" onClick={wrap(previousAction)}><SkipBack fill="currentColor" /></Button>
          <Button size="icon" className="play-main" onClick={wrap(togglePlaybackAction)} disabled={!track}>{snapshot.status === "playing" ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</Button>
          <Button size="icon" variant="ghost" onClick={wrap(nextAction)}><SkipForward fill="currentColor" /></Button>
          <Button size="icon" variant="ghost" className={snapshot.repeat !== "off" ? "is-active" : ""} onClick={wrap(cycleRepeat)}>{repeatIcon}</Button>
        </div>
        <SeekControl positionMs={snapshot.positionMs} durationMs={snapshot.durationMs} />
      </div>
      <div className="player-tools">
        <Button size="icon" variant="ghost" className={waveformOpen ? "is-active" : ""} onClick={() => setWaveformOpen((open) => !open)} disabled={!track} aria-label="Показать waveform"><AudioWaveform /></Button>
        <Button size="icon" variant="ghost" className={spectrumOpen ? "is-active" : ""} onClick={() => setSpectrumOpen((open) => !open)} aria-label="Показать спектр частот"><BarChart3 /></Button>
        <Button size="icon" variant="ghost" onClick={() => queueOpenAtom.set(!queueOpenAtom())}><ListMusic /></Button>
        <Volume2 />
        <input aria-label="Громкость" type="range" min={0} max={1} step={0.01} value={snapshot.volume} onChange={(event) => setVolumeAction(Number(event.currentTarget.value))} />
      </div>
      </footer>
      <PlayerWaveformPanel
        open={waveformOpen}
        trackId={track?.id ?? null}
        trackTitle={trackTitle}
        positionMs={snapshot.positionMs}
        durationMs={snapshot.durationMs}
        onClose={() => setWaveformOpen(false)}
        onSeek={(positionMs) => void seekAction(positionMs)}
      />
      <SpectrumWindow
        open={spectrumOpen}
        bins={snapshot.spectrum}
        trackTitle={trackTitle}
        playing={snapshot.status === "playing"}
        onClose={() => setSpectrumOpen(false)}
      />
    </>
  );
}, "PlayerBar");
