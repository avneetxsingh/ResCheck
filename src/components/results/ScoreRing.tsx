"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  animate?: boolean;
}

const SIZE_MAP = {
  sm: { svg: 64, r: 24, stroke: 5, fontSize: "text-base", labelSize: "text-[9px]" },
  md: { svg: 96, r: 36, stroke: 6, fontSize: "text-xl", labelSize: "text-[11px]" },
  lg: { svg: 140, r: 54, stroke: 8, fontSize: "text-3xl", labelSize: "text-xs" },
};

function scoreColor(score: number) {
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export function ScoreRing({ score, size = "md", label, animate = true }: ScoreRingProps) {
  // Clamp to valid range before any calculation — guards against AI returning out-of-bounds scores
  const clampedScore = Math.min(100, Math.max(0, score));
  const [displayed, setDisplayed] = useState(animate ? 0 : clampedScore);
  const { svg, r, stroke, fontSize, labelSize } = SIZE_MAP[size];

  useEffect(() => {
    if (!animate) return;
    let current = 0;
    const step = Math.ceil(clampedScore / 40);
    const timer = setInterval(() => {
      current = Math.min(current + step, clampedScore);
      setDisplayed(current);
      if (current >= clampedScore) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [clampedScore, animate]);

  const circumference = 2 * Math.PI * r;
  const dash = (displayed / 100) * circumference;
  const color = scoreColor(displayed);
  const center = svg / 2;

  return (
    <div className="flex flex-col items-center gap-1" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`Score: ${score}`}>
      <svg width={svg} height={svg} viewBox={`0 0 ${svg} ${svg}`} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.05s linear, stroke 0.3s" }}
        />
      </svg>
      {/* Label overlay */}
      <div
        className="flex flex-col items-center"
        style={{ marginTop: -(svg + 8) }}
      >
        <div style={{ height: svg }} className="flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums", fontSize)} style={{ color }}>
            {displayed}
          </span>
          {label && (
            <span className={cn("text-muted-foreground text-center leading-tight mt-0.5 max-w-[5rem]", labelSize)}>
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
