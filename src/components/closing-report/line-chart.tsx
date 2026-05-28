"use client";
import { useState } from "react";
import {
  niceTicks,
  CHART_COLORS,
  fmtCurrency,
  fmtCurrencyCompact,
  r3,
} from "@/lib/dashboard/chart-utils";

export interface LineDatum {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineDatum[];
  color?: string;
  emptyText?: string;
}

const W = 760;
const H = 300;
const PAD_L = 68;
const PAD_R = 20;
const PAD_T = 28;
const PAD_B = 40;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

export function LineChart({
  data,
  color = "#0D6F65",
  emptyText = "Sem valor no período",
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  const max = Math.max(...data.map((d) => d.value), 1);
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1];

  const allZero = data.every((d) => d.value === 0);

  // x position for point i, evenly spaced
  const xPos = (i: number): number =>
    r3(PAD_L + (n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W));

  const yPos = (v: number): number =>
    r3(PAD_T + CHART_H - (v / yMax) * CHART_H);

  // Polyline points string
  const linePoints = data.map((d, i) => `${xPos(i)},${yPos(d.value)}`).join(" ");

  // Area fill polygon (line + baseline)
  const areaPoints = [
    `${xPos(0)},${PAD_T + CHART_H}`,
    ...data.map((d, i) => `${xPos(i)},${yPos(d.value)}`),
    `${xPos(n - 1)},${PAD_T + CHART_H}`,
  ].join(" ");

  // Hover band width per data point
  const bandW = n > 1 ? r3(CHART_W / n) : CHART_W;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: "block" }}
        >
          {/* Y grid + labels */}
          {ticks.map((t) => {
            const y = r3(PAD_T + CHART_H - (t / yMax) * CHART_H);
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

          {/* Area fill */}
          {!allZero && n > 0 && (
            <polygon
              points={areaPoints}
              fill={color}
              fillOpacity={0.08}
            />
          )}

          {/* Line */}
          {!allZero && n > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Hover vertical guide */}
          {hover !== null && n > 1 && (
            <line
              x1={xPos(hover)}
              y1={PAD_T}
              x2={xPos(hover)}
              y2={PAD_T + CHART_H}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.4}
            />
          )}

          {/* Data point circles */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={xPos(i)}
              cy={yPos(d.value)}
              r={hover === i ? 5 : 3.5}
              fill={hover === i ? color : "#FFFFFF"}
              stroke={color}
              strokeWidth={1.8}
              style={{ transition: "r 0.1s" }}
            />
          ))}

          {/* X axis labels */}
          {data.map((d, i) => (
            <text
              key={`lbl-${i}`}
              x={xPos(i)}
              y={PAD_T + CHART_H + 16}
              fontSize={n > 8 ? 8.5 : 10}
              fill={CHART_COLORS.text}
              textAnchor="middle"
            >
              {d.label}
            </text>
          ))}

          {/* X axis baseline */}
          <line
            x1={PAD_L}
            y1={PAD_T + CHART_H}
            x2={W - PAD_R}
            y2={PAD_T + CHART_H}
            stroke={CHART_COLORS.axis}
            strokeWidth={1}
            opacity={0.4}
          />

          {/* Invisible hover bands */}
          {data.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={r3(PAD_L + i * bandW - bandW / 2)}
              y={PAD_T}
              width={bandW}
              height={CHART_H + PAD_B - 4}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hover !== null && data[hover] && (
          <div
            className="absolute pointer-events-none rounded-lg px-3 py-2 text-xs flex flex-col gap-0.5"
            style={{
              background: "#FFFFFF",
              border: `1px solid ${CHART_COLORS.border}`,
              boxShadow: "0 6px 18px rgba(8,56,51,0.15)",
              top: 8,
              left: `${((hover + 0.5) * (100 / Math.max(n, 1)))}%`,
              transform: "translateX(-50%)",
              minWidth: 150,
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

        {/* Empty state */}
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
              {emptyText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
