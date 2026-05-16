import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OccurrencesFilter } from "@/components/occurrences/occurrences-filter";
import { hasPermission } from "@/lib/permissions";
import { Plus, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "purple";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusVariant(statusName: string): BadgeVariant {
  if (statusName.includes("5-") || statusName.toLowerCase().includes("finalizado"))
    return "success";
  if (statusName.includes("4-") || statusName.toLowerCase().includes("destinação finalizada"))
    return "purple";
  if (statusName.includes("3-") || statusName.toLowerCase().includes("definida"))
    return "info";
  if (statusName.includes("2-") || statusName.toLowerCase().includes("tratamento"))
    return "warning";
  return "secondary";
}

/** Build a URL preserving all current search params plus targeted overrides. */
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

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getOccurrences(
  clientId: string,
  userId: string,
  canViewAll: boolean,
  searchParams: Record<string, string>
) {
  const rawPage = parseInt(searchParams.page ?? "1");
  const page = !isNaN(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawPageSize = parseInt(searchParams.pageSize ?? "25");
  const pageSize = (VALID_PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? rawPageSize
    : 25;

  // ── WHERE ──────────────────────────────────────────────────────────────────
  const where: Record<string, unknown> = { clientId };

  // Permission scoping — SEPARADOR (view_own only) always sees only their own.
  // Any openedByUserId in the URL is silently ignored for own-only users.
  if (!canViewAll) {
    where.openedByUserId = userId;
  } else if (searchParams.openedByUserId) {
    where.openedByUserId = searchParams.openedByUserId;
  }

  if (searchParams.statusId) where.statusId = searchParams.statusId;
  if (searchParams.originId) where.originId = searchParams.originId;
  if (searchParams.destinationId) where.destinationId = searchParams.destinationId;
  if (searchParams.code)
    where.occurrenceCode = { contains: searchParams.code };

  // createdAt range
  if (searchParams.dateFrom || searchParams.dateTo) {
    const createdAt: Record<string, unknown> = {};
    if (searchParams.dateFrom) createdAt.gte = new Date(searchParams.dateFrom);
    if (searchParams.dateTo)
      createdAt.lte = new Date(searchParams.dateTo + "T23:59:59");
    where.createdAt = createdAt;
  }

  // lifecycle + completedAt range
  const lifecycle = searchParams.lifecycle;
  if (lifecycle === "open") {
    where.completedAt = null;
  } else if (lifecycle === "closed" || searchParams.completedFrom || searchParams.completedTo) {
    const completedAt: Record<string, unknown> = {};
    if (lifecycle === "closed") completedAt.not = null;
    if (searchParams.completedFrom) completedAt.gte = new Date(searchParams.completedFrom);
    if (searchParams.completedTo)
      completedAt.lte = new Date(searchParams.completedTo + "T23:59:59");
    where.completedAt = completedAt;
  }

  // Items sub-filters (AND allows conditions to match different items)
  const andConditions: unknown[] = [];
  if (searchParams.damageTypeId) {
    andConditions.push({
      items: { some: { damageTypeId: searchParams.damageTypeId } },
    });
  }
  if (searchParams.noPrice === "true") {
    andConditions.push({ items: { some: { unitValue: 0 } } });
  }
  if (andConditions.length > 0) where.AND = andConditions;

  const [occurrences, total] = await Promise.all([
    prisma.damageOccurrence.findMany({
      where,
      include: {
        openedBy: { select: { name: true } },
        origin: true,
        status: true,
        destination: true,
        items: { include: { damageType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.damageOccurrence.count({ where }),
  ]);

  return {
    occurrences,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function getFilterOptions(clientId: string, canViewAll: boolean) {
  const [statuses, origins, destinations, damageTypes] = await Promise.all([
    prisma.parameterStatus.findMany({
      where: { clientId },
      orderBy: { funnelOrder: "asc" },
    }),
    prisma.parameterOrigin.findMany({
      where: { clientId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.parameterDestination.findMany({
      where: { clientId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.parameterDamageType.findMany({
      where: { clientId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Users for the "Responsável" filter — only loaded for roles that can see all
  const users = canViewAll
    ? await prisma.user.findMany({
        where: { clientId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return { statuses, origins, destinations, damageTypes, users };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OccurrencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { user } = session;
  const canViewAll = hasPermission(user, "occurrence:view_all");
  const canViewOwn = hasPermission(user, "occurrence:view_own");

  // Should never happen given current role matrix, but defensive guard
  if (!canViewAll && !canViewOwn) redirect("/");

  const params = await searchParams;

  const [result, filterOptions] = await Promise.all([
    getOccurrences(user.clientId, user.id, canViewAll, params),
    getFilterOptions(user.clientId, canViewAll),
  ]);

  const { occurrences, total, page, pageSize, totalPages } = result;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ocorrências</h1>
        <Button asChild>
          <Link href="/occurrences/new">
            <Plus className="h-4 w-4" />
            Nova Ocorrência
          </Link>
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <OccurrencesFilter
        filterOptions={filterOptions}
        currentParams={params}
        canViewAll={canViewAll}
      />

      {/* ── Table card ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card overflow-x-auto">
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
              const hasZeroPrice = occ.items.some((i) => i.unitValue === 0);

              // Distinct damage types across all items
              const damageTypes = [
                ...new Map(
                  occ.items.map((i) => [i.damageType.id, i.damageType.name])
                ).entries(),
              ].map(([id, name]) => ({ id, name }));

              return (
                <TableRow key={occ.id}>
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

                  {/* Ações */}
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/occurrences/${occ.id}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* ── Pagination bar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-sm">
          {/* Count */}
          <span className="text-muted-foreground">
            {total === 0
              ? "Nenhuma ocorrência"
              : `${rangeStart}–${rangeEnd} de ${total} ocorrência${total !== 1 ? "s" : ""}`}
          </span>

          <div className="flex items-center gap-4">
            {/* Page size picker */}
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <span>Por página:</span>
              {VALID_PAGE_SIZES.map((size) => (
                <Link
                  key={size}
                  href={buildPageUrl(params, {
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
                <Link href={buildPageUrl(params, { page: String(page - 1) })}>
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
                Página {page} de {totalPages}
              </span>

              {page < totalPages ? (
                <Link href={buildPageUrl(params, { page: String(page + 1) })}>
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
      </div>
    </div>
  );
}
