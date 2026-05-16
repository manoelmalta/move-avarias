import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import type { DashboardOccurrence, DashboardParam } from "@/lib/dashboard/types";
import { computeMetrics, applyFilters } from "@/lib/dashboard/metrics";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user, "dashboard:indicators")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { clientId } = session.user;
  const params = req.nextUrl.searchParams;

  const where: Record<string, unknown> = { clientId };
  if (params.get("statusId")) where.statusId = params.get("statusId");
  if (params.get("originId")) where.originId = params.get("originId");
  if (params.get("destinationId")) where.destinationId = params.get("destinationId");
  if (params.get("userId")) where.openedByUserId = params.get("userId");
  if (params.get("dateFrom") || params.get("dateTo")) {
    const createdAt: Record<string, Date> = {};
    if (params.get("dateFrom")) createdAt.gte = new Date(params.get("dateFrom")!);
    if (params.get("dateTo")) createdAt.lte = new Date(params.get("dateTo") + "T23:59:59");
    where.createdAt = createdAt;
  }

  const [rawOccurrences, statuses] = await Promise.all([
    prisma.damageOccurrence.findMany({
      where,
      include: {
        status: true,
        origin: true,
        destination: true,
        openedBy: { select: { id: true, name: true, role: true } },
        items: { include: { damageType: true, product: { select: { id: true, description: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.parameterStatus.findMany({ where: { clientId, active: true }, orderBy: { funnelOrder: "asc" } }),
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

  const damageTypeId = params.get("damageTypeId");
  const filtered = damageTypeId
    ? occurrences.filter((o) => o.items.some((i) => i.damageTypeId === damageTypeId))
    : occurrences;

  const statusParams: DashboardParam[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    order: s.funnelOrder,
    isFinal: s.isFinal,
  }));

  const metrics = computeMetrics(applyFilters(filtered, {
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    statusId: params.get("statusId") ?? "",
    originId: params.get("originId") ?? "",
    damageTypeId: params.get("damageTypeId") ?? "",
    destinationId: params.get("destinationId") ?? "",
    userId: params.get("userId") ?? "",
  }), statusParams);

  return NextResponse.json(metrics);
}
