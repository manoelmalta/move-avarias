import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json({});

  const [origins, damageTypes, statuses, destinations] = await Promise.all([
    prisma.parameterOrigin.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDamageType.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterStatus.findMany({ where: { clientId: client.id, active: true }, orderBy: { funnelOrder: "asc" } }),
    prisma.parameterDestination.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return NextResponse.json({ origins, damageTypes, statuses, destinations });
}
