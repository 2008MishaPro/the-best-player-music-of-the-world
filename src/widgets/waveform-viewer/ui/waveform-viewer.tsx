import { useEffect, useRef } from "react";
import type { WaveformPoint } from "@/entities/track-analysis";

type WaveformViewerProps = { points: WaveformPoint[]; progress?: number; onSeek?: (ratio: number) => void };

export function WaveformViewer({ points, progress = 0, onSeek }: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const middle = rect.height / 2;
    const barWidth = Math.max(1, rect.width / Math.max(points.length, 1));
    points.forEach((point, index) => {
      const x = index * barWidth;
      const minY = middle + point.min * middle * 0.85;
      const maxY = middle + point.max * middle * 0.85;
      ctx.fillStyle = index / points.length <= progress ? "#f3b33d" : "#495064";
      ctx.fillRect(x, minY, Math.max(1, barWidth - 1), Math.max(1, maxY - minY));
    });
  }, [points, progress]);
  return <canvas className="waveform-canvas" ref={canvasRef} onPointerDown={(event) => {
    if (!onSeek) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
  }} />;
}
