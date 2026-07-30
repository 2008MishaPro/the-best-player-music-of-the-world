import { useEffect, useRef } from "react";
import { reatomComponent } from "@reatom/react";
import { displayedThemeAtom } from "@/entities/theme";
import type { PeakFrame } from "@/entities/track-analysis";

export const PeakMap = reatomComponent(({ frames }: { frames: PeakFrame[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = displayedThemeAtom().colors;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const width = rect.width / Math.max(frames.length, 1);
    frames.forEach((frame, index) => {
      const normalized = Math.max(0, Math.min(1, (frame.peakDb + 60) / 60));
      ctx.fillStyle = frame.clippingSamples > 0
        ? colors.danger
        : normalized > 0.85
          ? colors.accent
          : colors.green;
      ctx.fillRect(index * width, rect.height * (1 - normalized), Math.max(1, width), rect.height * normalized);
    });
  }, [colors, frames]);
  return <canvas className="peak-canvas" ref={canvasRef} />;
}, "PeakMap");
