"use client";
import { useState, useMemo, useCallback, createElement } from "react";
import { FileText, Download, Sheet, AlertTriangle, CalendarDays, SlidersHorizontal } from "lucide-react";
import type { ClosingReportOccurrence, ClosingReportParam } from "@/lib/closing-report/types";
import { EMPTY_CLOSING_FILTERS } from "@/lib/closing-report/types";
import type { DashboardFilters } from "@/lib/dashboard/types";
import {
  getAvailableYears,
  computeYearlyData,
  applyClosingFilters,
  computeProductGroups,
} from "@/lib/closing-report/metrics";
import { fmtCurrency } from "@/lib/dashboard/chart-utils";
import { ExpandableChartCard } from "@/components/dashboard/expandable-chart-card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { LineChart } from "@/components/closing-report/line-chart";
import { MonthlyTable } from "@/components/closing-report/monthly-table";
import { ItemsTable } from "@/components/closing-report/items-table";

interface ClosingReportViewProps {
  occurrences: ClosingReportOccurrence[];
  statusParams: ClosingReportParam[];
  originParams: ClosingReportParam[];
  damageTypeParams: ClosingReportParam[];
  destinationParams: ClosingReportParam[];
  userParams: { id: string; name: string }[];
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const fieldClass =
  "rounded-md px-2.5 py-1.5 text-sm outline-none cursor-pointer transition-colors focus:ring-2 focus:ring-offset-0";

const fieldStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #DDE7DE",
  color: "#1C2A24",
};

const labelStyle: React.CSSProperties = {
  color: "#6B756F",
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontWeight: 600,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ClosingReportView({
  occurrences,
  statusParams,
  originParams,
  damageTypeParams,
  destinationParams,
  userParams,
}: ClosingReportViewProps) {
  // ── Gerencial filter (year) ──────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // ── Billing (local, per month) ───────────────────────────────────────────────
  const [billingByMonth, setBillingByMonth] = useState<Record<string, string>>({});

  // ── Detail filter (items table) ──────────────────────────────────────────────
  const [itemFilters, setItemFilters] = useState<DashboardFilters>(EMPTY_CLOSING_FILTERS);

  // ── Export state ─────────────────────────────────────────────────────────────
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Derived: available years ─────────────────────────────────────────────────
  const availableYears = useMemo(
    () => getAvailableYears(occurrences),
    [occurrences]
  );

  // ── Gerencial: yearly chart + table data ─────────────────────────────────────
  const yearlyData = useMemo(
    () => computeYearlyData(occurrences, selectedYear),
    [occurrences, selectedYear]
  );

  const openedChartData = useMemo(
    () => yearlyData.map((d) => ({ label: d.label, value: d.openedValue })),
    [yearlyData]
  );

  const closedChartData = useMemo(
    () => yearlyData.map((d) => ({ label: d.label, value: d.closedValue })),
    [yearlyData]
  );

  // Header stats: totals for the selected year
  const totalOpenedValue = useMemo(
    () => yearlyData.reduce((s, d) => s + d.openedValue, 0),
    [yearlyData]
  );
  const totalClosedValue = useMemo(
    () => yearlyData.reduce((s, d) => s + d.closedValue, 0),
    [yearlyData]
  );

  // ── Detail: filtered occurrences → product groups ───────────────────────────
  const filteredOccurrences = useMemo(
    () => applyClosingFilters(occurrences, itemFilters),
    [occurrences, itemFilters]
  );

  const productGroups = useMemo(
    () => computeProductGroups(filteredOccurrences),
    [filteredOccurrences]
  );

  // Aggregate totals for the items table
  const totalQuantity = productGroups.reduce((s, r) => s + r.totalQuantity, 0);
  const totalValue = productGroups.reduce((s, r) => s + r.totalValue, 0);
  const totalFinalizedValue = productGroups.reduce((s, r) => s + r.finalizedValue, 0);
  const totalDistinctOccurrences = filteredOccurrences.filter((o) => o.items.length > 0).length;

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    if (productGroups.length === 0) return;
    setExportingCsv(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const header = [
        "codigo_interno",
        "descricao",
        "quantidade",
        "valor_total",
        "valor_finalizado",
        "processos",
      ];
      const fmtNum = (n: number) =>
        n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const lines = [
        header.join(";"),
        ...productGroups.map((r) =>
          [
            r.internalCode,
            `"${r.description.replace(/"/g, '""')}"`,
            r.totalQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 }),
            fmtNum(r.totalValue),
            fmtNum(r.finalizedValue),
            r.occurrenceCount,
          ].join(";")
        ),
        [
          "TOTAL",
          `"${productGroups.length} produto(s)"`,
          totalQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 }),
          fmtNum(totalValue),
          fmtNum(totalFinalizedValue),
          totalDistinctOccurrences,
        ].join(";"),
      ];
      const bom = "﻿"; // UTF-8 BOM for Excel compatibility
      const blob = new Blob([bom + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-fechamento-itens-avariados-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }, [productGroups, totalQuantity, totalValue, totalFinalizedValue, totalDistinctOccurrences]);

  // ── Export Excel ─────────────────────────────────────────────────────────────
  const handleExportXlsx = useCallback(async () => {
    if (productGroups.length === 0) return;
    setExportingXlsx(true);
    try {
      const XLSX = await import("xlsx");
      const today = new Date().toISOString().slice(0, 10);
      const periodLabel =
        itemFilters.dateFrom || itemFilters.dateTo
          ? `${itemFilters.dateFrom || "…"} a ${itemFilters.dateTo || "…"}`
          : `Ano ${selectedYear} (visão gerencial) · sem filtro de data no detalhamento`;

      const wsData: (string | number)[][] = [
        ["Relatório de Fechamento — Itens Avariados"],
        [`Período: ${periodLabel}`],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        [
          "Cód. Interno",
          "Descrição",
          "Quantidade",
          "Valor Total (R$)",
          "Valor Finalizado (R$)",
          "Processos",
        ],
        ...productGroups.map((r) => [
          r.internalCode,
          r.description,
          r.totalQuantity,
          r.totalValue,
          r.finalizedValue,
          r.occurrenceCount,
        ]),
        [
          "TOTAL",
          `${productGroups.length} produto(s)`,
          totalQuantity,
          totalValue,
          totalFinalizedValue,
          totalDistinctOccurrences,
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [
        { wch: 18 }, // Cód. Interno
        { wch: 44 }, // Descrição
        { wch: 14 }, // Quantidade
        { wch: 20 }, // Valor Total
        { wch: 22 }, // Valor Finalizado
        { wch: 12 }, // Processos
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Itens Avariados");
      XLSX.writeFile(wb, `relatorio-fechamento-itens-avariados-${today}.xlsx`);
    } catch (e) {
      console.error("Erro ao exportar Excel:", e);
      alert("Não foi possível exportar o arquivo Excel. Tente novamente.");
    } finally {
      setExportingXlsx(false);
    }
  }, [
    productGroups,
    totalQuantity,
    totalValue,
    totalFinalizedValue,
    totalDistinctOccurrences,
    itemFilters,
    selectedYear,
  ]);

  // ── Export PDF ───────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ClosingReportPdf } = await import(
        "@/components/closing-report/pdf-export"
      );
      const now = new Date();
      const generatedAt = now.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const element = createElement(ClosingReportPdf, {
        selectedYear,
        generatedAt,
        yearlyData,
        billingByMonth,
        productGroups,
        totalQuantity,
        totalValue,
        totalFinalizedValue,
        totalDistinctOccurrences,
      });
      // pdf() expects ReactElement<DocumentProps>; ClosingReportPdf renders a
      // Document internally, so this is safe at runtime. We cast via unknown
      // because TypeScript cannot infer the JSX return type from createElement.
      type PdfArg = Parameters<typeof pdf>[0];
      const blob = await pdf(element as unknown as PdfArg).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-fechamento-${selectedYear}-${now.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
      alert("Não foi possível exportar o arquivo PDF. Tente novamente.");
    } finally {
      setExportingPdf(false);
    }
  }, [
    selectedYear,
    yearlyData,
    billingByMonth,
    productGroups,
    totalQuantity,
    totalValue,
    totalFinalizedValue,
    totalDistinctOccurrences,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DDE7DE",
          boxShadow: "0 1px 2px rgba(8,56,51,0.04)",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0" style={{ color: "#0D6F65" }} />
            <h1
              className="text-lg font-semibold tracking-tight"
              style={{ color: "#044C45" }}
            >
              Relatório de Fechamento
            </h1>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "#6B756F" }}>
            Visão gerencial:{" "}
            <strong style={{ color: "#1C2A24" }}>Jan–Dez {selectedYear}</strong>
            &nbsp;·&nbsp;
            <span className="tabular-nums">
              {fmtCurrency(totalOpenedValue)} em abertos
            </span>
            &nbsp;·&nbsp;
            <span className="tabular-nums">
              {fmtCurrency(totalClosedValue)} em finalizados
            </span>
          </p>
        </div>

        {/* Export actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv || productGroups.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DDE7DE",
              color: productGroups.length === 0 ? "#9AA59F" : "#1C2A24",
              cursor: productGroups.length === 0 ? "default" : "pointer",
            }}
            title={productGroups.length === 0 ? "Nenhum dado para exportar" : "Exportar CSV"}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportXlsx}
            disabled={exportingXlsx || productGroups.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{
              background: productGroups.length > 0 ? "#0D6F65" : "#EAF1EC",
              border: `1px solid ${productGroups.length > 0 ? "#0D6F65" : "#DDE7DE"}`,
              color: productGroups.length > 0 ? "#FFFFFF" : "#9AA59F",
              cursor: productGroups.length === 0 ? "default" : "pointer",
            }}
            title={productGroups.length === 0 ? "Nenhum dado para exportar" : "Exportar Excel"}
          >
            <Sheet className="h-3.5 w-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DDE7DE",
              color: exportingPdf ? "#9AA59F" : "#1C2A24",
              cursor: exportingPdf ? "default" : "pointer",
            }}
            title={exportingPdf ? "Gerando PDF…" : "Exportar PDF completo"}
          >
            <FileText className="h-3.5 w-3.5" />
            {exportingPdf ? "PDF…" : "PDF"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Gerencial Filter (Year) ──────────────────────────────── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DDE7DE",
          boxShadow: "0 1px 2px rgba(8,56,51,0.03)",
        }}
      >
        <div className="flex items-start gap-2 mb-3">
          <CalendarDays className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#0D6F65" }} />
          <div>
            <h3
              className="text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "#6B756F" }}
            >
              Filtro — Visão Gerencial
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "#9AA59F" }}>
              Aplica-se aos gráficos de linha e à tabela de apuração mensal.
              O detalhamento de itens possui filtros próprios abaixo.
            </p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <span style={labelStyle}>Ano</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={fieldClass}
              style={{ ...fieldStyle, minWidth: 100 }}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 2: Line Charts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExpandableChartCard
          title="Valor de Processos Finalizados por Mês"
          subtitle={`Soma do valor dos itens das ocorrências em status final, por mês — ${selectedYear}`}
          height={240}
          expandedHeight={480}
        >
          <LineChart
            data={closedChartData}
            color="#0D6F65"
            emptyText="Sem ocorrências finalizadas no período"
          />
        </ExpandableChartCard>
        <ExpandableChartCard
          title="Valor de Processos Abertos por Mês"
          subtitle={`Soma do valor dos itens das ocorrências abertas, pela data de criação — ${selectedYear}`}
          height={240}
          expandedHeight={480}
        >
          <LineChart
            data={openedChartData}
            color="#1A8B80"
            emptyText="Sem ocorrências abertas no período"
          />
        </ExpandableChartCard>
      </div>

      {/* ── Section 3: Monthly Apuração Table ───────────────────────────────── */}
      <MonthlyTable
        yearlyData={yearlyData}
        billingByMonth={billingByMonth}
        onBillingChange={setBillingByMonth}
      />

      {/* ── Alert Banner ────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-5 py-4 flex items-start gap-3"
        style={{
          background: "#FFFBEB",
          border: "1px solid #F59E0B",
          boxShadow: "0 1px 2px rgba(180,130,0,0.06)",
        }}
      >
        <AlertTriangle
          className="h-4 w-4 shrink-0 mt-0.5"
          style={{ color: "#B45309" }}
        />
        <p className="text-sm leading-snug" style={{ color: "#78350F" }}>
          <strong>Atenção:</strong> Certifique-se que todas as ocorrências finalizadas tiveram sua baixa realizada no sistema/ERP.
        </p>
      </div>

      {/* ── Section 4: Detail Filters ────────────────────────────────────────── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DDE7DE",
          boxShadow: "0 1px 2px rgba(8,56,51,0.03)",
        }}
      >
        <div className="flex items-start gap-2 mb-3">
          <SlidersHorizontal className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#0D6F65" }} />
          <div>
            <h3
              className="text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "#6B756F" }}
            >
              Filtros — Detalhamento de Itens
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "#9AA59F" }}>
              Aplica-se exclusivamente à tabela de itens avariados abaixo.
              Os gráficos e a apuração mensal usam apenas o filtro de ano acima.
            </p>
          </div>
        </div>
        <FilterBar
          filters={itemFilters}
          onChange={setItemFilters}
          onClear={() => setItemFilters(EMPTY_CLOSING_FILTERS)}
          statuses={statusParams}
          origins={originParams}
          damageTypes={damageTypeParams}
          destinations={destinationParams}
          users={userParams}
        />
      </div>

      {/* ── Section 5: Items Table ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              className="text-[13px] font-semibold tracking-tight"
              style={{ color: "#044C45" }}
            >
              Itens Avariados no Período
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: "#6B756F" }}>
              Agrupados por produto · {productGroups.length}{" "}
              {productGroups.length === 1 ? "produto" : "produtos"} ·{" "}
              {totalDistinctOccurrences}{" "}
              {totalDistinctOccurrences === 1 ? "processo" : "processos"} ·{" "}
              {fmtCurrency(totalValue)} total ·{" "}
              {fmtCurrency(totalFinalizedValue)} finalizado
            </p>
          </div>
        </div>
        <ItemsTable
          rows={productGroups}
          totalQuantity={totalQuantity}
          totalValue={totalValue}
          totalFinalizedValue={totalFinalizedValue}
          totalDistinctOccurrences={totalDistinctOccurrences}
        />
      </div>
    </div>
  );
}
