"use client";
import { useState } from "react";
import {
  CHART_COLORS,
  pickStatusColor,
  fmtInt,
  r3,
} from "@/lib/dashboard/chart-utils";

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  order: number;
  isFinal: boolean;
}

interface FunnelChartProps {
  data: FunnelStage[];
  /** Total occurrences (denominator for global percentage). */
  total: number;
}

const W = 720;
const H = 360;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 16;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;
const ROW_GAP = 8;
const LABEL_AREA_W = 220; // left area for stage name + count

export function FunnelChart({ data, total }: FunnelChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const sorted = [...data].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
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
          Nenhum status registrado
        </p>
      </div>
    );
  }

  const max = Math.max(...sorted.map((s) => s.count), 1);
  const stages = sorted.length;
  const rowH = (CHART_H - ROW_GAP * (stages - 1)) / stages;
  const plotX = PAD_L + LABEL_AREA_W;
  const plotW = CHART_W - LABEL_AREA_W;
  const plotCx = plotX + plotW / 2;

  return (
    <div className="w-full h-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ display: "block" }}
      >
        {sorted.map((s, i) => {
          const y = PAD_T + i * (rowH + ROW_GAP);
          const w = Math.max(60, (s.count / max) * plotW);
          const next = sorted[i + 1];
          const wNext = next
            ? Math.max(60, (next.count / max) * plotW)
            : Math.max(60, (s.count / max) * plotW * 0.92);

          const color = pickStatusColor(i, stages);
          const pct =
            total > 0 ? Math.round((s.count / total) * 100) : 0;
          const isHover = hover === s.id;

          // Trapezoid points: top wider, bottom slightly narrower (next stage hint).
          // Every coordinate is rounded to 3 decimals so the serialized `points`
          // string is bit-identical between SSR and client.
          const xTopL = r3(plotCx - w / 2);
          const xTopR = r3(plotCx + w / 2);
          const xBotL = r3(plotCx - wNext / 2);
          const xBotR = r3(plotCx + wNext / 2);
          const yTop = r3(y);
          const yBot = r3(y + rowH);
          const yMid = r3(y + rowH / 2);
          const points = `${xTopL},${yTop} ${xTopR},${yTop} ${xBotR},${yBot} ${xBotL},${yBot}`;

          return (
            <g
              key={s.id}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            >
              {/* Trapezoid (funnel slice) */}
              <polygon
                points={points}
                fill={color}
                opacity={hover === null ? 0.95 : isHover ? 1 : 0.55}
                style={{ transition: "opacity 150ms ease" }}
              />
              {/* Internal value label */}
              {w > 90 ? (
                <text
                  x={r3(plotCx)}
                  y={r3(yMid + 4)}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#FFFFFF"
                >
                  {fmtInt(s.count)}
                  <tspan
                    fontSize={10}
                    fontWeight={500}
                    fill="rgba(255,255,255,0.85)"
                    dx={6}
                  >
                    {`${pct}%`}
                  </tspan>
                </text>
              ) : (
                <text
                  x={r3(plotCx + w / 2 + 8)}
                  y={r3(yMid + 4)}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={600}
                  fill={CHART_COLORS.textStrong}
                >
                  {fmtInt(s.count)}{" "}
                  <tspan fontSize={10} fill={CHART_COLORS.text}>
                    {`· ${pct}%`}
                  </tspan>
                </text>
              )}

              {/* Stage name on the left */}
              <text
                x={PAD_L}
                y={r3(yMid - 4)}
                fontSize={11}
                fontWeight={600}
                fill="#1C2A24"
              >
                {truncate(s.name.replace(/^\d+-/, ""), 28)}
              </text>
              <text
                x={PAD_L}
                y={r3(yMid + 12)}
                fontSize={10}
                fill={CHART_COLORS.text}
              >
                {s.isFinal ? "Estágio final" : `Etapa ${s.order}`}
              </text>

              {/* Connector line from label to shape */}
              <line
                x1={PAD_L + LABEL_AREA_W - 16}
                x2={r3(plotCx - w / 2 - 4)}
                y1={yMid}
                y2={yMid}
                stroke={CHART_COLORS.border}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
