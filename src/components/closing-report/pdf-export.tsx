/**
 * PDF export component for the Closing Report.
 *
 * This file is ONLY loaded via dynamic import inside the handleExportPdf
 * callback in closing-report-view.tsx. It is never statically included
 * in the SSR bundle, which prevents @react-pdf/renderer (which depends on
 * canvas / fontkit) from running on the server.
 *
 * Do NOT add "use client" — Next.js would try to statically analyse it.
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { YearlyMonthData, ProductGroupRow } from "@/lib/closing-report/types";

// ── Brand palette (MOVE REUSE) ─────────────────────────────────────────────────

const C = {
  darkGreen:  "#044C45",
  primary:    "#0D6F65",
  body:       "#1C2A24",
  muted:      "#6B756F",
  bgLight:    "#F7FAF8",
  border:     "#DDE7DE",
  bgAccent:   "#EAF1EC",
  bgTotal:    "#F0F6F1",
  bgTotalHead:"#EFF5F1",
  warnBg:     "#FFFBEB",
  warnBorder: "#F59E0B",
  warnText:   "#78350F",
  dimText:    "#9AA59F",
  white:      "#FFFFFF",
  headerSub:  "#A7C4C0",
  rowAlt:     "#FAFCFB",
} as const;

// ── Formatters ─────────────────────────────────────────────────────────────────

/** Full Brazilian currency: "R$ 1.234,56". */
function fmtCur(v: number): string {
  const abs = Math.abs(v);
  const rounded = Math.round(abs * 100);
  const cents = rounded % 100;
  const integer = Math.floor(rounded / 100);
  const intStr = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centStr = cents < 10 ? "0" + String(cents) : String(cents);
  return (v < 0 ? "-R$ " : "R$ ") + intStr + "," + centStr;
}

/**
 * Compact integer format for narrow table cells: "1.234.567".
 * Returns "—" for zero.
 */
function fmtCompact(v: number): string {
  if (v === 0) return "—";
  return Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtQty(v: number): string {
  const fixed = v % 1 === 0 ? v.toFixed(0) : v.toFixed(3);
  return fixed.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function safePct(num: number, den: number): string {
  if (!den || den <= 0) return "—";
  return ((num / den) * 100).toFixed(1) + "%";
}

function parseBilling(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

// ── Column layout constants (A4 landscape: 842pt − 64pt margins = 778pt) ──────

/**
 * Monthly apuração table
 * label(160) + 12 × month(45=540) + total(78) = 778
 */
const MT = { label: 160, month: 45, total: 78 } as const;

/**
 * Items table
 * code(72) + desc(flex) + qty(66) + val(90) + fin(90) + proc(60) = 378 fixed
 * description gets the remaining ~400pt
 */
const IT = { code: 72, qty: 66, val: 90, fin: 90, proc: 60 } as const;

// ── StyleSheet ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // ── Page ──
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.body,
    paddingTop: 28,
    paddingBottom: 36,
    paddingLeft: 32,
    paddingRight: 32,
    backgroundColor: C.white,
  },

  // ── Header bar ──
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.darkGreen,
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  headerBrand: {
    fontSize: 7.5,
    color: C.headerSub,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerYear: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  headerGenerated: {
    fontSize: 7,
    color: C.headerSub,
    marginTop: 2,
  },

  // ── Section title ──
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 7,
    marginTop: 12,
  },

  // ── KPI grid ──
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.bgLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
  },
  kpiValueGreen: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
  },
  kpiValueDim: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.dimText,
  },

  // ── Alert ──
  alertBox: {
    flexDirection: "row",
    backgroundColor: C.warnBg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.warnBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    gap: 7,
    alignItems: "flex-start",
  },
  alertDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#B45309",
    marginTop: 2,
  },
  alertText: {
    flex: 1,
    fontSize: 7.5,
    color: C.warnText,
    lineHeight: 1.45,
  },
  alertBold: {
    fontFamily: "Helvetica-Bold",
    color: "#92400E",
  },

  // ── Table shared ──
  tableWrap: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.bgLight,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: C.white,
  },
  tableRowAlt: {
    flexDirection: "row",
    backgroundColor: C.rowAlt,
  },
  tableFoot: {
    flexDirection: "row",
    backgroundColor: C.bgTotal,
    borderTopWidth: 2,
    borderTopColor: C.border,
  },
  th: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  thR: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 5,
    textAlign: "right",
  },
  td: {
    fontSize: 7.5,
    color: C.body,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  tdR: {
    fontSize: 7.5,
    color: C.body,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "right",
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  tdDim: {
    fontSize: 7.5,
    color: C.dimText,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "right",
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  tdFoot: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  tdFootR: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    paddingVertical: 5,
    paddingHorizontal: 5,
    textAlign: "right",
  },

  // ── Monthly table specifics ──
  mtLabelHead: {
    width: MT.label,
    borderRightWidth: 1,
    borderRightColor: C.border,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  mtMonthHead: {
    width: MT.month,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 3,
    textAlign: "right",
    borderBottomWidth: 0,
  },
  mtTotalHead: {
    width: MT.total,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 5,
    textAlign: "right",
    backgroundColor: C.bgTotalHead,
    borderLeftWidth: 2,
    borderLeftColor: C.border,
  },
  mtLabelCell: {
    width: MT.label,
    borderRightWidth: 1,
    borderRightColor: C.border,
    fontSize: 7,
    color: C.body,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  mtLabelCellBold: {
    width: MT.label,
    borderRightWidth: 1,
    borderRightColor: C.border,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: C.border,
  },
  mtLabelCellMuted: {
    width: MT.label,
    borderRightWidth: 1,
    borderRightColor: C.border,
    fontSize: 7,
    color: C.muted,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  mtMonthCell: {
    width: MT.month,
    fontSize: 6.5,
    color: C.body,
    paddingVertical: 4,
    paddingHorizontal: 3,
    textAlign: "right",
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  mtMonthCellBilling: {
    width: MT.month,
    fontSize: 6.5,
    color: C.body,
    paddingVertical: 4,
    paddingHorizontal: 3,
    textAlign: "right",
    borderBottomWidth: 2,
    borderBottomColor: C.border,
  },
  mtMonthCellPct: {
    width: MT.month,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 3,
    textAlign: "right",
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  mtMonthCellPctLast: {
    width: MT.month,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 3,
    textAlign: "right",
    borderBottomWidth: 0,
  },
  mtTotalCell: {
    width: MT.total,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "right",
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  mtTotalCellBilling: {
    width: MT.total,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "right",
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    borderBottomWidth: 2,
    borderBottomColor: C.border,
  },
  mtTotalCellPct: {
    width: MT.total,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "right",
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  mtTotalCellPctLast: {
    width: MT.total,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 5,
    textAlign: "right",
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    borderBottomWidth: 0,
  },

  // ── Items table specifics ──
  itCode: {
    width: IT.code,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  itDesc: {
    flex: 1,
    fontSize: 7.5,
    color: C.body,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  itQty: {
    width: IT.qty,
    fontSize: 7.5,
    color: C.body,
    textAlign: "right",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  itVal: {
    width: IT.val,
    fontSize: 7.5,
    color: C.body,
    textAlign: "right",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  itFin: {
    width: IT.fin,
    fontSize: 7.5,
    textAlign: "right",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  itProc: {
    width: IT.proc,
    fontSize: 7.5,
    color: C.body,
    textAlign: "right",
    paddingRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF1EC",
  },
  itCodeFoot: {
    width: IT.code,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  itDescFoot: {
    flex: 1,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  itQtyFoot: {
    width: IT.qty,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    textAlign: "right",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  itValFoot: {
    width: IT.val,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    textAlign: "right",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  itFinFoot: {
    width: IT.fin,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    textAlign: "right",
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  itProcFoot: {
    width: IT.proc,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.darkGreen,
    textAlign: "right",
    paddingRight: 8,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },

  // ── Page footer ──
  pageFooter: {
    position: "absolute",
    bottom: 14,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerBrand: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
  },
  footerPage: {
    fontSize: 6.5,
    color: C.muted,
  },
  // Disclaimer below monthly table
  disclaimer: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 5,
  },
});

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader({
  selectedYear,
  generatedAt,
}: {
  selectedYear: number;
  generatedAt: string;
}) {
  return (
    <View style={S.headerBar}>
      <View>
        <Text style={S.headerTitle}>Relatório de Fechamento</Text>
        <Text style={S.headerBrand}>MOVE REUSE</Text>
      </View>
      <View style={S.headerRight}>
        <Text style={S.headerYear}>Ano {selectedYear}</Text>
        <Text style={S.headerGenerated}>Gerado em: {generatedAt}</Text>
      </View>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={S.pageFooter} fixed>
      <Text style={S.footerBrand}>MOVE REUSE</Text>
      <Text
        style={S.footerPage}
        render={({
          pageNumber,
          totalPages,
        }: {
          pageNumber: number;
          totalPages: number;
        }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

function MonthlyApuracaoTable({
  yearlyData,
  billingByMonth,
  totalOpened,
  totalClosed,
  totalBilled,
}: {
  yearlyData: YearlyMonthData[];
  billingByMonth: Record<string, string>;
  totalOpened: number;
  totalClosed: number;
  totalBilled: number;
}) {
  return (
    <View style={S.tableWrap}>
      {/* Header row */}
      <View style={S.tableHead}>
        <Text style={S.mtLabelHead}>Indicador</Text>
        {yearlyData.map((d) => (
          <Text key={d.month} style={S.mtMonthHead}>
            {d.label}
          </Text>
        ))}
        <Text style={S.mtTotalHead}>Total</Text>
      </View>

      {/* Row 1 — R$ Processos Abertos */}
      <View style={S.tableRow}>
        <Text style={S.mtLabelCell}>R$ Processos Abertos</Text>
        {yearlyData.map((d) => (
          <Text key={d.month} style={S.mtMonthCell}>
            {d.openedValue > 0 ? fmtCompact(d.openedValue) : "—"}
          </Text>
        ))}
        <Text style={S.mtTotalCell}>{fmtCur(totalOpened)}</Text>
      </View>

      {/* Row 2 — R$ Processos Finalizados */}
      <View style={S.tableRowAlt}>
        <Text style={S.mtLabelCell}>R$ Processos Finalizados</Text>
        {yearlyData.map((d) => (
          <Text key={d.month} style={S.mtMonthCell}>
            {d.closedValue > 0 ? fmtCompact(d.closedValue) : "—"}
          </Text>
        ))}
        <Text style={S.mtTotalCell}>{fmtCur(totalClosed)}</Text>
      </View>

      {/* Row 3 — R$ Faturado (editable values from state) */}
      <View style={S.tableRow}>
        <Text style={S.mtLabelCellBold}>R$ Faturado no Mês</Text>
        {yearlyData.map((d) => {
          const billed = parseBilling(billingByMonth[d.month]);
          return (
            <Text key={d.month} style={S.mtMonthCellBilling}>
              {billed > 0 ? fmtCompact(billed) : "—"}
            </Text>
          );
        })}
        <Text style={S.mtTotalCellBilling}>
          {totalBilled > 0 ? fmtCur(totalBilled) : "—"}
        </Text>
      </View>

      {/* Row 4 — % Fin / Ab */}
      <View style={S.tableRowAlt}>
        <Text style={S.mtLabelCellMuted}>% R$ Finalizados / Abertos</Text>
        {yearlyData.map((d) => (
          <Text key={d.month} style={S.mtMonthCellPct}>
            {safePct(d.closedValue, d.openedValue)}
          </Text>
        ))}
        <Text style={S.mtTotalCellPct}>{safePct(totalClosed, totalOpened)}</Text>
      </View>

      {/* Row 5 — % Ab / Fat */}
      <View style={S.tableRow}>
        <Text style={S.mtLabelCellMuted}>% R$ Abertos / Faturamento</Text>
        {yearlyData.map((d) => {
          const billed = parseBilling(billingByMonth[d.month]);
          return (
            <Text key={d.month} style={S.mtMonthCellPct}>
              {safePct(d.openedValue, billed)}
            </Text>
          );
        })}
        <Text style={S.mtTotalCellPct}>{safePct(totalOpened, totalBilled)}</Text>
      </View>

      {/* Row 6 — % Fin / Fat (no bottom border) */}
      <View style={S.tableRowAlt}>
        <Text style={{ ...S.mtLabelCellMuted, borderBottomWidth: 0 }}>
          % R$ Finalizados / Faturamento
        </Text>
        {yearlyData.map((d) => {
          const billed = parseBilling(billingByMonth[d.month]);
          return (
            <Text key={d.month} style={S.mtMonthCellPctLast}>
              {safePct(d.closedValue, billed)}
            </Text>
          );
        })}
        <Text style={S.mtTotalCellPctLast}>{safePct(totalClosed, totalBilled)}</Text>
      </View>
    </View>
  );
}

function ItemsTablePdf({
  productGroups,
  totalQuantity,
  totalValue,
  totalFinalizedValue,
  totalDistinctOccurrences,
}: {
  productGroups: ProductGroupRow[];
  totalQuantity: number;
  totalValue: number;
  totalFinalizedValue: number;
  totalDistinctOccurrences: number;
}) {
  if (productGroups.length === 0) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 4,
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 8, color: C.muted }}>
          Nenhum item avariado encontrado para os filtros selecionados.
        </Text>
      </View>
    );
  }

  return (
    <View style={S.tableWrap}>
      {/* Header */}
      <View style={S.tableHead}>
        <Text style={{ ...S.th, width: IT.code }}>Cód. Interno</Text>
        <Text style={{ ...S.th, flex: 1 }}>Descrição</Text>
        <Text style={{ ...S.thR, width: IT.qty }}>Quantidade</Text>
        <Text style={{ ...S.thR, width: IT.val }}>Valor Total</Text>
        <Text style={{ ...S.thR, width: IT.fin }}>Valor Finalizado</Text>
        <Text style={{ ...S.thR, width: IT.proc }}>Processos</Text>
      </View>

      {/* Body */}
      {productGroups.map((row, idx) => (
        <View key={row.productId} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={S.itCode}>{row.internalCode}</Text>
          <Text style={S.itDesc}>{row.description}</Text>
          <Text style={S.itQty}>{fmtQty(row.totalQuantity)}</Text>
          <Text style={S.itVal}>{fmtCur(row.totalValue)}</Text>
          <Text style={{ ...S.itFin, color: row.finalizedValue > 0 ? C.body : C.dimText }}>
            {row.finalizedValue > 0 ? fmtCur(row.finalizedValue) : "—"}
          </Text>
          <Text style={S.itProc}>{row.occurrenceCount}</Text>
        </View>
      ))}

      {/* Footer / Totals */}
      <View style={S.tableFoot}>
        <Text style={S.itCodeFoot}></Text>
        <Text style={S.itDescFoot}>
          Total ({productGroups.length}{" "}
          {productGroups.length === 1 ? "produto" : "produtos"})
        </Text>
        <Text style={S.itQtyFoot}>{fmtQty(totalQuantity)}</Text>
        <Text style={S.itValFoot}>{fmtCur(totalValue)}</Text>
        <Text style={S.itFinFoot}>
          {totalFinalizedValue > 0 ? fmtCur(totalFinalizedValue) : "—"}
        </Text>
        <Text style={S.itProcFoot}>{totalDistinctOccurrences}</Text>
      </View>
    </View>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ClosingReportPdfProps {
  selectedYear: number;
  /** Pre-formatted date/time string, e.g. "28/05/2026 às 14:30". */
  generatedAt: string;
  yearlyData: YearlyMonthData[];
  billingByMonth: Record<string, string>;
  productGroups: ProductGroupRow[];
  totalQuantity: number;
  totalValue: number;
  totalFinalizedValue: number;
  totalDistinctOccurrences: number;
}

// ── Main Document ──────────────────────────────────────────────────────────────

export function ClosingReportPdf({
  selectedYear,
  generatedAt,
  yearlyData,
  billingByMonth,
  productGroups,
  totalQuantity,
  totalValue,
  totalFinalizedValue,
  totalDistinctOccurrences,
}: ClosingReportPdfProps) {
  const totalOpened = yearlyData.reduce((s, d) => s + d.openedValue, 0);
  const totalClosed = yearlyData.reduce((s, d) => s + d.closedValue, 0);
  const totalBilled = yearlyData.reduce(
    (s, d) => s + parseBilling(billingByMonth[d.month]),
    0
  );

  return (
    <Document
      title={`Relatório de Fechamento ${selectedYear}`}
      author="MOVE REUSE"
      creator="MOVE REUSE"
    >
      {/* ── Página 1: Resumo + Apuração Mensal ── */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <PageHeader selectedYear={selectedYear} generatedAt={generatedAt} />

        {/* Resumo Executivo */}
        <Text style={S.sectionTitle}>Resumo Executivo</Text>
        <View style={S.kpiRow}>
          <View style={S.kpiCard}>
            <Text style={S.kpiLabel}>R$ Processos Abertos no Ano</Text>
            <Text style={S.kpiValue}>{fmtCur(totalOpened)}</Text>
          </View>
          <View style={S.kpiCard}>
            <Text style={S.kpiLabel}>R$ Processos Finalizados no Ano</Text>
            <Text style={S.kpiValue}>{fmtCur(totalClosed)}</Text>
          </View>
          <View style={S.kpiCard}>
            <Text style={S.kpiLabel}>R$ Faturado Registrado no Ano</Text>
            <Text style={totalBilled > 0 ? S.kpiValue : S.kpiValueDim}>
              {totalBilled > 0 ? fmtCur(totalBilled) : "—"}
            </Text>
          </View>
        </View>
        <View style={S.kpiRow}>
          <View style={S.kpiCard}>
            <Text style={S.kpiLabel}>% R$ Finalizados / Abertos</Text>
            <Text style={S.kpiValueGreen}>{safePct(totalClosed, totalOpened)}</Text>
          </View>
          <View style={S.kpiCard}>
            <Text style={S.kpiLabel}>% R$ Abertos / Faturamento</Text>
            <Text style={S.kpiValueGreen}>{safePct(totalOpened, totalBilled)}</Text>
          </View>
          <View style={S.kpiCard}>
            <Text style={S.kpiLabel}>% R$ Finalizados / Faturamento</Text>
            <Text style={S.kpiValueGreen}>{safePct(totalClosed, totalBilled)}</Text>
          </View>
        </View>

        {/* Alerta */}
        <View style={S.alertBox}>
          <View style={S.alertDot} />
          <Text style={S.alertText}>
            <Text style={S.alertBold}>Atenção: </Text>
            Certifique-se que todas as ocorrências finalizadas, tiveram sua baixa
            realizada no sistema/ERP.
          </Text>
        </View>

        {/* Apuração Mensal */}
        <Text style={[S.sectionTitle, { marginTop: 14 }]}>
          Apuração Mensal — {selectedYear}
        </Text>
        <MonthlyApuracaoTable
          yearlyData={yearlyData}
          billingByMonth={billingByMonth}
          totalOpened={totalOpened}
          totalClosed={totalClosed}
          totalBilled={totalBilled}
        />
        <Text style={S.disclaimer}>
          * Valores mensais em formato inteiro (sem centavos) para adequação ao espaço.
          Totais na coluna &quot;Total&quot; incluem centavos completos.
          R$ Faturado: valores inseridos manualmente pelo usuário, não são salvos no sistema.
        </Text>

        <PageFooter />
      </Page>

      {/* ── Página 2: Itens Avariados ── */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <PageHeader selectedYear={selectedYear} generatedAt={generatedAt} />

        <Text style={S.sectionTitle}>
          Itens Avariados no Período
          {" · "}
          {productGroups.length}{" "}
          {productGroups.length === 1 ? "produto" : "produtos"}
          {" · "}
          {totalDistinctOccurrences}{" "}
          {totalDistinctOccurrences === 1 ? "processo" : "processos"}
        </Text>

        <ItemsTablePdf
          productGroups={productGroups}
          totalQuantity={totalQuantity}
          totalValue={totalValue}
          totalFinalizedValue={totalFinalizedValue}
          totalDistinctOccurrences={totalDistinctOccurrences}
        />

        <PageFooter />
      </Page>
    </Document>
  );
}
