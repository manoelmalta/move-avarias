"use client";
import type { ProductGroupRow } from "@/lib/closing-report/types";
import { fmtCurrency } from "@/lib/dashboard/chart-utils";

interface ItemsTableProps {
  rows: ProductGroupRow[];
  totalQuantity: number;
  totalValue: number;
  /** Distinct occurrence count across all product rows in the current filter. */
  totalDistinctOccurrences: number;
}

const headStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6B756F",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  padding: "8px 14px",
  whiteSpace: "nowrap",
  background: "#F7FAF8",
  borderBottom: "1px solid #DDE7DE",
};

const cellStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#1C2A24",
  padding: "10px 14px",
  borderBottom: "1px solid #EAF1EC",
};

export function ItemsTable({
  rows,
  totalQuantity,
  totalValue,
  totalDistinctOccurrences,
}: ItemsTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl flex items-center justify-center py-14"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DDE7DE",
          color: "#9AA59F",
          fontSize: 13,
        }}
      >
        Nenhum item avariado encontrado para os filtros selecionados.
      </div>
    );
  }

  const fmtQty = (v: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(v);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #DDE7DE",
        boxShadow: "0 1px 2px rgba(8,56,51,0.04)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: "left", paddingLeft: 20 }}>Cód. Interno</th>
              <th style={{ ...headStyle, textAlign: "left" }}>Descrição</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Quantidade</th>
              <th style={{ ...headStyle, textAlign: "right" }}>Valor Total</th>
              <th style={{ ...headStyle, textAlign: "right", paddingRight: 20 }}>Processos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.productId}
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
                    paddingLeft: 20,
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "#0D6F65",
                    fontWeight: 600,
                  }}
                >
                  {row.internalCode}
                </td>
                <td style={{ ...cellStyle, maxWidth: 360 }}>
                  <span
                    className="block truncate"
                    title={row.description}
                    style={{ maxWidth: 360 }}
                  >
                    {row.description}
                  </span>
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtQty(row.totalQuantity)}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtCurrency(row.totalValue)}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    paddingRight: 20,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold"
                    style={{ background: "#EAF1EC", color: "#0D6F65", minWidth: 28 }}
                  >
                    {row.occurrenceCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#F0F6F1" }}>
              <td
                colSpan={2}
                style={{
                  ...cellStyle,
                  paddingLeft: 20,
                  fontWeight: 700,
                  color: "#044C45",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                Total ({rows.length} {rows.length === 1 ? "produto" : "produtos"})
              </td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#044C45",
                  fontVariantNumeric: "tabular-nums",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {fmtQty(totalQuantity)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#044C45",
                  fontVariantNumeric: "tabular-nums",
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {fmtCurrency(totalValue)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: "right",
                  paddingRight: 20,
                  borderTop: "2px solid #DDE7DE",
                  borderBottom: "none",
                }}
              >
                {/* Total distinct occurrences = distinct occurrences that have at least one item in this filter */}
                <span
                  className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold"
                  style={{ background: "#EAF1EC", color: "#0D6F65", minWidth: 28 }}
                >
                  {totalDistinctOccurrences}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
