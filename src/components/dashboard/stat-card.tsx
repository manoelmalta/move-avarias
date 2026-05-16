"use client";

interface StatCardProps {
  /** Eyebrow label, ALL CAPS small. */
  label: string;
  /** Big formatted value. */
  value: string | number;
  /** Single subline note. */
  sub?: string;
  /** Optional auxiliary metric (e.g., "12 itens", "8 concluídas"). */
  aux?: string;
  /** Accent color for the side rail and number underline. */
  accent?: string;
  /** Show subtle warning indicator near the value. */
  warn?: boolean;
  /** Dim the value (e.g., when no data). */
  dim?: boolean;
}

export function StatCard({
  label,
  value,
  sub,
  aux,
  accent = "#0D6F65",
  warn = false,
  dim = false,
}: StatCardProps) {
  const big = String(value);
  const isLong = big.length > 9;

  return (
    <div
      className="relative rounded-xl flex flex-col gap-2 overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #DDE7DE",
        boxShadow: "0 1px 2px rgba(8,56,51,0.04), 0 1px 3px rgba(8,56,51,0.02)",
        padding: "22px 24px",
      }}
    >
      {/* Side accent rail */}
      <span
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r"
        style={{ background: accent }}
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#6B756F" }}
        >
          {label}
        </span>
        {aux && (
          <span
            className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
            style={{ background: "#EAF1EC", color: "#0D6F65" }}
          >
            {aux}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2 mt-0.5">
        <span
          className={`font-semibold leading-none tabular-nums ${
            isLong ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
          } ${dim ? "opacity-40" : ""}`}
          style={{ color: "#083833", letterSpacing: "-0.01em" }}
        >
          {big}
        </span>
        {warn && (
          <span
            title="Itens sem preço não compõem o valor acumulado"
            className="text-[11px] mb-1 inline-flex items-center justify-center w-4 h-4 rounded-full font-bold"
            style={{ background: "rgba(215,166,58,0.18)", color: "#9C7822" }}
          >
            !
          </span>
        )}
      </div>

      {sub && (
        <p
          className="text-[11.5px] leading-snug"
          style={{ color: "#6B756F" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
