import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  const [origins, damageTypes, statuses, destinations] = await Promise.all([
    prisma.parameterOrigin.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDamageType.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterStatus.findMany({ where: { clientId, active: true }, orderBy: { funnelOrder: "asc" } }),
    prisma.parameterDestination.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return NextResponse.json({ origins, damageTypes, statuses, destinations });
}
