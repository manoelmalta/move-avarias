"use client";
import { useState } from "react";
import { CHART_COLORS, fmtInt, r3 } from "@/lib/dashboard/chart-utils";

export interface HBarDatum {
  id: string;
  name: string;
  value: number;
  /** Optional auxiliary label (e.g., role badge). */
  meta?: string;
  /** Optional color override for the meta badge. */
  metaColor?: string;
}

interface HorizontalBarChartProps {
  data: HBarDatum[];
  /** Max number of rows. Default 8. */
  limit?: number;
  /** Bar color. */
  color?: string;
  /** Show rank number on the left. Default true. */
  showRank?: boolean;
  /** Show count + percentage of total. Default true. */
  showPercent?: boolean;
  /** Empty-state message. */
  emptyMessage?: string;
  /** Number formatter. */
  formatValue?: (v: number) => string;
}

export function HorizontalBarChart({
  data,
  limit = 8,
  color = "#0D6F65",
  showRank = true,
  showPercent = true,
  emptyMessage = "Sem dados no período",
  formatValue,
}: HorizontalBarChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const fmt = formatValue ?? fmtInt;

  const visible = data.filter((d) => d.value > 0);
  const max = Math.max(...visible.map((d) => d.value), 1);
  const total = visible.reduce((s, d) => s + d.value, 0);
  const rows = visible.slice(0, limit);

  if (rows.length === 0) {
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
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-2 overflow-y-auto pr-1">
      {rows.map((r, idx) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        // Round to 3 decimals: this value goes into an inline style
        // (`width: ${barPct}%`) that is part of the SSR output and
        // therefore subject to React's hydration string-compare.
        const barPct = r3(Math.max(2, (r.value / max) * 100));
        const isTop = idx === 0;
        const isHover = hover === r.id;

        return (
          <div
            key={r.id}
            className="flex flex-col gap-1 rounded-md px-2 py-1.5"
            style={{
              background: isHover ? "#EAF1EC" : "transparent",
              transition: "background 150ms ease",
            }}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {showRank && (
                  <span
                    className="text-[10px] font-bold inline-flex items-center justify-center w-5 h-5 rounded shrink-0 tabular-nums"
                    style={{
                      background: isTop ? color : "#EAF1EC",
                      color: isTop ? "#FFFFFF" : "#6B756F",
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
                <span
                  className="text-[12.5px] truncate"
                  style={{
                    color: "#1C2A24",
                    fontWeight: isTop ? 600 : 400,
                  }}
                  title={r.name}
                >
                  {r.name}
                </span>
                {r.meta && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
                    style={{
                      background: `${r.metaColor ?? "#9AA59F"}15`,
                      color: r.metaColor ?? "#9AA59F",
                      border: `1px solid ${r.metaColor ?? "#9AA59F"}30`,
                    }}
                  >
                    {r.meta}
                  </span>
                )}
              </div>
              <span
                className="text-[11.5px] font-mono tabular-nums shrink-0 flex items-baseline gap-1.5"
                style={{ color: "#6B756F" }}
              >
                <span className="font-semibold" style={{ color: "#1C2A24" }}>
                  {fmt(r.value)}
                </span>
                {showPercent && (
                  <>
                    <span style={{ color: "#DDE7DE" }}>·</span>
                    <span>{pct.toFixed(0)}%</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-7">
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: "#EAF1EC" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${barPct}%`,
                    background: color,
                    transition: "width 350ms ease",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
