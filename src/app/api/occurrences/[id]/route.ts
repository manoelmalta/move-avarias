import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { UpdateOccurrenceSchema } from "@/lib/validations/occurrence";
import { auditFieldChanges, createAuditLog } from "@/lib/audit";
import { hasPermission, assertPermission } from "@/lib/permissions";
import { auth } from "@/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = session;
  const canViewAll = hasPermission(user, "occurrence:view_all");
  const canViewOwn = hasPermission(user, "occurrence:view_own");

  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const occurrence = await prisma.damageOccurrence.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true, email: true, role: true } },
      origin: true,
      status: true,
      destination: true,
      items: {
        include: {
          product: true,
          damageType: true,
        },
      },
      auditLogs: {
        include: { user: { select: { name: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Return 404 for both "not found" and "wrong client" to avoid leaking existence
  if (!occurrence || occurrence.clientId !== user.clientId) {
    return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });
  }
  // SEPARADOR (view_own only) may only access their own occurrences
  if (!canViewAll && occurrence.openedByUserId !== user.id) {
    return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });
  }

  return NextResponse.json(occurrence);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  if (!hasPermission(user, "occurrence:delete")) {
    return NextResponse.json({ error: "Sem permissão para apagar ocorrências" }, { status: 403 });
  }

  const { id } = await params;
  const occurrence = await prisma.damageOccurrence.findUnique({
    where: { id },
    select: { id: true, clientId: true, occurrenceCode: true },
  });
  if (!occurrence || occurrence.clientId !== user.clientId) {
    return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });
  }

  // Delete in transaction: audit logs → items → occurrence
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { occurrenceId: id } }),
    prisma.damageOccurrenceItem.deleteMany({ where: { occurrenceId: id } }),
    prisma.damageOccurrence.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true, deleted: occurrence.occurrenceCode });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  const { id } = await params;
  const body = await req.json() as { data: unknown; complete?: boolean };
  const { data, complete } = body;

  const parsed = UpdateOccurrenceSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.damageOccurrence.findUnique({
    where: { id },
    include: { status: true, destination: true, items: true },
  });
  if (!existing) return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });
  if (existing.clientId !== user.clientId) return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });

  // edit operations require view_all — isOwner alone does not grant edit access
  if (!hasPermission(user, "occurrence:view_all")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (parsed.data.notes !== undefined && !hasPermission(user, "occurrence:edit_description")) {
    return NextResponse.json({ error: "Sem permissão para editar observações" }, { status: 403 });
  }
  if (parsed.data.statusId && !hasPermission(user, "occurrence:edit_status")) {
    return NextResponse.json({ error: "Sem permissão para alterar status" }, { status: 403 });
  }
  if (parsed.data.destinationId !== undefined && !hasPermission(user, "occurrence:edit_destination")) {
    return NextResponse.json({ error: "Sem permissão para alterar destinação" }, { status: 403 });
  }

  if (complete) {
    try { assertPermission(user, "occurrence:complete"); } catch {
      return NextResponse.json({ error: "Sem permissão para concluir ocorrência" }, { status: 403 });
    }

    if (existing.items.length === 0) {
      return NextResponse.json({ error: "A ocorrência precisa ter pelo menos um produto para ser concluída" }, { status: 400 });
    }

    const destinationId = parsed.data.destinationId ?? existing.destinationId;
    if (!destinationId) {
      return NextResponse.json({ error: "Destinação obrigatória para concluir a ocorrência" }, { status: 400 });
    }

    const destination = await prisma.parameterDestination.findUnique({ where: { id: destinationId } });
    if (destination?.requiresStorageLocation) {
      const storageLocation = parsed.data.storageLocation ?? existing.storageLocation;
      if (!storageLocation) {
        return NextResponse.json({ error: "Local de armazenagem obrigatório para esta destinação" }, { status: 400 });
      }
    }
  }

  const finalStatus = complete
    ? await prisma.parameterStatus.findFirst({
        where: { clientId: existing.clientId, isFinal: true },
        orderBy: { funnelOrder: "desc" },
      })
    : null;

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (complete && finalStatus) {
    updateData.statusId = finalStatus.id;
    updateData.completedAt = new Date();
  }

  const updatedOccurrence = await prisma.damageOccurrence.update({
    where: { id },
    data: updateData,
  });

  const changesForAudit: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, newVal] of Object.entries(updateData)) {
    const oldVal = (existing as Record<string, unknown>)[key];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changesForAudit[key] = { old: oldVal, new: newVal };
    }
  }
  if (Object.keys(changesForAudit).length > 0) {
    await auditFieldChanges(user, "DamageOccurrence", id, changesForAudit, id);
  }

  if (complete) {
    await createAuditLog({
      user,
      entityType: "DamageOccurrence",
      entityId: id,
      occurrenceId: id,
      action: "COMPLETE",
      fieldName: "completedAt",
      newValue: new Date().toISOString(),
    });
  }

  return NextResponse.json(updatedOccurrence);
}
