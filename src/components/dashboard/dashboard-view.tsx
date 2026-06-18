"use client";
import { useState, useMemo } from "react";
import { applyFilters, computeMetrics } from "@/lib/dashboard/metrics";
import { EMPTY_FILTERS } from "@/lib/dashboard/types";
import type {
  DashboardOccurrence,
  DashboardParam,
  DashboardFilters,
  MonthDamageCount,
  MonthDamageValue,
} from "@/lib/dashboard/types";
import type { UserRole } from "@/lib/auth/types";
import {
  fmtCurrency,
  fmtCurrencyCompact,
  fmtInt,
  pickCategoricalColor,
} from "@/lib/dashboard/chart-utils";

import { StatCard } from "./stat-card";
import { FilterBar } from "./filter-bar";
import { ExpandableChartCard } from "./expandable-chart-card";
import { UserRankingCard } from "./user-ranking-card";

import {
  StackedColumnChart,
  StackedLegend,
  type StackedSeries,
  type StackedColumnDatum,
} from "./charts/stacked-column-chart";
import { DonutChart, type DonutDatum } from "./charts/donut-chart";
import { HorizontalBarChart } from "./charts/horizontal-bar-chart";
import { FunnelChart } from "./charts/funnel-chart";

interface DashboardViewProps {
  occurrences: DashboardOccurrence[];
  statusParams: DashboardParam[];
  originParams: DashboardParam[];
  damageTypeParams: DashboardParam[];
  destinationParams: DashboardParam[];
  userParams: DashboardParam[];
  userRole: UserRole;
}

/** Max distinct damage-type series rendered as their own color. Above this, the rest is grouped into "Outros". */
const MAX_DAMAGE_SERIES = 10;
const OTHERS_COLOR = "#9AA59F";
const OTHERS_ID = "__others__";

export function DashboardView({
  occurrences,
  statusParams,
  originParams,
  damageTypeParams,
  destinationParams,
  userParams,
  userRole,
}: DashboardViewProps) {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<number>([currentYear]);
    for (const o of occurrences) {
      years.add(new Date(o.createdAtIso).getFullYear());
      if (o.completedAtIso) years.add(new Date(o.completedAtIso).getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  }, [occurrences]);

  // Pre-filter by selected year (createdAt) before any other filter
  const yearFiltered = useMemo(
    () => occurrences.filter((o) => new Date(o.createdAtIso).getFullYear() === selectedYear),
    [occurrences, selectedYear]
  );

  const filtered = useMemo(
    () => applyFilters(yearFiltered, filters),
    [yearFiltered, filters]
  );
  const m = useMemo(
    () => computeMetrics(filtered, statusParams, selectedYear),
    [filtered, statusParams, selectedYear]
  );

  const canSeeUserRanking = userRole === "GESTOR" || userRole === "ADMIN";
  const hasIncompleteValues = m.zeroValueItems > 0;
  const avgDaysLabel = `${m.avgCycleDays.toFixed(1)} dias`;
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const periodLabel = formatPeriodLabel(filters, selectedYear);

  // ----- Build damage-type series (shared across the 4 temporal charts) -----
  const damageSeriesTop: StackedSeries[] = m.damageUniverse
    .slice(0, MAX_DAMAGE_SERIES)
    .map((d, i) => ({
      id: d.id,
      name: d.name,
      color: pickCategoricalColor(i),
    }));
  const damageSeriesIds = new Set(damageSeriesTop.map((s) => s.id));
  const needsOthers = m.damageUniverse.length > MAX_DAMAGE_SERIES;
  const damageSeries: StackedSeries[] = needsOthers
    ? [
        ...damageSeriesTop,
        { id: OTHERS_ID, name: "Outros", color: OTHERS_COLOR },
      ]
    : damageSeriesTop;

  const monthlyOpenedItemsData = buildStackedFromCount(
    m.monthlyOpenedItemsByDamage,
    damageSeriesIds,
    needsOthers
  );
  const monthlyClosedItemsData = buildStackedFromCount(
    m.monthlyClosedItemsByDamage,
    damageSeriesIds,
    needsOthers
  );
  const monthlyOpenedValueData = buildStackedFromValue(
    m.monthlyOpenedValueByDamage,
    damageSeriesIds,
    needsOthers
  );
  const monthlyClosedValueData = buildStackedFromValue(
    m.monthlyClosedValueByDamage,
    damageSeriesIds,
    needsOthers
  );

  // ----- Support charts -----
  const damageDonut: DonutDatum[] = m.byDamageType.map((d) => ({
    id: d.id,
    name: d.name,
    value: d.count,
  }));
  const destinationDonut: DonutDatum[] = m.byDestination.map((d) => ({
    id: d.id,
    name: d.name,
    value: d.count,
  }));
  const originBars = m.byOrigin.map((o) => ({
    id: o.id,
    name: o.name,
    value: o.count,
  }));

  return (
    <div
      className="-m-6"
      style={{ background: "#F4F7F1", minHeight: "calc(100% + 3rem)" }}
    >
      <div className="px-3 md:px-6 py-4 md:py-7 space-y-6 max-w-[1440px] mx-auto">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: "#044C45", letterSpacing: "-0.01em" }}
            >
              Dashboard Gerencial de Avarias
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B756F" }}>
              Leitura operacional · {periodLabel}
              {activeFilters > 0 && (
                <>
                  <span style={{ color: "#DDE7DE", margin: "0 8px" }}>·</span>
                  <span style={{ color: "#0D6F65", fontWeight: 500 }}>
                    {activeFilters} filtro{activeFilters !== 1 ? "s" : ""}{" "}
                    aplicado{activeFilters !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>
          </div>
          <span
            className="text-[11px] font-semibold tracking-[0.18em] uppercase px-2.5 py-1 rounded"
            style={{
              background: "#FFFFFF",
              border: "1px solid #DDE7DE",
              color: "#0D6F65",
            }}
          >
            Move Reuse
          </span>
        </header>

        {/* Filters */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(EMPTY_FILTERS)}
          statuses={statusParams}
          origins={originParams}
          damageTypes={damageTypeParams}
          destinations={destinationParams}
          users={userParams}
          selectedYear={selectedYear}
          availableYears={availableYears}
          onYearChange={setSelectedYear}
        />

        {/* 2 Hero KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            label="Valor acumulado do período"
            value={fmtCurrency(m.registeredValue)}
            accent="#0D6F65"
            warn={hasIncompleteValues}
            aux={`${m.totalItems} ite${m.totalItems !== 1 ? "ns" : "m"}`}
            sub={
              hasIncompleteValues
                ? `Com base nos preços cadastrados · ${m.zeroValueItems} ite${m.zeroValueItems !== 1 ? "ns" : "m"} sem preço não compõem o valor`
                : "Com base nos preços cadastrados no momento"
            }
          />
          <StatCard
            label="Tempo médio em ciclo"
            value={avgDaysLabel}
            accent="#1A8B80"
            aux={
              m.totalOccurrences > 0
                ? `${m.totalOccurrences} ocorrência${m.totalOccurrences !== 1 ? "s" : ""}`
                : undefined
            }
            sub="Média de dias entre abertura e finalização; para ocorrências abertas, considera até hoje."
          />
        </section>

        {/* ----- Evolução temporal (4 charts, all stacked by damage type) ----- */}
        <SectionTitle title="Evolução temporal" />

        {/* Shared legend card */}
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DDE7DE",
          }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "#6B756F" }}
          >
            Legenda · tipos de avaria
          </span>
          <StackedLegend series={damageSeries} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableChartCard
            title="Itens de ocorrências abertas por mês"
            subtitle="Barras empilhadas por tipo de avaria · considera a data de abertura"
            height={320}
            expandedHeight={520}
            expandedLegend={<StackedLegend series={damageSeries} />}
          >
            <StackedColumnChart
              data={monthlyOpenedItemsData}
              series={damageSeries}
              formatValue={fmtInt}
            />
          </ExpandableChartCard>

          <ExpandableChartCard
            title="Itens de ocorrências encerradas por mês"
            subtitle="Barras empilhadas por tipo de avaria · considera a data de encerramento"
            height={320}
            expandedHeight={520}
            expandedLegend={<StackedLegend series={damageSeries} />}
          >
            <StackedColumnChart
              data={monthlyClosedItemsData}
              series={damageSeries}
              formatValue={fmtInt}
            />
          </ExpandableChartCard>

          <ExpandableChartCard
            title="Valor de itens em ocorrências abertas"
            subtitle="Valor acumulado por tipo de avaria · considera a data de abertura"
            height={320}
            expandedHeight={520}
            expandedLegend={<StackedLegend series={damageSeries} />}
          >
            <StackedColumnChart
              data={monthlyOpenedValueData}
              series={damageSeries}
              formatValue={fmtCurrencyCompact}
              formatTooltipValue={fmtCurrency}
            />
          </ExpandableChartCard>

          <ExpandableChartCard
            title="Valor de itens em ocorrências encerradas"
            subtitle="Valor acumulado por tipo de avaria · considera a data de encerramento"
            height={320}
            expandedHeight={520}
            expandedLegend={<StackedLegend series={damageSeries} />}
          >
            <StackedColumnChart
              data={monthlyClosedValueData}
              series={damageSeries}
              formatValue={fmtCurrencyCompact}
              formatTooltipValue={fmtCurrency}
            />
          </ExpandableChartCard>
        </div>

        {/* ----- Análises complementares ----- */}
        <SectionTitle title="Análises complementares" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExpandableChartCard
            title="Tipos de avaria"
            subtitle="Participação de cada tipo no total de itens avariados"
            height={320}
            expandedHeight={500}
            expanded={
              <DonutChart
                data={damageDonut}
                centerLabel="Itens"
                maxSlices={12}
              />
            }
          >
            <DonutChart
              data={damageDonut}
              centerLabel="Itens"
              maxSlices={7}
            />
          </ExpandableChartCard>

          <ExpandableChartCard
            title="Destinos"
            subtitle="Para onde as ocorrências são encaminhadas"
            height={320}
            expandedHeight={500}
            expanded={
              <DonutChart
                data={destinationDonut}
                centerLabel="Ocorrências"
                maxSlices={12}
              />
            }
          >
            <DonutChart
              data={destinationDonut}
              centerLabel="Ocorrências"
              maxSlices={7}
            />
          </ExpandableChartCard>
        </div>

        <ExpandableChartCard
          title="Origens"
          subtitle="De onde vêm as ocorrências"
          height={320}
          expandedHeight={520}
          expanded={
            <HorizontalBarChart
              data={originBars}
              color="#0D6F65"
              limit={20}
              emptyMessage="Nenhuma origem registrada"
            />
          }
        >
          <HorizontalBarChart
            data={originBars}
            color="#0D6F65"
            limit={8}
            emptyMessage="Nenhuma origem registrada"
          />
        </ExpandableChartCard>

        <ExpandableChartCard
          title="Funil por status"
          subtitle={`Volume em cada estágio do funil — ${m.totalOccurrences} ocorrência${m.totalOccurrences !== 1 ? "s" : ""} no período`}
          badge={`${m.totalOccurrences} total`}
          height={360}
          expandedHeight={560}
        >
          <FunnelChart data={m.byStatus} total={m.totalOccurrences} />
        </ExpandableChartCard>

        <ExpandableChartCard
          title="Aberturas por usuário"
          subtitle={
            canSeeUserRanking
              ? "Volume de ocorrências registradas por responsável no período"
              : "Acesso restrito a gestores e administradores"
          }
          height={canSeeUserRanking ? 360 : 160}
          expandedHeight={580}
          expanded={
            <UserRankingCard
              data={m.byUserOpened}
              visible={canSeeUserRanking}
              limit={50}
            />
          }
        >
          <UserRankingCard
            data={m.byUserOpened}
            visible={canSeeUserRanking}
            limit={8}
          />
        </ExpandableChartCard>

        <p
          className="text-[11px] text-center pt-2 pb-1"
          style={{ color: "#9AA59F" }}
        >
          Move Reuse · Dashboard Gerencial v1 · Dados atualizados em tempo real
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2
        className="text-[12px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "#0D6F65" }}
      >
        {title}
      </h2>
      <span
        className="flex-1 h-px"
        style={{ background: "#DDE7DE" }}
        aria-hidden
      />
    </div>
  );
}

function buildStackedFromCount(
  monthly: MonthDamageCount[],
  selectedIds: Set<string>,
  emitOthers: boolean
): StackedColumnDatum[] {
  return monthly.map((mb) => {
    const values: Record<string, number> = {};
    let others = 0;
    for (const d of mb.damages) {
      if (selectedIds.has(d.damageTypeId)) {
        values[d.damageTypeId] = d.quantity;
      } else {
        others += d.quantity;
      }
    }
    if (emitOthers && others > 0) values[OTHERS_ID] = others;
    return { label: mb.label, values };
  });
}

function buildStackedFromValue(
  monthly: MonthDamageValue[],
  selectedIds: Set<string>,
  emitOthers: boolean
): StackedColumnDatum[] {
  return monthly.map((mb) => {
    const values: Record<string, number> = {};
    let others = 0;
    for (const d of mb.damages) {
      if (selectedIds.has(d.damageTypeId)) {
        values[d.damageTypeId] = d.value;
      } else {
        others += d.value;
      }
    }
    if (emitOthers && others > 0) values[OTHERS_ID] = others;
    return { label: mb.label, values };
  });
}

function formatPeriodLabel(filters: DashboardFilters, year: number): string {
  if (filters.dateFrom && filters.dateTo) {
    return `${year} · ${formatDateBR(filters.dateFrom)} a ${formatDateBR(filters.dateTo)}`;
  }
  if (filters.dateFrom) {
    return `${year} · a partir de ${formatDateBR(filters.dateFrom)}`;
  }
  if (filters.dateTo) {
    return `${year} · até ${formatDateBR(filters.dateTo)}`;
  }
  return `Ano ${year}`;
}

function formatDateBR(iso: string): string {
  const [y, mo, d] = iso.split("-");
  if (!y || !mo || !d) return iso;
  return `${d}/${mo}/${y}`;
}
