"use client";
import { useState } from "react";
import {
  CHART_COLORS,
  fmtInt,
  pickCategoricalColor,
  r3,
} from "@/lib/dashboard/chart-utils";

export interface DonutDatum {
  id: string;
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  /** Center label, e.g., "Total". */
  centerLabel?: string;
  /** Center value (overrides computed total when set). */
  centerValue?: string;
  /** Max slices to show; the rest are grouped as "Outros". */
  maxSlices?: number;
  /** Show side legend. Default true. */
  showLegend?: boolean;
  /** Format for values in tooltip/legend. */
  formatValue?: (v: number) => string;
}

const VB_W = 520;
const VB_H = 320;
const CENTER_X = 160;
const CENTER_Y = VB_H / 2;
const OUTER_R = 120;
const INNER_R = 74;

export function DonutChart({
  data,
  centerLabel = "Total",
  centerValue,
  maxSlices = 7,
  showLegend = true,
  formatValue,
}: DonutChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = formatValue ?? fmtInt;

  // Group small slices into "Outros" if too many
  const sorted = [...data].sort((a, b) => b.value - a.value);
  let slices: DonutDatum[];
  if (sorted.length > maxSlices) {
    const head = sorted.slice(0, maxSlices - 1);
    const tail = sorted.slice(maxSlices - 1);
    const rest = tail.reduce((s, d) => s + d.value, 0);
    slices = [
      ...head,
      { id: "__others__", name: "Outros", value: rest },
    ];
  } else {
    slices = sorted;
  }

  // Assign colors
  const colored = slices.map((s, i) => ({
    ...s,
    color: s.color ?? pickCategoricalColor(i),
  }));

  const total = colored.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p
          className="text-xs text-center px-4 py-2 rounded-lg"
          style={{
            color: CHART_COLORS.text,
            background: "#FBFCF8",
            border: `1px solid ${CHART_COLORS.border}`,
          }}
        >
          Sem dados no período
        </p>
      </div>
    );
  }

  // Compute arcs (using reduce to avoid mutating closure state)
  const arcs = colored.reduce<
    Array<
      DonutDatum & {
        color: string;
        start: number;
        end: number;
        angle: number;
        path: string;
        mid: number;
      }
    >
  >((acc, s) => {
    const prevEnd = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1].end;
    const angle = (s.value / total) * Math.PI * 2;
    const start = prevEnd;
    const end = prevEnd + angle;
    acc.push({
      ...s,
      color: s.color ?? "#0D6F65",
      start,
      end,
      angle,
      path: makeArcPath(CENTER_X, CENTER_Y, INNER_R, OUTER_R, start, end),
      mid: (start + end) / 2,
    });
    return acc;
  }, []);

  return (
    <div className="w-full h-full flex flex-col sm:flex-row items-stretch gap-3 min-h-0">
      <div className="relative flex-1 min-w-0 min-h-0">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          style={{ display: "block" }}
        >
          {arcs.map((a, i) => {
            const isHover = hover === i;
            return (
              <path
                key={a.id}
                d={a.path}
                fill={a.color}
                opacity={hover === null ? 1 : isHover ? 1 : 0.45}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  cursor: "default",
                  transition: "opacity 150ms ease",
                }}
              />
            );
          })}

          {/* External labels: percentage for big slices */}
          {arcs.map((a) => {
            const pct = (a.value / total) * 100;
            if (pct < 6) return null;
            const labelR = OUTER_R + 14;
            const cosMid = Math.cos(a.mid);
            const sinMid = Math.sin(a.mid);
            const lx = r3(CENTER_X + cosMid * labelR);
            const ly = r3(CENTER_Y + sinMid * labelR + 3);
            const anchor =
              cosMid > 0.15
                ? "start"
                : cosMid < -0.15
                  ? "end"
                  : "middle";
            return (
              <text
                key={`l-${a.id}`}
                x={lx}
                y={ly}
                fontSize={10}
                fontWeight={600}
                fill={CHART_COLORS.textStrong}
                textAnchor={anchor}
              >
                {pct.toFixed(0)}%
              </text>
            );
          })}

          {/* Center */}
          <g style={{ pointerEvents: "none" }}>
            <text
              x={CENTER_X}
              y={CENTER_Y - 6}
              textAnchor="middle"
              fontSize={10}
              fill={CHART_COLORS.text}
              style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
            >
              {centerLabel}
            </text>
            <text
              x={CENTER_X}
              y={CENTER_Y + 16}
              textAnchor="middle"
              fontSize={20}
              fontWeight={600}
              fill="#044C45"
            >
              {centerValue ?? fmt(total)}
            </text>
          </g>
        </svg>
      </div>

      {showLegend && (
        <div
          className="w-full sm:w-48 sm:max-w-[48%] shrink-0 flex flex-col gap-1 overflow-y-auto"
          style={{ maxHeight: "100%" }}
        >
          {colored.map((s, i) => {
            const pct = (s.value / total) * 100;
            const isHover = hover === i;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 cursor-default"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  background: isHover ? "#EAF1EC" : "transparent",
                  transition: "background 150ms ease",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: s.color }}
                  />
                  <span
                    className="text-[11.5px] truncate"
                    style={{ color: "#1C2A24" }}
                    title={s.name}
                  >
                    {s.name}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums"
                  style={{ color: "#6B756F", fontSize: 11 }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: "#1C2A24" }}
                  >
                    {fmt(s.value)}
                  </span>
                  <span style={{ color: "#9AA59F" }}>·</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function makeArcPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startA: number,
  endA: number
): string {
  // Avoid degenerate paths
  if (endA - startA >= Math.PI * 2 - 0.001) {
    // Full circle — donut ring. Coordinates here are integer in practice,
    // but route through r3 for consistency with the partial-arc branch.
    return [
      `M ${r3(cx + rOut)} ${r3(cy)}`,
      `A ${rOut} ${rOut} 0 1 1 ${r3(cx - rOut)} ${r3(cy)}`,
      `A ${rOut} ${rOut} 0 1 1 ${r3(cx + rOut)} ${r3(cy)}`,
      "Z",
      `M ${r3(cx + rIn)} ${r3(cy)}`,
      `A ${rIn} ${rIn} 0 1 0 ${r3(cx - rIn)} ${r3(cy)}`,
      `A ${rIn} ${rIn} 0 1 0 ${r3(cx + rIn)} ${r3(cy)}`,
      "Z",
    ].join(" ");
  }
  const cosStart = Math.cos(startA);
  const sinStart = Math.sin(startA);
  const cosEnd = Math.cos(endA);
  const sinEnd = Math.sin(endA);
  // Round every coordinate to 3 decimals so the serialized `d` string is
  // bit-identical between server and client (V8 vs browser engine may
  // differ on trig functions by up to 1 ULP, which is enough for React
  // to flag a hydration mismatch).
  const x1 = r3(cx + cosStart * rOut);
  const y1 = r3(cy + sinStart * rOut);
  const x2 = r3(cx + cosEnd * rOut);
  const y2 = r3(cy + sinEnd * rOut);
  const x3 = r3(cx + cosEnd * rIn);
  const y3 = r3(cy + sinEnd * rIn);
  const x4 = r3(cx + cosStart * rIn);
  const y4 = r3(cy + sinStart * rIn);
  const largeArc = endA - startA > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}
