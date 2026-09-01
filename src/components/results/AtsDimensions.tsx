"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AtsDimension } from "@/lib/ats-dimensions";

interface AtsDimensionsProps {
  dimensions: AtsDimension[];
}

// Wider than tall: the left and right axis labels sit outside the polygon and
// were clipping against the viewBox edge at equal dimensions.
const WIDTH = 300;
const HEIGHT = 200;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const RADIUS = 62;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(index: number, count: number, distance: number) {
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
  return {
    x: CX + Math.cos(angle) * distance,
    y: CY + Math.sin(angle) * distance,
  };
}

/**
 * A radar over ratios the app actually computes. Two rules keep it honest:
 *
 * 1. An axis with `ratio === null` is not measurable, so it gets no vertex —
 *    the outline breaks there. Plotting it at the origin would make "we could
 *    not check this" look identical to "you failed this".
 * 2. The shape is only filled when every axis is measurable. A polygon with a
 *    hole has no meaningful area, and a filled one invites reading that area as
 *    an overall score — the number this product deleted on purpose.
 */
export function AtsDimensions({ dimensions }: AtsDimensionsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const count = dimensions.length;
  const measurable = dimensions.filter((d) => d.ratio !== null);
  const complete = measurable.length === count && count > 0;

  if (measurable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        Nothing on this chart could be measured for this run — the posting stated no
        requirements and no skills to match.
      </p>
    );
  }

  // Consecutive runs of measurable axes, so the outline breaks at a gap instead
  // of cutting a false straight line across it.
  const segments: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const d = dimensions[i % count];
    const isLast = i === count;
    if (!isLast && d.ratio !== null) {
      run.push(point(i, count, RADIUS * Math.max(d.ratio, 0.02)));
    } else {
      if (run.length > 1) segments.push(run);
      run = [];
      if (isLast) break;
    }
  }
  // A complete set is one closed loop rather than an arc with two loose ends.
  if (complete && segments.length === 1) segments[0] = [...segments[0], segments[0][0]];

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`ATS dimensions: ${dimensions.map((d) => `${d.label}, ${d.detail}`).join("; ")}`}
      >
        {RINGS.map((r) => (
          <polygon
            key={r}
            points={dimensions
              .map((_, i) => {
                const p = point(i, count, RADIUS * r);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            className="fill-none stroke-border"
            strokeWidth={1}
          />
        ))}

        {dimensions.map((d, i) => {
          const outer = point(i, count, RADIUS);
          return (
            <line
              key={d.key}
              x1={CX}
              y1={CY}
              x2={outer.x}
              y2={outer.y}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={d.ratio === null ? "3 3" : undefined}
            />
          );
        })}

        {complete && segments[0] && (
          <polygon
            points={segments[0].map((p) => `${p.x},${p.y}`).join(" ")}
            className="fill-state-pass/15 stroke-none"
          />
        )}

        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
            className="fill-none stroke-state-pass"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {dimensions.map((d, i) => {
          if (d.ratio === null) return null;
          const p = point(i, count, RADIUS * Math.max(d.ratio, 0.02));
          return (
            <g key={d.key}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hovered === i ? 6 : 4.5}
                className="fill-state-pass stroke-card"
                strokeWidth={2}
              />
              {/* Hit target larger than the mark. */}
              <circle
                cx={p.x}
                cy={p.y}
                r={14}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}

        {dimensions.map((d, i) => {
          const p = point(i, count, RADIUS + 18);
          const anchor = p.x > CX + 4 ? "start" : p.x < CX - 4 ? "end" : "middle";
          return (
            <text
              key={d.key}
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className={cn(
                "text-[10px]",
                d.ratio === null ? "fill-muted-foreground/60" : "fill-muted-foreground"
              )}
            >
              {d.label}
            </text>
          );
        })}
      </svg>

      {/* The table view the chart is read against — raw counts, never a percentage. */}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {dimensions.map((d, i) => (
          <div
            key={d.key}
            className={cn(
              "flex items-baseline justify-between gap-3 rounded-md px-2 py-1 transition-colors",
              hovered === i && "bg-accent"
            )}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <dt className="flex min-w-0 items-center gap-2 text-xs">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  d.ratio === null ? "border border-muted-foreground/50" : "bg-state-pass"
                )}
              />
              <span className="truncate">{d.label}</span>
            </dt>
            <dd
              className={cn(
                "shrink-0 font-mono text-xs tabular-nums",
                d.ratio === null ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {d.ratio === null ? "not measured" : `${d.present}/${d.total}`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
