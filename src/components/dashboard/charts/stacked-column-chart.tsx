"use client";
import { useState } from "react";
import { niceTicks, CHART_COLORS, fmtInt, r3 } from "@/lib/dashboard/chart-utils";

export interface StackedSeries {
  id: string;
  name: string;
  color: string;
}

export interface StackedColumnDatum {
  label: string;
  /** values keyed by series.id */
  values: Record<string, number>;
}

interface StackedColumnChartProps {
  data: StackedColumnDatum[];
  series: StackedSeries[];
  /** Show total label on top of each column (default true). */
  showTotals?: boolean;
  /** Minimum segment height (px in viewBox) to render an internal label. */
  internalLabelMinHeight?: number;
  /** Formatter for chart labels (Y-axis ticks, totals, internal segment labels). */
  formatValue?: (v: number) => string;
  /** Formatter for tooltip values. Defaults to `formatValue`. Use a richer format for tooltips (e.g., full currency). */
  formatTooltipValue?: (v: number) => string;
  /** Y-axis title (optional, very small). */
  yAxisTitle?: string;
}

const W = 760;
const H = 320;
const PAD_L = 44;
const PAD_R = 18;
const PAD_T = 22;
const PAD_B = 38;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

export function StackedColumnChart({
  data,
  series,
  showTotals = true,
  internalLabelMinHeight = 28,
  formatValue,
  formatTooltipValue,
  yAxisTitle,
}: StackedColumnChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const fmt = formatValue ?? fmtInt;
  const fmtTooltip = formatTooltipValue ?? fmt;

  const totals = data.map((d) =>
    series.reduce((s, ser) => s + (d.values[ser.id] ?? 0), 0)
  );
  const maxTotal = Math.max(...totals, 1);
  const ticks = niceTicks(maxTotal);
  const yMax = ticks[ticks.length - 1];

  const colW = CHART_W / Math.max(data.length, 1);
  const barW = Math.min(36, colW * 0.62);

  const yScale = (v: number) => (v / yMax) * CHART_H;

  const allZero = totals.every((t) => t === 0);

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
                  {fmt(t)}
                </text>
              </g>
            );
          })}

          {/* Y-axis title */}
          {yAxisTitle && (
            <text
              x={4}
              y={PAD_T + CHART_H / 2}
              fontSize={9}
              fill={CHART_COLORS.text}
              transform={`rotate(-90 4 ${PAD_T + CHART_H / 2})`}
              textAnchor="middle"
            >
              {yAxisTitle}
            </text>
          )}

          {/* Hover column highlight */}
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

          {/* Columns — every coordinate fed to SVG is rounded to 3 decimals via r3 to avoid SSR/client float drift */}
          {data.map((d, i) => {
            const colX = r3(PAD_L + i * colW + (colW - barW) / 2);
            const colCenter = r3(colX + barW / 2);
            const colHitX = r3(PAD_L + i * colW);
            const barWR = r3(barW);
            const colWR = r3(colW);
            let cursorY = PAD_T + CHART_H; // bottom (integer constant)
            const total = totals[i];

            return (
              <g key={d.label + i}>
                {series.map((ser, si) => {
                  const v = d.values[ser.id] ?? 0;
                  if (v <= 0) return null;
                  const h = yScale(v);
                  const y = cursorY - h;
                  cursorY = y;
                  const isFirst = si === series.findIndex((s) => (d.values[s.id] ?? 0) > 0);
                  const isLast = (() => {
                    // last non-zero series in column
                    for (let k = series.length - 1; k >= 0; k--) {
                      if ((d.values[series[k].id] ?? 0) > 0) return k === si;
                    }
                    return false;
                  })();
                  const yR = r3(y);
                  const hR = r3(h);
                  return (
                    <g key={ser.id}>
                      <rect
                        x={colX}
                        y={yR}
                        width={barWR}
                        height={hR}
                        fill={ser.color}
                        rx={isLast ? 4 : 0}
                        ry={isLast ? 4 : 0}
                      />
                      {/* Internal label on big enough segments */}
                      {h >= internalLabelMinHeight && (
                        <text
                          x={colCenter}
                          y={r3(y + h / 2 + 3)}
                          fontSize={10}
                          fontWeight={600}
                          fill="#FFFFFF"
                          textAnchor="middle"
                          style={{ pointerEvents: "none" }}
                        >
                          {fmt(v)}
                        </text>
                      )}
                      {/* Mask the rounded bottom of the bar if not first */}
                      {!isFirst && si !== 0 && (
                        <rect
                          x={colX}
                          y={r3(cursorY + h - 2)}
                          width={barWR}
                          height={2}
                          fill={ser.color}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Total on top */}
                {showTotals && total > 0 && (
                  <text
                    x={colCenter}
                    y={r3(cursorY - 6)}
                    fontSize={11}
                    fontWeight={600}
                    fill={CHART_COLORS.textStrong}
                    textAnchor="middle"
                  >
                    {fmt(total)}
                  </text>
                )}

                {/* X label */}
                <text
                  x={colCenter}
                  y={PAD_T + CHART_H + 16}
                  fontSize={10}
                  fill={CHART_COLORS.text}
                  textAnchor="middle"
                >
                  {d.label}
                </text>

                {/* Hover hitbox */}
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

          {/* X axis */}
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

        {/* Tooltip */}
        {hover !== null && data[hover] && totals[hover] > 0 && (
          <StackedTooltip
            datum={data[hover]}
            series={series}
            total={totals[hover]}
            left={`${((hover + 0.5) * (100 / data.length))}%`}
            fmt={fmtTooltip}
          />
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
              Sem dados no período
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StackedTooltip({
  datum,
  series,
  total,
  left,
  fmt,
}: {
  datum: StackedColumnDatum;
  series: StackedSeries[];
  total: number;
  left: string;
  fmt: (v: number) => string;
}) {
  return (
    <div
      className="absolute pointer-events-none rounded-lg px-3 py-2 text-xs flex flex-col gap-1"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${CHART_COLORS.border}`,
        boxShadow: "0 6px 18px rgba(8,56,51,0.15)",
        top: 8,
        left,
        transform: "translateX(-50%)",
        minWidth: 180,
        maxWidth: 260,
        zIndex: 5,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold" style={{ color: "#044C45" }}>
          {datum.label}
        </span>
        <span
          className="font-mono font-semibold tabular-nums"
          style={{ color: "#1C2A24" }}
        >
          {fmt(total)}
        </span>
      </div>
      <div
        className="h-px my-0.5"
        style={{ background: CHART_COLORS.border }}
      />
      {series
        .filter((s) => (datum.values[s.id] ?? 0) > 0)
        .map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3"
          >
            <span
              className="flex items-center gap-1.5 truncate"
              style={{ color: "#6B756F" }}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm shrink-0"
                style={{ background: s.color }}
              />
              <span className="truncate">{s.name}</span>
            </span>
            <span
              className="font-mono tabular-nums"
              style={{ color: "#1C2A24" }}
            >
              {fmt(datum.values[s.id] ?? 0)}
            </span>
          </div>
        ))}
    </div>
  );
}

export function StackedLegend({ series }: { series: StackedSeries[] }) {
  return (
    <div
      className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px]"
      style={{ color: "#6B756F" }}
    >
      {series.map((s) => (
        <span key={s.id} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: s.color }}
          />
          {s.name}
        </span>
      ))}
    </div>
  );
}
