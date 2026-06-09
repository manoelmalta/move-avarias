import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OccurrencesFilter } from "@/components/occurrences/occurrences-filter";
import {
  OccurrencesTable,
  type SerializedOccurrence,
} from "@/components/occurrences/occurrences-table";
import { hasPermission } from "@/lib/permissions";
import { Plus } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

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

  // lifecycle filter — uses status.isFinal as the authoritative open/closed signal.
  // completedAt date ranges filter by actual completion date and are kept on completedAt.
  const lifecycle = searchParams.lifecycle;
  if (lifecycle === "open") {
    where.status = { isFinal: false };
  } else if (lifecycle === "closed") {
    where.status = { isFinal: true };
  }
  if (searchParams.completedFrom || searchParams.completedTo) {
    const completedAt: Record<string, unknown> = {};
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
    andConditions.push({ items: { some: { unitValue: { lte: 0.01 } } } });
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
  const canCreate = hasPermission(user, "occurrence:create");

  // Should never happen given current role matrix, but defensive guard
  if (!canViewAll && !canViewOwn) redirect("/");

  const params = await searchParams;

  const [result, filterOptions] = await Promise.all([
    getOccurrences(user.clientId, user.id, canViewAll, params),
    getFilterOptions(user.clientId, canViewAll),
  ]);

  const { occurrences, total, page, pageSize, totalPages } = result;

  // Serialize Prisma Date objects → ISO strings before passing to Client Component
  const serializedOccurrences: SerializedOccurrence[] = occurrences.map((occ) => ({
    id: occ.id,
    occurrenceCode: occ.occurrenceCode,
    createdAt: occ.createdAt.toISOString(),
    completedAt: occ.completedAt?.toISOString() ?? null,
    openedBy: { name: occ.openedBy.name },
    origin: { name: occ.origin.name },
    status: { id: occ.status.id, name: occ.status.name },
    destination: occ.destination ? { name: occ.destination.name } : null,
    items: occ.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitValue: item.unitValue,
      totalValue: item.totalValue,
      damageType: { id: item.damageType.id, name: item.damageType.name },
    })),
  }));

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ocorrências</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/occurrences/new">
              <Plus className="h-4 w-4" />
              Nova Ocorrência
            </Link>
          </Button>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <OccurrencesFilter
        filterOptions={filterOptions}
        currentParams={params}
        canViewAll={canViewAll}
      />

      {/* ── Table + pagination (Client Component) ──────────────────────── */}
      <OccurrencesTable
        occurrences={serializedOccurrences}
        pagination={{ total, page, pageSize, totalPages }}
        currentParams={params}
      />
    </div>
  );
}
