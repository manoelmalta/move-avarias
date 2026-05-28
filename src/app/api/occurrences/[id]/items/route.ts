import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { OccurrenceItemSchema } from "@/lib/validations/occurrence";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { auth } from "@/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  if (!hasPermission(user, "occurrence:edit_items")) {
    return NextResponse.json({ error: "Sem permissão para adicionar produtos à ocorrência" }, { status: 403 });
  }

  const { id } = await params;

  const occurrence = await prisma.damageOccurrence.findUnique({
    where: { id },
    select: { id: true, clientId: true },
  });
  if (!occurrence || occurrence.clientId !== user.clientId) {
    return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });
  }

  const body = await req.json() as unknown;
  const parsed = OccurrenceItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, barcodeInput, quantity, unitValue, totalValue, batch, expirationDate, damageTypeId } = parsed.data;

  // Verify product belongs to same client
  const product = await prisma.product.findFirst({ where: { id: productId, clientId: user.clientId } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  // Verify damage type belongs to same client
  const damageType = await prisma.parameterDamageType.findFirst({ where: { id: damageTypeId, clientId: user.clientId } });
  if (!damageType) return NextResponse.json({ error: "Tipo de avaria não encontrado" }, { status: 404 });

  const item = await prisma.damageOccurrenceItem.create({
    data: {
      clientId: user.clientId,
      occurrenceId: id,
      productId,
      barcodeInput: barcodeInput ?? null,
      quantity,
      unitValue,
      totalValue,
      batch: batch ?? null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      damageTypeId,
    },
    include: { product: true, damageType: true },
  });

  await createAuditLog({
    user,
    entityType: "DamageOccurrenceItem",
    entityId: item.id,
    occurrenceId: id,
    action: "CREATE",
    fieldName: "productId",
    newValue: `${product.internalCode} — qty ${quantity} × ${unitValue}`,
  });

  return NextResponse.json(item, { status: 201 });
}
