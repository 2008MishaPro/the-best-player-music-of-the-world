import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { reatomComponent } from "@reatom/react";
import { Activity, GripHorizontal, X } from "lucide-react";
import { displayedThemeAtom } from "@/entities/theme";
import { Button } from "@/shared/ui";

type SpectrumWindowProps = {
  open: boolean;
  bins: number[];
  trackTitle: string;
  playing: boolean;
  onClose: () => void;
};

const SpectrumCanvas = reatomComponent(({ bins }: { bins: number[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = displayedThemeAtom().colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    context.strokeStyle = colors.canvasGrid;
    context.lineWidth = 1;
    for (let line = 1; line < 4; line += 1) {
      const y = (rect.height * line) / 4;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(rect.width, y);
      context.stroke();
    }

    const gap = 3;
    const width = Math.max(2, (rect.width - gap * Math.max(0, bins.length - 1)) / Math.max(1, bins.length));
    const gradient = context.createLinearGradient(0, rect.height, 0, 0);
    gradient.addColorStop(0, colors.visualizerLow);
    gradient.addColorStop(.58, colors.accent);
    gradient.addColorStop(1, colors.visualizerHigh);
    context.fillStyle = gradient;
    bins.forEach((value, index) => {
      const height = Math.max(2, value * (rect.height - 20));
      const x = index * (width + gap);
      context.fillRect(x, rect.height - height, width, height);
    });
  }, [bins, colors]);

  return <canvas ref={canvasRef} className="spectrum-canvas" />;
}, "SpectrumCanvas");

export function SpectrumWindow({ open, bins, trackTitle, playing, onClose }: SpectrumWindowProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState(() => ({
    x: Math.max(12, window.innerWidth - 430),
    y: Math.max(40, window.innerHeight - 420),
  }));

  if (!open) return null;

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: ReactPointerEvent<HTMLElement>) => {
    const active = dragRef.current;
    const panel = panelRef.current;
    if (!active || active.pointerId !== event.pointerId || !panel) return;
    const rect = panel.getBoundingClientRect();
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - active.offsetX)),
      y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - active.offsetY)),
    });
  };

  const stopDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div ref={panelRef} className="spectrum-window" style={{ left: position.x, top: position.y }}>
      <header className="spectrum-window-handle" onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <div><span className="spectrum-live-dot" data-playing={playing} /><strong>Спектр частот</strong></div>
        <div><GripHorizontal /><Button size="icon" variant="ghost" onClick={onClose} aria-label="Закрыть спектр"><X /></Button></div>
      </header>
      <div className="spectrum-copy"><Activity /><span>{trackTitle || "Включите трек"}</span><small>{playing ? "В реальном времени" : "Ожидание сигнала"}</small></div>
      <SpectrumCanvas bins={bins} />
      <div className="spectrum-labels"><span>35 Hz</span><span>250</span><span>1k</span><span>4k</span><span>18k</span></div>
    </div>
  );
}
