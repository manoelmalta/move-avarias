import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { DashboardOccurrence, DashboardParam } from "@/lib/dashboard/types";

async function getDashboardData(clientId: string) {
  const [rawOccurrences, statuses, origins, damageTypes, destinations, users] = await Promise.all([
    prisma.damageOccurrence.findMany({
      where: { clientId },
      include: {
        status: true,
        origin: true,
        destination: true,
        openedBy: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            damageType: true,
            product: { select: { id: true, description: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.parameterStatus.findMany({ where: { clientId, active: true }, orderBy: { funnelOrder: "asc" } }),
    prisma.parameterOrigin.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDamageType.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDestination.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({
      where: { clientId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const occurrences: DashboardOccurrence[] = rawOccurrences.map((o) => ({
    id: o.id,
    occurrenceCode: o.occurrenceCode,
    createdAtIso: o.createdAt.toISOString(),
    completedAtIso: o.completedAt?.toISOString() ?? null,
    statusId: o.statusId,
    statusName: o.status.name,
    statusIsFinal: o.status.isFinal,
    statusFunnelOrder: o.status.funnelOrder,
    originId: o.originId,
    originName: o.origin.name,
    destinationId: o.destinationId,
    destinationName: o.destination?.name ?? null,
    openedByUserId: o.openedByUserId,
    openedByName: o.openedBy.name,
    openedByRole: o.openedBy.role,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productDescription: i.product.description,
      damageTypeId: i.damageTypeId,
      damageTypeName: i.damageType.name,
      quantity: i.quantity,
      unitValue: i.unitValue,
      totalValue: i.totalValue,
    })),
  }));

  const statusParams: DashboardParam[] = statuses.map((s) => ({ id: s.id, name: s.name, order: s.funnelOrder, isFinal: s.isFinal }));
  const originParams: DashboardParam[] = origins.map((o) => ({ id: o.id, name: o.name }));
  const damageTypeParams: DashboardParam[] = damageTypes.map((d) => ({ id: d.id, name: d.name }));
  const destinationParams: DashboardParam[] = destinations.map((d) => ({ id: d.id, name: d.name }));
  const userParams: DashboardParam[] = users.map((u) => ({ id: u.id, name: u.name }));

  return { occurrences, statusParams, originParams, damageTypeParams, destinationParams, userParams };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasPermission(session.user, "dashboard:indicators")) {
    redirect("/occurrences");
  }

  const data = await getDashboardData(session.user.clientId);

  return (
    <DashboardView
      occurrences={data.occurrences}
      statusParams={data.statusParams}
      originParams={data.originParams}
      damageTypeParams={data.damageTypeParams}
      destinationParams={data.destinationParams}
      userParams={data.userParams}
      userRole={session.user.role}
    />
  );
}
