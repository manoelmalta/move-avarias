"use client";
import { useState } from "react";
import {
  niceTicks,
  CHART_COLORS,
  fmtCurrency,
  fmtCurrencyCompact,
  r3,
} from "@/lib/dashboard/chart-utils";

interface ValueDatum {
  label: string;
  value: number;
}

interface ValueColumnChartProps {
  data: ValueDatum[];
  /** Color of the columns. */
  color?: string;
  /** Show value label above each column. */
  showLabels?: boolean;
}

const W = 760;
const H = 320;
const PAD_L = 56;
const PAD_R = 18;
const PAD_T = 28;
const PAD_B = 38;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

export function ValueColumnChart({
  data,
  color = "#0D6F65",
  showLabels = true,
}: ValueColumnChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1];

  const colW = CHART_W / Math.max(data.length, 1);
  const barW = Math.min(34, colW * 0.6);
  const yScale = (v: number) => (v / yMax) * CHART_H;

  const allZero = data.every((d) => d.value === 0);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: "block" }}
        >
          {/* Y grid */}
          {ticks.map((t) => {
            const y = r3(PAD_T + CHART_H - yScale(t));
            return (
              <g key={t}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke={CHART_COLORS.grid}
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 8}
                  y={r3(y + 3)}
                  textAnchor="end"
                  fontSize={10}
                  fill={CHART_COLORS.text}
                >
                  {fmtCurrencyCompact(t)}
                </text>
              </g>
            );
          })}

          {hover !== null && (
            <rect
              x={r3(PAD_L + hover * colW + 1)}
              y={PAD_T - 4}
              width={r3(colW - 2)}
              height={CHART_H + 8}
              fill="#EAF1EC"
              opacity={0.55}
              rx={6}
            />
          )}

          {data.map((d, i) => {
            const colX = r3(PAD_L + i * colW + (colW - barW) / 2);
            const colCenter = r3(colX + barW / 2);
            const colHitX = r3(PAD_L + i * colW);
            const barWR = r3(barW);
            const colWR = r3(colW);
            const h = r3(yScale(d.value));
            const y = r3(PAD_T + CHART_H - h);
            return (
              <g key={d.label + i}>
                {d.value > 0 && (
                  <rect
                    x={colX}
                    y={y}
                    width={barWR}
                    height={h}
                    rx={4}
                    ry={4}
                    fill={color}
                  />
                )}
                {showLabels && d.value > 0 && (
                  <text
                    x={colCenter}
                    y={r3(y - 6)}
                    fontSize={10}
                    fontWeight={600}
                    fill={CHART_COLORS.textStrong}
                    textAnchor="middle"
                  >
                    {fmtCurrencyCompact(d.value)}
                  </text>
                )}
                <text
                  x={colCenter}
                  y={PAD_T + CHART_H + 16}
                  fontSize={10}
                  fill={CHART_COLORS.text}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
                <rect
                  x={colHitX}
                  y={PAD_T}
                  width={colWR}
                  height={CHART_H + PAD_B - 4}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}

          <line
            x1={PAD_L}
            y1={PAD_T + CHART_H}
            x2={W - PAD_R}
            y2={PAD_T + CHART_H}
            stroke={CHART_COLORS.axis}
            strokeWidth={1}
            opacity={0.4}
          />
        </svg>

        {hover !== null && data[hover] && (
          <div
            className="absolute pointer-events-none rounded-lg px-3 py-2 text-xs flex flex-col gap-0.5"
            style={{
              background: "#FFFFFF",
              border: `1px solid ${CHART_COLORS.border}`,
              boxShadow: "0 6px 18px rgba(8,56,51,0.15)",
              top: 8,
              left: `${((hover + 0.5) * (100 / data.length))}%`,
              transform: "translateX(-50%)",
              minWidth: 140,
              zIndex: 5,
            }}
          >
            <span className="font-semibold" style={{ color: "#044C45" }}>
              {data[hover].label}
            </span>
            <span
              className="font-mono font-semibold tabular-nums"
              style={{ color: "#1C2A24" }}
            >
              {fmtCurrency(data[hover].value)}
            </span>
          </div>
        )}

        {allZero && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p
              className="text-xs text-center px-4 py-2 rounded-lg"
              style={{
                color: CHART_COLORS.text,
                background: "rgba(255,255,255,0.92)",
                border: `1px solid ${CHART_COLORS.border}`,
              }}
            >
              Sem valor acumulado no período
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
