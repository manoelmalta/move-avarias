import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json({});

  const [occurrences, statuses] = await Promise.all([
    prisma.damageOccurrence.findMany({
      where: { clientId: client.id },
      include: {
        status: true,
        items: { include: { damageType: true } },
        origin: true,
      },
    }),
    prisma.parameterStatus.findMany({ where: { clientId: client.id }, orderBy: { funnelOrder: "asc" } }),
  ]);

  const totalOccurrences = occurrences.length;
  const totalItemsValue = occurrences.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.totalValue, 0), 0);
  const totalItemsCount = occurrences.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  const openStatuses = statuses.filter((s) => !s.isFinal).map((s) => s.id);
  const openOccurrences = occurrences.filter((o) => openStatuses.includes(o.statusId)).length;
  const finalStatus = statuses.find((s) => s.isFinal);
  const closedOccurrences = finalStatus ? occurrences.filter((o) => o.statusId === finalStatus.id).length : 0;
  const inProgressOccurrences = totalOccurrences - openOccurrences - closedOccurrences;

  const byStatus = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    count: occurrences.filter((o) => o.statusId === s.id).length,
  }));

  const damageTypeCount: Record<string, { name: string; count: number }> = {};
  for (const occ of occurrences) {
    for (const item of occ.items) {
      const id = item.damageTypeId;
      if (!damageTypeCount[id]) damageTypeCount[id] = { name: item.damageType.name, count: 0 };
      damageTypeCount[id]!.count += 1;
    }
  }
  const topDamageTypes = Object.values(damageTypeCount).sort((a, b) => b.count - a.count).slice(0, 5);

  const originCount: Record<string, { name: string; count: number }> = {};
  for (const occ of occurrences) {
    const id = occ.originId;
    if (!originCount[id]) originCount[id] = { name: occ.origin.name, count: 0 };
    originCount[id]!.count += 1;
  }
  const topOrigins = Object.values(originCount).sort((a, b) => b.count - a.count).slice(0, 5);

  return NextResponse.json({
    totalOccurrences,
    openOccurrences,
    inProgressOccurrences,
    closedOccurrences,
    totalItemsValue,
    totalItemsCount,
    byStatus,
    topDamageTypes,
    topOrigins,
  });
}
