import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import {
  OccurrencesPipeline,
  type SerializedPipelineOccurrence,
  type SerializedPipelineStatus,
} from "@/components/occurrences/occurrences-pipeline";

// Max closed occurrences shown in the pipeline to avoid overloading the view.
// Open occurrences are always fully loaded.
const CLOSED_LIMIT = 30;

// ── Shared select shape for DamageOccurrence ──────────────────────────────────

const occurrenceSelect = {
  id: true,
  occurrenceCode: true,
  createdAt: true,
  completedAt: true,
  openedBy: { select: { id: true, name: true } },
  origin: { select: { name: true } },
  status: {
    select: { id: true, name: true, funnelOrder: true, isFinal: true },
  },
  destination: { select: { name: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      unitValue: true,
      totalValue: true,
      damageType: { select: { id: true, name: true } },
    },
  },
} as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { user } = session;
  const canViewAll = hasPermission(user, "occurrence:view_all");
  const canViewOwn = hasPermission(user, "occurrence:view_own");

  // Defensive: should always have at least view_own given the role matrix,
  // but redirect to root if somehow neither permission is present.
  if (!canViewAll && !canViewOwn) redirect("/");

  // Base scope: SEPARADOR sees only own, all others see the entire client.
  const scopeWhere = canViewAll
    ? { clientId: user.clientId }
    : { clientId: user.clientId, openedByUserId: user.id };

  const [statuses, openOccurrences, closedOccurrences, closedTotal] =
    await Promise.all([
      // All active statuses ordered by funnel position
      prisma.parameterStatus.findMany({
        where: { clientId: user.clientId, active: true },
        orderBy: [{ funnelOrder: "asc" }, { name: "asc" }],
      }),
      // All open occurrences (no completedAt) — fully loaded, sorted by age asc
      // (client will re-sort by daysOpen desc within each column)
      prisma.damageOccurrence.findMany({
        where: { ...scopeWhere, completedAt: null },
        select: occurrenceSelect,
        orderBy: { createdAt: "asc" },
      }),
      // Closed occurrences — limited to CLOSED_LIMIT most recent
      prisma.damageOccurrence.findMany({
        where: { ...scopeWhere, completedAt: { not: null } },
        select: occurrenceSelect,
        orderBy: { completedAt: "desc" },
        take: CLOSED_LIMIT,
      }),
      // Count total closed to detect whether limit was hit
      prisma.damageOccurrence.count({
        where: { ...scopeWhere, completedAt: { not: null } },
      }),
    ]);

  // ── Serialize Prisma Date objects → ISO strings ───────────────────────────

  const allOccurrences: SerializedPipelineOccurrence[] = [
    ...openOccurrences,
    ...closedOccurrences,
  ].map((occ) => ({
    id: occ.id,
    occurrenceCode: occ.occurrenceCode,
    createdAt: occ.createdAt.toISOString(),
    completedAt: occ.completedAt?.toISOString() ?? null,
    openedBy: { id: occ.openedBy.id, name: occ.openedBy.name },
    origin: { name: occ.origin.name },
    status: {
      id: occ.status.id,
      name: occ.status.name,
      funnelOrder: occ.status.funnelOrder,
      isFinal: occ.status.isFinal,
    },
    destination: occ.destination ? { name: occ.destination.name } : null,
    items: occ.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitValue: item.unitValue,
      totalValue: item.totalValue,
      damageType: { id: item.damageType.id, name: item.damageType.name },
    })),
  }));

  const serializedStatuses: SerializedPipelineStatus[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    funnelOrder: s.funnelOrder,
    isFinal: s.isFinal,
  }));

  return (
    <OccurrencesPipeline
      occurrences={allOccurrences}
      statuses={serializedStatuses}
      hasMoreClosed={closedTotal > CLOSED_LIMIT}
    />
  );
}
