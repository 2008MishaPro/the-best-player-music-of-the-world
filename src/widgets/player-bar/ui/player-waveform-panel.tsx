import { useEffect, useRef, useState } from "react";
import { reatomComponent } from "@reatom/react";
import { AudioWaveform, LoaderCircle, X } from "lucide-react";
import { displayedThemeAtom, type ThemeColors } from "@/entities/theme";
import type { WaveformPoint } from "@/entities/track-analysis";
import {
  analysisByTrackIdAtom,
  analysisErrorAtom,
  ensureAnalysisAction,
  waveformAtom,
} from "@/features/start-track-analysis";
import { Button } from "@/shared/ui";

type PlayerWaveformPanelProps = {
  open: boolean;
  trackId: string | null;
  trackTitle: string;
  positionMs: number;
  durationMs: number;
  onClose: () => void;
  onSeek: (positionMs: number) => void;
};

type TimelineCanvasProps = {
  points: WaveformPoint[];
  progress: number;
  colors: ThemeColors;
  onSeek: (ratio: number) => void;
};

function TimelineCanvas({ points, progress, colors, onSeek }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draftRatio, setDraftRatio] = useState<number | null>(null);
  const shownProgress = draftRatio ?? progress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const middle = rect.height / 2;
      const barWidth = rect.width / Math.max(points.length, 1);
      context.fillStyle = colors.canvasGrid;
      for (let line = 1; line < 4; line += 1) {
        context.fillRect(0, (rect.height * line) / 4, rect.width, 1);
      }

      points.forEach((point, index) => {
        const x = index * barWidth;
        const amplitudeTop = Math.max(1, Math.abs(point.max) * (middle - 8));
        const amplitudeBottom = Math.max(1, Math.abs(point.min) * (middle - 8));
        context.fillStyle = index / points.length <= shownProgress
          ? colors.accent
          : colors.waveformIdle;
        context.fillRect(x, middle - amplitudeTop, Math.max(1, barWidth - 1), amplitudeTop + amplitudeBottom);
      });

      const playheadX = Math.max(0, Math.min(rect.width, shownProgress * rect.width));
      context.fillStyle = colors.visualizerHigh;
      context.fillRect(playheadX, 0, 1.5, rect.height);
      context.beginPath();
      context.arc(playheadX, 5, 3.5, 0, Math.PI * 2);
      context.fill();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [colors, points, shownProgress]);

  const ratioAt = (element: HTMLCanvasElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  return (
    <canvas
      ref={canvasRef}
      className="player-waveform-canvas"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraftRatio(ratioAt(event.currentTarget, event.clientX));
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          setDraftRatio(ratioAt(event.currentTarget, event.clientX));
        }
      }}
      onPointerUp={(event) => {
        const ratio = ratioAt(event.currentTarget, event.clientX);
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDraftRatio(null);
        onSeek(ratio);
      }}
      onPointerCancel={() => setDraftRatio(null)}
    />
  );
}

export const PlayerWaveformPanel = reatomComponent<PlayerWaveformPanelProps>(({
  open,
  trackId,
  trackTitle,
  positionMs,
  durationMs,
  onClose,
  onSeek,
}) => {
  const waveform = waveformAtom();
  const statuses = analysisByTrackIdAtom();
  const error = analysisErrorAtom();
  const colors = displayedThemeAtom().colors;
  const status = trackId ? statuses[trackId] : null;

  useEffect(() => {
    if (open && trackId) void ensureAnalysisAction(trackId);
  }, [open, trackId]);

  if (!open) return null;
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <section className="player-waveform-panel" aria-label="Таймлайн трека">
      <header>
        <div><AudioWaveform /><strong>{trackTitle || "Таймлайн"}</strong><span>Waveform</span></div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Закрыть таймлайн"><X /></Button>
      </header>
      {!trackId ? (
        <div className="player-analysis-empty">Сначала включите трек</div>
      ) : waveform.length ? (
        <TimelineCanvas
          points={waveform}
          progress={progress}
          colors={colors}
          onSeek={(ratio) => onSeek(ratio * durationMs)}
        />
      ) : (
        <div className="player-analysis-loading">
          <LoaderCircle className="spin" />
          <span>{error || (status?.status === "failed" ? status.error : "Строим waveform трека…")}</span>
          {status?.status === "running" && <small>{Math.round(status.progress * 100)}%</small>}
        </div>
      )}
    </section>
  );
}, "PlayerWaveformPanel");
