"use client";
import type { MonthlyTableRow } from "@/lib/closing-report/types";
import { safePct } from "@/lib/closing-report/metrics";
import { fmtCurrency } from "@/lib/dashboard/chart-utils";

interface MonthlyTableProps {
  rows: MonthlyTableRow[];
  billingByMonth: Record<string, string>;
  onBillingChange: (updated: Record<string, string>) => void;
}

const headStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6B756F",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  padding: "8px 14px",
  textAlign: "right",
  whiteSpace: "nowrap",
  background: "#F7FAF8",
  borderBottom: "1px solid #DDE7DE",
};

const cellStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#1C2A24",
  padding: "10px 14px",
  textAlign: "right",
  borderBottom: "1px solid #EAF1EC",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const pctStyle: React.CSSProperties = {
  ...cellStyle,
  color: "#0D6F65",
  fontWeight: 600,
};

export function MonthlyTable({ rows, billingByMonth, onBillingChange }: MonthlyTableProps) {
  const handleBillingInput = (month: string, value: string) => {
    onBillingChange({ ...billingByMonth, [month]: value });
  };

  const getBilling = (month: string): number => {
    const v = billingByMonth[month];
    if (!v) return 0;
    // Accept both "1234.56" and "1.234,56" (Brazilian format)
    const normalized = v.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized) || 0;
  };

  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl flex items-center justify-center py-12"
        style={{ background: "#FFFFFF", border: "1px solid #DDE7DE", color: "#9AA59F", fontSize: 13 }}
      >
        Nenhum dado para o período selecionado.
      </div>
    );
  }

  // Totals row
  const totalOpened = rows.reduce((s, r) => s + r.openedValue, 0);
  const totalClosed = rows.reduce((s, r) => s + r.closedValue, 0);
  const totalBilled = rows.reduce((s, r) => s + getBilling(r.month), 0);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #DDE7DE",
        boxShadow: "0 1px 2px rgba(8,56,51,0.04)",
      }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid #EAF1EC" }}>
        <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: "#044C45" }}>
          Apuração Mensal
        </h3>
        <p className="text-[11px] mt-0.5" style={{ color: "#6B756F" }}>
          Preencha o campo <strong>Faturado</strong> para calcular as participações percentuais.{" "}
          <span style={{ color: "#B45309" }}>
            Os valores inseridos não são salvos ao recarregar a página.
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: "left", paddingLeft: 20, minWidth: 90 }}>Mês</th>
              <th style={headStyle}>R$ Abertos</th>
              <th style={headStyle}>R$ Finalizados</th>
              <th style={{ ...headStyle, minWidth: 160 }}>R$ Faturado no Mês</th>
              <th style={headStyle}>% Fin / Ab</th>
              <th style={headStyle}>% Ab / Fat</th>
              <th style={headStyle}>% Fin / Fat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const billed = getBilling(row.month);
              return (
                <tr
                  key={row.month}
                  style={{ transition: "background 0.1s" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "#F7FAF8";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "left",
                      paddingLeft: 20,
                      fontWeight: 600,
                      color: "#044C45",
                    }}
                  >
                    {row.label}
                  </td>
                  <td style={cellStyle}>{fmtCurrency(row.openedValue)}</td>
                  <td style={cellStyle}>{fmtCurrency(row.closedValue)}</td>
                  <td style={{ ...cellStyle, padding: "6px 14px" }}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[11px]" style={{ color: "#9AA59F" }}>R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={billingByMonth[row.month] ?? ""}
                        onChange={(e) => handleBillingInput(row.month, e.target.value)}
                        placeholder="0,00"
                        className="rounded px-2 py-1 text-right text-sm tabular-nums outline-none"
                        style={{
                          width: 110,
                          background: "#F7FAF8",
                          border: "1px solid #DDE7DE",
                          color: "#1C2A24",
                          fontSize: 13,
                        }}
                        onFocus={(e) => {
                          (e.target as HTMLInputElement).style.borderColor = "#0D6F65";
                          (e.target as HTMLInputElement).style.background = "#FFFFFF";
                        }}
                        onBlur={(e) => {
                          (e.target as HTMLInputElement).style.borderColor = "#DDE7DE";
                          (e.target as HTMLInputElement).style.background = "#F7FAF8";
                        }}
                      />
                    </div>
                  </td>
                  <td style={pctStyle}>{safePct(row.closedValue, row.openedValue)}</td>
                  <td style={pctStyle}>{safePct(row.openedValue, billed)}</td>
                  <td style={pctStyle}>{safePct(row.closedValue, billed)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#F0F6F1" }}>
              <td
                style={{
                  ...cellStyle,
                  textAlign: "left",
                  paddingLeft: 20,
                  fontWeight: 700,
                  color: "#044C45",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                Total
              </td>
              <td
                style={{
                  ...cellStyle,
                  fontWeight: 700,
                  color: "#044C45",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {fmtCurrency(totalOpened)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  fontWeight: 700,
                  color: "#044C45",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {fmtCurrency(totalClosed)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  fontWeight: 700,
                  color: "#044C45",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {totalBilled > 0 ? fmtCurrency(totalBilled) : "—"}
              </td>
              <td
                style={{
                  ...pctStyle,
                  fontWeight: 700,
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {safePct(totalClosed, totalOpened)}
              </td>
              <td
                style={{
                  ...pctStyle,
                  fontWeight: 700,
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {safePct(totalOpened, totalBilled)}
              </td>
              <td
                style={{
                  ...pctStyle,
                  fontWeight: 700,
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {safePct(totalClosed, totalBilled)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
