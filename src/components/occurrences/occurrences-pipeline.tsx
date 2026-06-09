"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OccurrenceQuickView } from "@/components/occurrences/occurrence-quick-view";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertTriangle, ExternalLink, List, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SerializedPipelineOccurrence {
  id: string;
  occurrenceCode: string;
  createdAt: string;
  completedAt: string | null;
  openedBy: { id: string; name: string };
  origin: { name: string };
  status: { id: string; name: string; funnelOrder: number; isFinal: boolean };
  destination: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
    damageType: { id: string; name: string };
  }[];
}

export interface SerializedPipelineStatus {
  id: string;
  name: string;
  funnelOrder: number;
  isFinal: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Days difference normalised to calendar days (ignores time-of-day). */
function daysOpen(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(
    0,
    Math.floor((nowDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24))
  );
}

type DaysRange = "green" | "amber" | "red";

function getDaysRange(days: number): DaysRange {
  if (days <= 5) return "green";
  if (days <= 8) return "amber";
  return "red";
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "purple";

function getStatusVariant(statusName: string): BadgeVariant {
  if (statusName.includes("5-") || statusName.toLowerCase().includes("finalizado"))
    return "success";
  if (
    statusName.includes("4-") ||
    statusName.toLowerCase().includes("destinação finalizada")
  )
    return "purple";
  if (statusName.includes("3-") || statusName.toLowerCase().includes("definida"))
    return "info";
  if (statusName.includes("2-") || statusName.toLowerCase().includes("tratamento"))
    return "warning";
  return "secondary";
}

// ── Card colour styles by urgency ──────────────────────────────────────────────

const CARD_STYLES: Record<
  DaysRange | "closed",
  { card: string; daysText: string; daysBadge: string }
> = {
  green: {
    card: "border-emerald-500 bg-emerald-50",
    daysText: "text-emerald-700",
    daysBadge: "bg-emerald-100 text-emerald-700",
  },
  amber: {
    card: "border-amber-500 bg-amber-50",
    daysText: "text-amber-700",
    daysBadge: "bg-amber-100 text-amber-700",
  },
  red: {
    card: "border-red-500 bg-red-50",
    daysText: "text-red-700",
    daysBadge: "bg-red-100 text-red-700",
  },
  closed: {
    card: "border-gray-200 bg-gray-50",
    daysText: "text-gray-400",
    daysBadge: "bg-gray-100 text-gray-500",
  },
};

// ── MetricChip ─────────────────────────────────────────────────────────────────

function MetricChip({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 tabular-nums ${colorClass ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

// ── OccurrenceCard ─────────────────────────────────────────────────────────────

function OccurrenceCard({
  occ,
  onView,
}: {
  occ: SerializedPipelineOccurrence;
  onView: (id: string) => void;
}) {
  // Use isFinal as the authoritative signal — completedAt may be null for legacy
  // records that were finalized via status dropdown before this fix was applied.
  const isClosed = occ.status.isFinal;

  // Days calculation
  const openDays = isClosed ? null : daysOpen(occ.createdAt);
  const range: DaysRange | "closed" = isClosed
    ? "closed"
    : getDaysRange(openDays!);
  const style = CARD_STYLES[range];

  // Closed-in-X-days (only when completedAt is available)
  let closedInDays: number | null = null;
  if (isClosed && occ.completedAt !== null) {
    const s = new Date(occ.createdAt);
    const e = new Date(occ.completedAt);
    const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    closedInDays = Math.max(
      0,
      Math.floor((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  const totalValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
  const totalQty = occ.items.reduce((s, i) => s + i.quantity, 0);
  const hasZeroPrice = occ.items.some((i) => i.unitValue <= 0.01);
  const damageTypes = [
    ...new Map(
      occ.items.map((i) => [i.damageType.id, i.damageType.name])
    ).entries(),
  ].map(([id, name]) => ({ id, name }));

  return (
    <div
      className={`rounded-lg border-2 ${style.card} p-3 cursor-pointer transition-shadow hover:shadow-md`}
      onClick={() => onView(occ.id)}
    >
      {/* ── Header: code + status badge + no-price icon ─── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="font-mono text-sm font-semibold leading-tight">
            {occ.occurrenceCode}
          </span>
          <Badge
            variant={getStatusVariant(occ.status.name)}
            className="text-xs shrink-0"
          >
            {occ.status.name}
          </Badge>
          {hasZeroPrice && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-amber-500 shrink-0"
              aria-label="Contém item sem preço"
            />
          )}
        </div>
      </div>

      {/* ── Days indicator ─────────────────────────────── */}
      <div className="mt-2">
        {isClosed ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.daysBadge}`}
          >
            Concluída
            {closedInDays !== null && (
              <>
                {" "}·{" "}
                {closedInDays === 0
                  ? "mesmo dia"
                  : closedInDays === 1
                  ? "1 dia"
                  : `${closedInDays} dias`}
              </>
            )}
          </span>
        ) : (
          <span
            className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${style.daysBadge}`}
          >
            {openDays === 0
              ? "Aberta hoje"
              : openDays === 1
              ? "1 dia em aberto"
              : `${openDays} dias em aberto`}
          </span>
        )}
      </div>

      {/* ── Meta: date, origin, destination, responsible ─ */}
      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-2">
          <span>
            {isClosed ? "Encerrada" : "Aberta"}:{" "}
            <span className="text-foreground/80">{formatDate(occ.createdAt)}</span>
          </span>
          <span>·</span>
          <span className="text-foreground/80">{occ.origin.name}</span>
        </div>
        {occ.destination ? (
          <p>
            Destino:{" "}
            <span className="text-foreground/80">{occ.destination.name}</span>
          </p>
        ) : (
          <p className="text-muted-foreground/60">Sem destino</p>
        )}
        <p>
          Responsável:{" "}
          <span className="text-foreground/80">{occ.openedBy.name}</span>
        </p>
      </div>

      {/* ── Damage type badges ─────────────────────────── */}
      {damageTypes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {damageTypes.map((dt) => (
            <Badge key={dt.id} variant="secondary" className="text-xs">
              {dt.name}
            </Badge>
          ))}
        </div>
      )}

      {/* ── Totals ─────────────────────────────────────── */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalQty % 1 === 0 ? totalQty : totalQty.toFixed(3)}x
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* ── Actions ────────────────────────────────────── */}
      <div
        className="mt-2.5 pt-2.5 border-t border-gray-200 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onView(occ.id);
          }}
        >
          Ver
        </Button>
        <Link
          href={`/occurrences/${occ.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Detalhe completo
        </Link>
      </div>
    </div>
  );
}

// ── PipelineColumn ─────────────────────────────────────────────────────────────

function PipelineColumn({
  status,
  occurrences,
  onSelectOccurrence,
}: {
  status: SerializedPipelineStatus;
  occurrences: SerializedPipelineOccurrence[];
  onSelectOccurrence: (id: string) => void;
}) {
  const totalValue = occurrences.reduce(
    (s, o) => s + o.items.reduce((is, i) => is + i.totalValue, 0),
    0
  );

  return (
    <div className="w-full md:w-[300px] md:shrink-0 flex flex-col gap-2">
      {/* Column header */}
      <div className="rounded-lg border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={getStatusVariant(status.name)}
            className="text-xs shrink-0"
          >
            {status.name}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {occurrences.length} · {formatCurrency(totalValue)}
          </span>
        </div>
      </div>

      {/* Cards */}
      {occurrences.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/50 px-3 py-8 text-center">
          <p className="text-xs text-muted-foreground">Nenhuma ocorrência</p>
        </div>
      ) : (
        occurrences.map((occ) => (
          <OccurrenceCard key={occ.id} occ={occ} onView={onSelectOccurrence} />
        ))
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OccurrencesPipeline({
  occurrences,
  statuses,
  hasMoreClosed,
}: {
  occurrences: SerializedPipelineOccurrence[];
  statuses: SerializedPipelineStatus[];
  hasMoreClosed: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyNoPrice, setOnlyNoPrice] = useState(false);
  const [daysFilter, setDaysFilter] = useState<"all" | "green" | "amber" | "red">(
    "all"
  );

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = occurrences;
    const q = search.trim().toLowerCase();
    if (q.length >= 2) {
      result = result.filter(
        (occ) =>
          occ.occurrenceCode.toLowerCase().includes(q) ||
          occ.openedBy.name.toLowerCase().includes(q) ||
          occ.origin.name.toLowerCase().includes(q) ||
          occ.items.some((i) => i.damageType.name.toLowerCase().includes(q))
      );
    }
    if (onlyOpen) result = result.filter((occ) => !occ.status.isFinal);
    if (onlyNoPrice)
      result = result.filter((occ) => occ.items.some((i) => i.unitValue <= 0.01));
    if (daysFilter !== "all") {
      result = result.filter((occ) => {
        if (occ.status.isFinal) return false;
        return getDaysRange(daysOpen(occ.createdAt)) === daysFilter;
      });
    }
    return result;
  }, [occurrences, search, onlyOpen, onlyNoPrice, daysFilter]);

  // ── Group by status + sort within each column ───────────────────────────────

  const grouped = useMemo(() => {
    const map = new Map<string, SerializedPipelineOccurrence[]>();
    for (const s of statuses) map.set(s.id, []);
    for (const occ of filtered) {
      const list = map.get(occ.status.id);
      if (list) list.push(occ);
      else map.set(occ.status.id, [occ]);
    }
    // Sort: open by daysOpen DESC (most urgent first), then closed by completedAt DESC
    for (const [, list] of map) {
      list.sort((a, b) => {
        const aOpen = !a.status.isFinal;
        const bOpen = !b.status.isFinal;
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;
        if (aOpen && bOpen) return daysOpen(b.createdAt) - daysOpen(a.createdAt);
        // Both closed: sort by completedAt desc, then updatedAt fallback
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    return map;
  }, [filtered, statuses]);

  // ── Metrics ─────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const open = filtered.filter((o) => !o.status.isFinal);
    const closed = filtered.filter((o) => o.status.isFinal);
    const totalValue = filtered.reduce(
      (s, o) => s + o.items.reduce((is, i) => is + i.totalValue, 0),
      0
    );
    const noPrice = filtered.filter((o) => o.items.some((i) => i.unitValue <= 0.01))
      .length;
    const green = open.filter(
      (o) => getDaysRange(daysOpen(o.createdAt)) === "green"
    ).length;
    const amber = open.filter(
      (o) => getDaysRange(daysOpen(o.createdAt)) === "amber"
    ).length;
    const red = open.filter(
      (o) => getDaysRange(daysOpen(o.createdAt)) === "red"
    ).length;
    return { total: filtered.length, open: open.length, closed: closed.length, totalValue, noPrice, green, amber, red };
  }, [filtered]);

  const hasFilters =
    search.trim().length >= 2 || onlyOpen || onlyNoPrice || daysFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setOnlyOpen(false);
    setOnlyNoPrice(false);
    setDaysFilter("all");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <OccurrenceQuickView
        occurrenceId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Pipeline de Ocorrências</h1>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/occurrences">
              <List className="h-4 w-4" />
              Ver tabela
            </Link>
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          <MetricChip label="Total" value={metrics.total} />
          <MetricChip label="Em aberto" value={metrics.open} />
          <MetricChip label="Concluídas" value={metrics.closed} />
          <MetricChip label="Valor total" value={formatCurrency(metrics.totalValue)} />
          <MetricChip
            label="Sem preço"
            value={metrics.noPrice}
            colorClass={metrics.noPrice > 0 ? "text-amber-600" : ""}
          />
          <MetricChip
            label="Verde (0–5d)"
            value={metrics.green}
            colorClass="text-emerald-700"
          />
          <MetricChip
            label="Amarelo (6–8d)"
            value={metrics.amber}
            colorClass="text-amber-600"
          />
          <MetricChip
            label="Vermelho (>8d)"
            value={metrics.red}
            colorClass={metrics.red > 0 ? "text-red-600" : ""}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center p-3 bg-card rounded-lg border">
          <Input
            placeholder="Buscar código, responsável, avaria…"
            className="w-full sm:w-64 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select
            value={daysFilter}
            onValueChange={(v) =>
              setDaysFilter(v as "all" | "green" | "amber" | "red")
            }
          >
            <SelectTrigger className="w-full sm:w-48 h-9">
              <SelectValue placeholder="Faixa de dias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as faixas</SelectItem>
              <SelectItem value="green">Verde — 0 a 5 dias</SelectItem>
              <SelectItem value="amber">Amarelo — 6 a 8 dias</SelectItem>
              <SelectItem value="red">Vermelho — acima de 8 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={onlyOpen ? "secondary" : "outline"}
            size="sm"
            className="h-9 w-full sm:w-auto"
            onClick={() => setOnlyOpen((v) => !v)}
          >
            Somente abertas
          </Button>

          <Button
            variant={onlyNoPrice ? "secondary" : "outline"}
            size="sm"
            className="h-9 w-full sm:w-auto gap-1.5"
            onClick={() => setOnlyNoPrice((v) => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Sem preço
          </Button>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-full sm:w-auto gap-1"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Pipeline columns — horizontal on desktop, stacked on mobile */}
        <div className="flex flex-col md:flex-row md:overflow-x-auto gap-4 pb-4">
          {statuses.map((status) => (
            <PipelineColumn
              key={status.id}
              status={status}
              occurrences={grouped.get(status.id) ?? []}
              onSelectOccurrence={setSelectedId}
            />
          ))}
        </div>

        {/* Closed-limit notice */}
        {hasMoreClosed && (
          <p className="text-xs text-muted-foreground text-center py-1">
            Ocorrências concluídas limitadas às 30 mais recentes nesta visão.{" "}
            <Link
              href="/occurrences?lifecycle=closed"
              className="underline hover:text-foreground transition-colors"
            >
              Ver todas em Ocorrências.
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
