import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ClosingReportView } from "@/components/closing-report/closing-report-view";
import type { ClosingReportOccurrence, ClosingReportParam } from "@/lib/closing-report/types";

async function getClosingReportData(clientId: string) {
  const [rawOccurrences, statuses, origins, damageTypes, destinations, users] =
    await Promise.all([
      prisma.damageOccurrence.findMany({
        where: { clientId },
        include: {
          status: { select: { id: true, isFinal: true } },
          items: {
            include: {
              product: {
                select: { id: true, internalCode: true, description: true },
              },
              damageType: { select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.parameterStatus.findMany({
        where: { clientId, active: true },
        orderBy: { funnelOrder: "asc" },
      }),
      prisma.parameterOrigin.findMany({
        where: { clientId, active: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.parameterDamageType.findMany({
        where: { clientId, active: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.parameterDestination.findMany({
        where: { clientId, active: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.user.findMany({
        where: { clientId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const occurrences: ClosingReportOccurrence[] = rawOccurrences.map((o) => ({
    id: o.id,
    occurrenceCode: o.occurrenceCode,
    createdAtIso: o.createdAt.toISOString(),
    completedAtIso: o.completedAt?.toISOString() ?? null,
    statusId: o.statusId,
    statusIsFinal: o.status.isFinal,
    originId: o.originId,
    destinationId: o.destinationId,
    openedByUserId: o.openedByUserId,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productInternalCode: i.product.internalCode,
      productDescription: i.product.description,
      damageTypeId: i.damageTypeId,
      quantity: i.quantity,
      totalValue: i.totalValue,
    })),
  }));

  const statusParams: ClosingReportParam[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    isFinal: s.isFinal,
  }));
  const originParams: ClosingReportParam[] = origins.map((o) => ({ id: o.id, name: o.name }));
  const damageTypeParams: ClosingReportParam[] = damageTypes.map((d) => ({ id: d.id, name: d.name }));
  const destinationParams: ClosingReportParam[] = destinations.map((d) => ({ id: d.id, name: d.name }));
  const userParams = users.map((u) => ({ id: u.id, name: u.name }));

  return { occurrences, statusParams, originParams, damageTypeParams, destinationParams, userParams };
}

export default async function ClosingReportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasPermission(session.user, "dashboard:indicators")) {
    redirect("/occurrences");
  }

  const data = await getClosingReportData(session.user.clientId);

  return (
    <div className="max-w-7xl mx-auto">
      <ClosingReportView
        occurrences={data.occurrences}
        statusParams={data.statusParams}
        originParams={data.originParams}
        damageTypeParams={data.damageTypeParams}
        destinationParams={data.destinationParams}
        userParams={data.userParams}
      />
    </div>
  );
}
