"use client";
import { useState, useMemo, useCallback } from "react";
import { FileText, Download, Sheet, AlertTriangle } from "lucide-react";
import type { ClosingReportOccurrence, ClosingReportParam } from "@/lib/closing-report/types";
import { EMPTY_CLOSING_FILTERS } from "@/lib/closing-report/types";
import type { DashboardFilters } from "@/lib/dashboard/types";
import {
  getMonthRange,
  computeMonthlyChartData,
  computeMonthlyTableRows,
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

export function ClosingReportView({
  occurrences,
  statusParams,
  originParams,
  damageTypeParams,
  destinationParams,
  userParams,
}: ClosingReportViewProps) {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_CLOSING_FILTERS);
  const [billingByMonth, setBillingByMonth] = useState<Record<string, string>>({});
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // Month range is driven only by dateFrom / dateTo (not by status/origin etc.)
  const months = useMemo(
    () => getMonthRange(filters.dateFrom, filters.dateTo),
    [filters.dateFrom, filters.dateTo]
  );

  // Monthly chart series — derived from ALL occurrences bucketed into the month range
  const { opened: openedChartData, closed: closedChartData } = useMemo(
    () => computeMonthlyChartData(occurrences, months),
    [occurrences, months]
  );

  // Monthly table rows (same bucket logic)
  const monthlyRows = useMemo(
    () => computeMonthlyTableRows(occurrences, months),
    [occurrences, months]
  );

  // Filtered occurrences (all filters, for items table)
  const filteredOccurrences = useMemo(
    () => applyClosingFilters(occurrences, filters),
    [occurrences, filters]
  );

  // Product groups for items table
  const productGroups = useMemo(
    () => computeProductGroups(filteredOccurrences),
    [filteredOccurrences]
  );

  // Aggregate totals
  const totalQuantity = productGroups.reduce((s, r) => s + r.totalQuantity, 0);
  const totalValue = productGroups.reduce((s, r) => s + r.totalValue, 0);
  // Distinct occurrence count: all filtered occurrences that have items
  const totalDistinctOccurrences = filteredOccurrences.filter((o) => o.items.length > 0).length;

  // Quick stats for the header
  const totalOpenedValue = useMemo(
    () =>
      occurrences
        .filter((o) => {
          const d = o.createdAtIso.substring(0, 10);
          const from = months[0]?.month.replace(/-/g, "") ?? "";
          const to = months[months.length - 1]?.month.replace(/-/g, "") ?? "";
          const dm = d.substring(0, 7).replace(/-/g, "");
          return (!from || dm >= from) && (!to || dm <= to);
        })
        .reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.totalValue, 0), 0),
    [occurrences, months]
  );
  const totalClosedValue = useMemo(
    () =>
      occurrences
        .filter((o) => {
          if (!o.completedAtIso) return false;
          const dm = o.completedAtIso.substring(0, 7);
          const from = months[0]?.month ?? "";
          const to = months[months.length - 1]?.month ?? "";
          return (!from || dm >= from) && (!to || dm <= to);
        })
        .reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.totalValue, 0), 0),
    [occurrences, months]
  );

  // --- Export CSV ---
  const handleExportCsv = useCallback(() => {
    if (productGroups.length === 0) return;
    setExportingCsv(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const header = ["codigo_interno", "descricao", "quantidade", "valor_total", "processos"];
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
            r.occurrenceCount,
          ].join(";")
        ),
        // Total row
        [
          "TOTAL",
          `"${productGroups.length} produto(s)"`,
          totalQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 }),
          fmtNum(totalValue),
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
  }, [productGroups, totalQuantity, totalValue, totalDistinctOccurrences]);

  // --- Export Excel (xlsx devDep) ---
  const handleExportXlsx = useCallback(async () => {
    if (productGroups.length === 0) return;
    setExportingXlsx(true);
    try {
      const XLSX = await import("xlsx");
      const today = new Date().toISOString().slice(0, 10);
      const periodLabel =
        filters.dateFrom || filters.dateTo
          ? `${filters.dateFrom || "…"} a ${filters.dateTo || "…"}`
          : "Últimos 12 meses";

      const wsData: (string | number)[][] = [
        // Meta header
        ["Relatório de Fechamento — Itens Avariados"],
        [`Período: ${periodLabel}`],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        // Column headers
        ["Cód. Interno", "Descrição", "Quantidade", "Valor Total (R$)", "Processos"],
        // Data rows
        ...productGroups.map((r) => [
          r.internalCode,
          r.description,
          r.totalQuantity,
          r.totalValue,
          r.occurrenceCount,
        ]),
        // Total
        [
          "TOTAL",
          `${productGroups.length} produto(s)`,
          totalQuantity,
          totalValue,
          totalDistinctOccurrences,
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws["!cols"] = [
        { wch: 18 },  // Cód. Interno
        { wch: 48 },  // Descrição
        { wch: 14 },  // Quantidade
        { wch: 20 },  // Valor Total
        { wch: 12 },  // Processos
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
  }, [productGroups, totalQuantity, totalValue, totalDistinctOccurrences, filters]);

  const periodLabel =
    months.length > 0
      ? `${months[0].label} – ${months[months.length - 1].label}`
      : "—";

  return (
    <div className="space-y-6 pb-8">
      {/* ── Page Header ─────────────────────────────────────────────── */}
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
            Período visualizado: <strong style={{ color: "#1C2A24" }}>{periodLabel}</strong>
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
        </div>
      </div>

      {/* ── Section 1: Line Charts ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExpandableChartCard
          title="Valor de Processos Finalizados por Mês"
          subtitle="Soma do valor dos itens das ocorrências concluídas, pela data de finalização"
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
          subtitle="Soma do valor dos itens das ocorrências abertas, pela data de criação"
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

      {/* ── Section 2: Monthly Apuração Table ───────────────────────── */}
      <MonthlyTable
        rows={monthlyRows}
        billingByMonth={billingByMonth}
        onBillingChange={setBillingByMonth}
      />

      {/* ── Section 3: Filters ──────────────────────────────────────── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DDE7DE",
          boxShadow: "0 1px 2px rgba(8,56,51,0.03)",
        }}
      >
        <div className="mb-3">
          <h3
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "#6B756F" }}
          >
            Filtros — Detalhamento de Itens
          </h3>
          <p className="text-[11px] mt-1" style={{ color: "#9AA59F" }}>
            Os filtros abaixo se aplicam ao detalhamento de itens avariados. A visão mensal (gráficos e apuração) considera apenas o período selecionado.
          </p>
        </div>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(EMPTY_CLOSING_FILTERS)}
          statuses={statusParams}
          origins={originParams}
          damageTypes={damageTypeParams}
          destinations={destinationParams}
          users={userParams}
        />
      </div>

      {/* ── Alert Banner ────────────────────────────────────────────── */}
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

      {/* ── Section 4: Items Table ───────────────────────────────────── */}
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
              {fmtCurrency(totalValue)} total
            </p>
          </div>
        </div>
        <ItemsTable
          rows={productGroups}
          totalQuantity={totalQuantity}
          totalValue={totalValue}
          totalDistinctOccurrences={totalDistinctOccurrences}
        />
      </div>
    </div>
  );
}
