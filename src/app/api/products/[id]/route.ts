import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/client";
import { UpdateProductSchema } from "@/lib/validations/product";
import { auditFieldChanges } from "@/lib/audit";
import { assertPermission } from "@/lib/permissions";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  const { id } = await params;

  let body: { data: unknown };
  try {
    body = await req.json() as { data: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  try { assertPermission(user, "product:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = UpdateProductSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Normaliza DUN: string vazia vira null
  const updateData = {
    ...parsed.data,
    ...(parsed.data.dun !== undefined ? { dun: parsed.data.dun?.trim() || null } : {}),
  };

  try {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    if (existing.clientId !== user.clientId) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const updated = await prisma.product.update({ where: { id }, data: updateData });

    const changesForAudit: Record<string, { old: unknown; new: unknown }> = {};
    for (const [key, newVal] of Object.entries(updateData)) {
      const oldVal = (existing as Record<string, unknown>)[key];
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        changesForAudit[key] = { old: oldVal, new: newVal };
      }
    }
    if (Object.keys(changesForAudit).length > 0) {
      await auditFieldChanges(user, "Product", id, changesForAudit);
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[]) ?? [];
      if (fields.includes("ean")) {
        return NextResponse.json({ error: "Já existe produto com este EAN" }, { status: 409 });
      }
      if (fields.includes("internalCode")) {
        return NextResponse.json({ error: "Já existe produto com este Código Interno" }, { status: 409 });
      }
      return NextResponse.json({ error: "Dado duplicado — verifique EAN e Código Interno" }, { status: 409 });
    }
    console.error("[PATCH /api/products/:id]", err);
    return NextResponse.json({ error: "Erro interno ao atualizar produto" }, { status: 500 });
  }
}
