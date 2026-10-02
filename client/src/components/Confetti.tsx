/* STUDENT OS — lightweight confetti burst. Pure CSS/React, no deps.
   Renders colored confetti pieces that explode outward and fade. */

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const COLORS = [
  "#F47458",
  "#F0B848",
  "#9B7FD6",
  "#5FA8C8",
  "#5FB87A",
  "#F4A9B8",
];

interface Piece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  delay: string;
  size: number;
}

export function ConfettiBurst({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const count = prefersReduced ? 0 : 24;
    const next = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 260,
      y: -Math.random() * 220 - 40,
      color: COLORS[i % COLORS.length],
      rotation: Math.random() * 360,
      delay: `${Math.random() * 0.25}s`,
      size: 5 + Math.random() * 6,
    }));
    setPieces(next);
    const t = window.setTimeout(() => setPieces([]), 1400);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (pieces.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible z-10"
      aria-hidden
    >
      {pieces.map(p => (
        <span
          key={p.id}
          className={cn("absolute left-1/2 top-1/2")}
          style={{
            width: p.size,
            height: p.size * 0.55,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFly 1.2s cubic-bezier(0.23, 1, 0.32, 1) ${p.delay} both`,
            ["--fly-x" as string]: `${p.x}px`,
            ["--fly-y" as string]: `${p.y}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFly {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--fly-x)), calc(-50% + var(--fly-y))) scale(1) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
