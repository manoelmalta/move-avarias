"use client";
import { useState, useEffect } from "react";
import { Maximize2, X } from "lucide-react";

interface ExpandableChartCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  /** Chart node — should be responsive (SVG with viewBox + width 100%). */
  children: React.ReactNode;
  /** Optional chart node used in the expanded modal. Falls back to `children`. */
  expanded?: React.ReactNode;
  /** Compact chart container height (px). Default 220. */
  height?: number;
  /** Expanded chart container height (px). Default 460. */
  expandedHeight?: number;
  /** Optional legend/footer node rendered below the chart (in compact card and modal). */
  legend?: React.ReactNode;
  /** Optional legend rendered ONLY in the expanded modal. Useful when the section already shows a shared legend in compact view. */
  expandedLegend?: React.ReactNode;
  className?: string;
}

export function ExpandableChartCard({
  title,
  subtitle,
  badge,
  children,
  expanded,
  height = 220,
  expandedHeight = 460,
  legend,
  expandedLegend,
  className = "",
}: ExpandableChartCardProps) {
  const modalLegend = expandedLegend ?? legend;
  const [open, setOpen] = useState(false);

  // ESC to close + body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <div
        className={`group rounded-xl flex flex-col gap-3 transition-shadow ${className}`}
        style={{
          background: "#FFFFFF",
          border: "1px solid #DDE7DE",
          boxShadow: "0 1px 2px rgba(8,56,51,0.04), 0 1px 3px rgba(8,56,51,0.02)",
          padding: 20,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-[13px] font-semibold tracking-tight leading-tight"
                style={{ color: "#044C45" }}
              >
                {title}
              </h3>
              {badge && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: "#EAF1EC", color: "#0D6F65" }}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#6B756F" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 min-h-[36px] rounded transition-colors"
            style={{
              color: "#0D6F65",
              background: "transparent",
              border: "1px solid transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#EAF1EC";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDE7DE";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
            }}
            aria-label={`Ampliar ${title}`}
          >
            <Maximize2 size={12} strokeWidth={2.25} />
            Ampliar
          </button>
        </div>

        <div className="w-full flex-1" style={{ height }}>
          {children}
        </div>

        {legend && (
          <div className="pt-1" style={{ borderTop: "1px solid #EAF1EC" }}>
            {legend}
          </div>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expanded-chart-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(8,56,51,0.55)", backdropFilter: "blur(2px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-5xl rounded-2xl flex flex-col"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DDE7DE",
              boxShadow: "0 20px 50px rgba(8,56,51,0.25)",
              maxHeight: "calc(100vh - 4rem)",
            }}
          >
            <div
              className="flex items-start justify-between gap-4 px-6 py-5"
              style={{ borderBottom: "1px solid #EAF1EC" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    id="expanded-chart-title"
                    className="text-base font-semibold tracking-tight"
                    style={{ color: "#044C45" }}
                  >
                    {title}
                  </h2>
                  {badge && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: "#EAF1EC", color: "#0D6F65" }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs mt-1" style={{ color: "#6B756F" }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0"
                style={{ color: "#6B756F", background: "transparent" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#EAF1EC";
                  (e.currentTarget as HTMLButtonElement).style.color = "#044C45";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "#6B756F";
                }}
                aria-label="Fechar"
              >
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>

            <div className="px-6 py-6 overflow-auto" style={{ minHeight: 0 }}>
              <div className="w-full" style={{ height: expandedHeight }}>
                {expanded ?? children}
              </div>
              {modalLegend && (
                <div
                  className="mt-4 pt-3"
                  style={{ borderTop: "1px solid #EAF1EC" }}
                >
                  {modalLegend}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
