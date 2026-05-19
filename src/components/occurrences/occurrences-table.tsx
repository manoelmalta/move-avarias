"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OccurrenceQuickView } from "@/components/occurrences/occurrence-quick-view";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SerializedOccurrence {
  id: string;
  occurrenceCode: string;
  createdAt: string;
  completedAt: string | null;
  openedBy: { name: string };
  origin: { name: string };
  status: { id: string; name: string };
  destination: { name: string } | null;
  items: {
    id: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
    damageType: { id: string; name: string };
  }[];
}

interface OccurrencesTableProps {
  occurrences: SerializedOccurrence[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentParams: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function buildPageUrl(
  currentParams: Record<string, string>,
  updates: Record<string, string>
): string {
  const params = new URLSearchParams(currentParams);
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `/occurrences?${params.toString()}`;
}

const VALID_PAGE_SIZES = [25, 50, 100] as const;

// ── Pagination bar (shared between mobile and desktop) ───────────────────────

function PaginationBar({
  pagination,
  currentParams,
}: {
  pagination: OccurrencesTableProps["pagination"];
  currentParams: Record<string, string>;
}) {
  const { total, page, pageSize, totalPages } = pagination;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-sm bg-card">
      {/* Count */}
      <span className="text-muted-foreground text-xs">
        {total === 0
          ? "Nenhuma ocorrência"
          : `${rangeStart}–${rangeEnd} de ${total} ocorrência${total !== 1 ? "s" : ""}`}
      </span>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Page size picker */}
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <span>Por página:</span>
          {VALID_PAGE_SIZES.map((size) => (
            <Link
              key={size}
              href={buildPageUrl(currentParams, {
                pageSize: String(size),
                page: "1",
              })}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                pageSize === size
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              {size}
            </Link>
          ))}
        </div>

        {/* Prev / page indicator / Next */}
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={buildPageUrl(currentParams, { page: String(page - 1) })}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
          )}

          <span className="px-3 text-muted-foreground text-xs whitespace-nowrap">
            {page} / {totalPages}
          </span>

          {page < totalPages ? (
            <Link href={buildPageUrl(currentParams, { page: String(page + 1) })}>
              <Button variant="outline" size="sm">
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OccurrencesTable({
  occurrences,
  pagination,
  currentParams,
}: OccurrencesTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {/* Quick-view drawer — rendered outside the table so it doesn't interfere */}
      <OccurrenceQuickView
        occurrenceId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />

      {/* ── Mobile card list — hidden on md+ ────────────────────────── */}
      <div className="md:hidden space-y-2">
        {occurrences.length === 0 ? (
          <div className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground">
            Nenhuma ocorrência encontrada.
          </div>
        ) : (
          occurrences.map((occ) => {
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
                key={occ.id}
                className="rounded-lg border bg-card p-4 cursor-pointer active:bg-muted/30 transition-colors"
                onClick={() => setSelectedId(occ.id)}
              >
                {/* Header: code + status + zero-price warning */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-mono text-sm font-semibold">
                      {occ.occurrenceCode}
                    </span>
                    <Badge
                      variant={getStatusVariant(occ.status.name)}
                      className="text-xs"
                    >
                      {occ.status.name}
                    </Badge>
                    {hasZeroPrice && (
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-amber-500"
                        aria-label="Contém item sem preço"
                      />
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(occ.id);
                    }}
                  >
                    Ver
                  </Button>
                </div>

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{formatDate(occ.createdAt)}</span>
                  <span>Origem: {occ.origin.name}</span>
                  {occ.destination && <span>Destino: {occ.destination.name}</span>}
                  <span>{occ.openedBy.name}</span>
                </div>

                {/* Footer: damage types + totals */}
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {damageTypes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      damageTypes.map((dt) => (
                        <Badge key={dt.id} variant="secondary" className="text-xs">
                          {dt.name}
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(totalValue)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {totalQty}x
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="rounded-lg border overflow-hidden">
          <PaginationBar pagination={pagination} currentParams={currentParams} />
        </div>
      </div>

      {/* ── Desktop table — hidden on mobile ────────────────────────── */}
      <div className="hidden md:block rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Código</TableHead>
              <TableHead className="whitespace-nowrap">Abertura</TableHead>
              <TableHead className="whitespace-nowrap">Encerramento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Avarias</TableHead>
              <TableHead className="text-right whitespace-nowrap">Qtd</TableHead>
              <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
              <TableHead className="text-center w-8" title="Item sem preço">
                <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {occurrences.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="text-center text-muted-foreground py-10"
                >
                  Nenhuma ocorrência encontrada.
                </TableCell>
              </TableRow>
            )}
            {occurrences.map((occ) => {
              const totalValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
              const totalQty = occ.items.reduce((s, i) => s + i.quantity, 0);
              const hasZeroPrice = occ.items.some((i) => i.unitValue <= 0.01);
              const damageTypes = [
                ...new Map(
                  occ.items.map((i) => [i.damageType.id, i.damageType.name])
                ).entries(),
              ].map(([id, name]) => ({ id, name }));

              return (
                <TableRow
                  key={occ.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(occ.id)}
                >
                  {/* Código */}
                  <TableCell className="font-mono text-sm font-medium whitespace-nowrap">
                    {occ.occurrenceCode}
                  </TableCell>

                  {/* Abertura */}
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(occ.createdAt)}
                  </TableCell>

                  {/* Encerramento */}
                  <TableCell className="text-sm whitespace-nowrap">
                    {occ.completedAt ? (
                      formatDate(occ.completedAt)
                    ) : (
                      <span className="text-muted-foreground text-xs">Em aberto</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={getStatusVariant(occ.status.name)}
                      className="text-xs whitespace-nowrap"
                    >
                      {occ.status.name}
                    </Badge>
                  </TableCell>

                  {/* Origem */}
                  <TableCell className="text-sm whitespace-nowrap">
                    {occ.origin.name}
                  </TableCell>

                  {/* Destino */}
                  <TableCell className="text-sm whitespace-nowrap">
                    {occ.destination?.name ?? (
                      <span className="text-muted-foreground text-xs">Sem destino</span>
                    )}
                  </TableCell>

                  {/* Responsável */}
                  <TableCell className="text-sm whitespace-nowrap">
                    {occ.openedBy.name}
                  </TableCell>

                  {/* Avarias — all distinct types */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {damageTypes.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        damageTypes.map((dt) => (
                          <Badge key={dt.id} variant="secondary" className="text-xs">
                            {dt.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>

                  {/* Qtd */}
                  <TableCell className="text-right text-sm tabular-nums">
                    {totalQty}
                  </TableCell>

                  {/* Valor */}
                  <TableCell className="text-right text-sm font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(totalValue)}
                  </TableCell>

                  {/* Sem preço */}
                  <TableCell className="text-center">
                    {hasZeroPrice && (
                      <AlertTriangle
                        className="h-4 w-4 text-amber-500 mx-auto"
                        aria-label="Contém item sem preço"
                      />
                    )}
                  </TableCell>

                  {/* Ações — stopPropagation so row click doesn't double-fire */}
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedId(occ.id)}
                    >
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <PaginationBar pagination={pagination} currentParams={currentParams} />
      </div>
    </>
  );
}
