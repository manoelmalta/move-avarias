import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { UpdateOccurrenceItemSchema } from "@/lib/validations/occurrence";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { auth } from "@/auth";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

async function resolveItem(occurrenceId: string, itemId: string, clientId: string) {
  const item = await prisma.damageOccurrenceItem.findUnique({
    where: { id: itemId },
    include: {
      occurrence: { select: { clientId: true } },
      product: { select: { internalCode: true } },
    },
  });
  if (!item || item.occurrenceId !== occurrenceId || item.occurrence.clientId !== clientId) {
    return null;
  }
  return item;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  if (!hasPermission(user, "occurrence:edit_items")) {
    return NextResponse.json({ error: "Sem permissão para editar itens da ocorrência" }, { status: 403 });
  }

  const { id, itemId } = await params;
  const item = await resolveItem(id, itemId, user.clientId);
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  const body = await req.json() as unknown;
  const parsed = UpdateOccurrenceItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const newQty = parsed.data.quantity ?? item.quantity;
  const newUnit = parsed.data.unitValue ?? item.unitValue;
  const newTotal = Math.round(newQty * newUnit * 100) / 100;

  const updated = await prisma.damageOccurrenceItem.update({
    where: { id: itemId },
    data: { quantity: newQty, unitValue: newUnit, totalValue: newTotal },
    include: { product: true, damageType: true },
  });

  // Audit each changed field
  const auditEntries: Array<{ field: string; old: string; new: string }> = [];
  if (parsed.data.quantity !== undefined && parsed.data.quantity !== item.quantity) {
    auditEntries.push({ field: "quantity", old: String(item.quantity), new: String(newQty) });
  }
  if (parsed.data.unitValue !== undefined && parsed.data.unitValue !== item.unitValue) {
    auditEntries.push({ field: "unitValue", old: String(item.unitValue), new: String(newUnit) });
  }
  await Promise.all(
    auditEntries.map((e) =>
      createAuditLog({
        user,
        entityType: "DamageOccurrenceItem",
        entityId: itemId,
        occurrenceId: id,
        action: "UPDATE",
        fieldName: `${item.product.internalCode}.${e.field}`,
        oldValue: e.old,
        newValue: e.new,
      })
    )
  );

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  if (!hasPermission(user, "occurrence:edit_items")) {
    return NextResponse.json({ error: "Sem permissão para remover itens da ocorrência" }, { status: 403 });
  }

  const { id, itemId } = await params;
  const item = await resolveItem(id, itemId, user.clientId);
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Protect the last item: occurrence must always have at least one item
  const itemCount = await prisma.damageOccurrenceItem.count({ where: { occurrenceId: id } });
  if (itemCount <= 1) {
    return NextResponse.json(
      { error: "A ocorrência deve ter pelo menos um produto. Para remover todos, utilize a exclusão da ocorrência inteira." },
      { status: 422 }
    );
  }

  await prisma.damageOccurrenceItem.delete({ where: { id: itemId } });

  await createAuditLog({
    user,
    entityType: "DamageOccurrenceItem",
    entityId: itemId,
    occurrenceId: id,
    action: "DELETE",
    fieldName: "productId",
    oldValue: `${item.product.internalCode} — qty ${item.quantity} × ${item.unitValue}`,
  });

  return NextResponse.json({ ok: true });
}
