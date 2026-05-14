import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreateOccurrenceSchema } from "@/lib/validations/occurrence";
import { generateOccurrenceCode } from "@/lib/occurrence-code";
import { createAuditLog } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json([]);

  const where: Record<string, unknown> = { clientId: client.id };
  if (search.get("statusId")) where.statusId = search.get("statusId");
  if (search.get("originId")) where.originId = search.get("originId");
  if (search.get("destinationId")) where.destinationId = search.get("destinationId");
  if (search.get("code")) where.occurrenceCode = { contains: search.get("code") };
  if (search.get("dateFrom") || search.get("dateTo")) {
    where.createdAt = {};
    if (search.get("dateFrom")) (where.createdAt as Record<string, unknown>).gte = new Date(search.get("dateFrom")!);
    if (search.get("dateTo")) (where.createdAt as Record<string, unknown>).lte = new Date(search.get("dateTo") + "T23:59:59");
  }

  const occurrences = await prisma.damageOccurrence.findMany({
    where,
    include: {
      openedBy: { select: { name: true, email: true } },
      origin: true,
      status: true,
      destination: true,
      items: { include: { damageType: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(occurrences);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { user: SessionUser; data: unknown };
  const { user, data } = body;

  const parsed = CreateOccurrenceSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 500 });

  const occurrenceCode = await generateOccurrenceCode(client.id);
  const firstStatus = await prisma.parameterStatus.findFirst({
    where: { clientId: client.id, active: true },
    orderBy: { funnelOrder: "asc" },
  });

  if (!firstStatus) return NextResponse.json({ error: "Status inicial não configurado" }, { status: 500 });

  const occurrence = await prisma.damageOccurrence.create({
    data: {
      clientId: client.id,
      occurrenceCode,
      openedByUserId: user.id,
      originId: parsed.data.originId,
      statusId: firstStatus.id,
      description: parsed.data.description,
      notes: parsed.data.notes ?? null,
      items: {
        create: parsed.data.items.map((item) => ({
          clientId: client.id,
          productId: item.productId,
          barcodeInput: item.barcodeInput ?? null,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: item.totalValue,
          batch: item.batch ?? null,
          expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
          damageTypeId: item.damageTypeId,
        })),
      },
    },
    include: { items: true },
  });

  await createAuditLog({
    user,
    entityType: "DamageOccurrence",
    entityId: occurrence.id,
    occurrenceId: occurrence.id,
    action: "CREATE",
    fieldName: "occurrenceCode",
    newValue: occurrenceCode,
  });

  return NextResponse.json(occurrence, { status: 201 });
}
