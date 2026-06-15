"use client";
import { useState } from "react";
import type { YearlyMonthData } from "@/lib/closing-report/types";
import { safePct } from "@/lib/closing-report/metrics";
import { fmtCurrency } from "@/lib/dashboard/chart-utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface MonthlyTableProps {
  yearlyData: YearlyMonthData[];
  billingByMonth: Record<string, string>;
  onBillingChange: (updated: Record<string, string>) => void;
  onSaveBilling: (month: string, value: string) => Promise<"ok" | "error">;
}

// ── Style tokens ───────────────────────────────────────────────────────────────

const labelHeadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6B756F",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  padding: "8px 14px 8px 20px",
  textAlign: "left",
  whiteSpace: "nowrap",
  background: "#F7FAF8",
  borderBottom: "1px solid #DDE7DE",
  minWidth: 220,
  position: "sticky",
  left: 0,
  zIndex: 2,
};

const monthHeadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6B756F",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "8px 10px",
  textAlign: "right",
  whiteSpace: "nowrap",
  background: "#F7FAF8",
  borderBottom: "1px solid #DDE7DE",
  minWidth: 96,
};

const totalHeadStyle: React.CSSProperties = {
  ...monthHeadStyle,
  background: "#EFF5F1",
  borderLeft: "2px solid #DDE7DE",
  color: "#044C45",
};

const labelCellStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#1C2A24",
  padding: "9px 14px 9px 20px",
  borderBottom: "1px solid #EAF1EC",
  whiteSpace: "nowrap",
  background: "#FFFFFF",
  position: "sticky",
  left: 0,
  zIndex: 1,
};

const valueCellStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#1C2A24",
  padding: "9px 10px",
  textAlign: "right",
  borderBottom: "1px solid #EAF1EC",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const pctCellStyle: React.CSSProperties = {
  ...valueCellStyle,
  color: "#0D6F65",
  fontWeight: 600,
};

const totalValueCellStyle: React.CSSProperties = {
  ...valueCellStyle,
  background: "#F7FAF8",
  borderLeft: "2px solid #DDE7DE",
  fontWeight: 700,
  color: "#044C45",
};

const totalPctCellStyle: React.CSSProperties = {
  ...pctCellStyle,
  background: "#F7FAF8",
  borderLeft: "2px solid #DDE7DE",
  fontWeight: 700,
};

// ── Save status label ──────────────────────────────────────────────────────────

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map: Record<Exclude<SaveStatus, "idle">, { text: string; color: string }> = {
    saving: { text: "Salvando…", color: "#6B756F" },
    saved: { text: "Salvo ✓", color: "#0D6F65" },
    error: { text: "Erro ao salvar", color: "#B91C1C" },
  };
  const { text, color } = map[status as Exclude<SaveStatus, "idle">];
  return (
    <span style={{ fontSize: 10, color, fontWeight: 500, marginLeft: 4, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MonthlyTable({
  yearlyData,
  billingByMonth,
  onBillingChange,
  onSaveBilling,
}: MonthlyTableProps) {
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

  const handleBillingInput = (month: string, value: string) => {
    onBillingChange({ ...billingByMonth, [month]: value });
    // Reset status on change so feedback clears
    setSaveStatus((prev) => ({ ...prev, [month]: "idle" }));
  };

  const handleBillingBlur = async (month: string, value: string) => {
    setSaveStatus((prev) => ({ ...prev, [month]: "saving" }));
    const result = await onSaveBilling(month, value);
    setSaveStatus((prev) => ({ ...prev, [month]: result === "ok" ? "saved" : "error" }));
    if (result === "ok") {
      // Clear "Salvo" feedback after 2 s
      setTimeout(() => {
        setSaveStatus((prev) => (prev[month] === "saved" ? { ...prev, [month]: "idle" } : prev));
      }, 2000);
    }
  };

  const getBilling = (month: string): number => {
    const v = billingByMonth[month];
    if (!v) return 0;
    const normalized = v.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized) || 0;
  };

  if (yearlyData.length === 0) {
    return (
      <div
        className="rounded-xl flex items-center justify-center py-12"
        style={{ background: "#FFFFFF", border: "1px solid #DDE7DE", color: "#9AA59F", fontSize: 13 }}
      >
        Nenhum dado para o período selecionado.
      </div>
    );
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totalOpened = yearlyData.reduce((s, d) => s + d.openedValue, 0);
  const totalClosed = yearlyData.reduce((s, d) => s + d.closedValue, 0);
  const totalBilled = yearlyData.reduce((s, d) => s + getBilling(d.month), 0);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #DDE7DE",
        boxShadow: "0 1px 2px rgba(8,56,51,0.04)",
      }}
    >
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid #EAF1EC" }}>
        <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: "#044C45" }}>
          Apuração Mensal
        </h3>
        <p className="text-[11px] mt-0.5" style={{ color: "#6B756F" }}>
          Preencha o campo <strong>R$ Faturado</strong> para calcular as participações percentuais.{" "}
          <span style={{ color: "#0D6F65" }}>
            Os valores de faturamento são gravados e utilizados na apuração dos KPIs mensais.
          </span>
        </p>
      </div>

      {/* Table — horizontally scrollable */}
      <div className="overflow-x-auto">
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 1360,
            width: "100%",
          }}
        >
          <thead>
            <tr>
              <th style={labelHeadStyle}>Indicador</th>
              {yearlyData.map((d) => (
                <th key={d.month} style={monthHeadStyle}>
                  {d.label}
                </th>
              ))}
              <th style={totalHeadStyle}>Total</th>
            </tr>
          </thead>

          <tbody>
            {/* Row 1 — R$ Processos Abertos */}
            <tr>
              <td style={{ ...labelCellStyle, borderBottom: "1px solid #EAF1EC" }}>
                R$ Processos Abertos
              </td>
              {yearlyData.map((d) => (
                <td key={d.month} style={valueCellStyle}>
                  {d.openedValue > 0 ? fmtCurrency(d.openedValue) : <span style={{ color: "#C5CFC8" }}>—</span>}
                </td>
              ))}
              <td style={totalValueCellStyle}>{fmtCurrency(totalOpened)}</td>
            </tr>

            {/* Row 2 — R$ Processos Finalizados */}
            <tr>
              <td style={{ ...labelCellStyle, borderBottom: "1px solid #EAF1EC" }}>
                R$ Processos Finalizados
              </td>
              {yearlyData.map((d) => (
                <td key={d.month} style={valueCellStyle}>
                  {d.closedValue > 0 ? fmtCurrency(d.closedValue) : <span style={{ color: "#C5CFC8" }}>—</span>}
                </td>
              ))}
              <td style={totalValueCellStyle}>{fmtCurrency(totalClosed)}</td>
            </tr>

            {/* Row 3 — R$ Faturado no Mês (editable, persisted) */}
            <tr>
              <td
                style={{
                  ...labelCellStyle,
                  borderBottom: "2px solid #DDE7DE",
                  color: "#0D6F65",
                }}
              >
                R$ Faturado no Mês
              </td>
              {yearlyData.map((d) => (
                <td
                  key={d.month}
                  style={{
                    ...valueCellStyle,
                    padding: "5px 10px",
                    borderBottom: "2px solid #DDE7DE",
                  }}
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center justify-end gap-1">
                      <span style={{ fontSize: 10, color: "#9AA59F" }}>R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={billingByMonth[d.month] ?? ""}
                        onChange={(e) => handleBillingInput(d.month, e.target.value)}
                        onBlur={(e) => {
                          (e.target as HTMLInputElement).style.borderColor = "#DDE7DE";
                          (e.target as HTMLInputElement).style.background = "#F7FAF8";
                          handleBillingBlur(d.month, (e.target as HTMLInputElement).value);
                        }}
                        placeholder="0,00"
                        style={{
                          width: 72,
                          background: "#F7FAF8",
                          border: "1px solid #DDE7DE",
                          borderRadius: 4,
                          padding: "3px 6px",
                          fontSize: 12,
                          color: "#1C2A24",
                          textAlign: "right",
                          outline: "none",
                          fontVariantNumeric: "tabular-nums",
                        }}
                        onFocus={(e) => {
                          (e.target as HTMLInputElement).style.borderColor = "#0D6F65";
                          (e.target as HTMLInputElement).style.background = "#FFFFFF";
                        }}
                      />
                    </div>
                    <SaveStatusLabel status={saveStatus[d.month] ?? "idle"} />
                  </div>
                </td>
              ))}
              <td
                style={{
                  ...totalValueCellStyle,
                  borderBottom: "2px solid #DDE7DE",
                  color: totalBilled > 0 ? "#044C45" : "#9AA59F",
                }}
              >
                {totalBilled > 0 ? fmtCurrency(totalBilled) : "—"}
              </td>
            </tr>

            {/* Row 4 — % Fin / Ab */}
            <tr>
              <td style={{ ...labelCellStyle, color: "#6B756F", fontWeight: 500 }}>
                % R$ Finalizados / R$ Abertos
              </td>
              {yearlyData.map((d) => (
                <td key={d.month} style={pctCellStyle}>
                  {safePct(d.closedValue, d.openedValue)}
                </td>
              ))}
              <td style={totalPctCellStyle}>{safePct(totalClosed, totalOpened)}</td>
            </tr>

            {/* Row 5 — % Ab / Fat */}
            <tr>
              <td style={{ ...labelCellStyle, color: "#6B756F", fontWeight: 500 }}>
                % R$ Abertos / Faturamento
              </td>
              {yearlyData.map((d) => {
                const billed = getBilling(d.month);
                return (
                  <td key={d.month} style={pctCellStyle}>
                    {safePct(d.openedValue, billed)}
                  </td>
                );
              })}
              <td style={totalPctCellStyle}>{safePct(totalOpened, totalBilled)}</td>
            </tr>

            {/* Row 6 — % Fin / Fat */}
            <tr>
              <td style={{ ...labelCellStyle, borderBottom: "none", color: "#6B756F", fontWeight: 500 }}>
                % R$ Finalizados / Faturamento
              </td>
              {yearlyData.map((d) => {
                const billed = getBilling(d.month);
                return (
                  <td key={d.month} style={{ ...pctCellStyle, borderBottom: "none" }}>
                    {safePct(d.closedValue, billed)}
                  </td>
                );
              })}
              <td style={{ ...totalPctCellStyle, borderBottom: "none" }}>
                {safePct(totalClosed, totalBilled)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
