import { NextRequest, NextResponse } from "next/server";
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
  const body = await req.json() as { data: unknown };

  try { assertPermission(user, "product:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = UpdateProductSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  if (existing.clientId !== user.clientId) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const updated = await prisma.product.update({ where: { id }, data: parsed.data });

  const changesForAudit: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, newVal] of Object.entries(parsed.data)) {
    const oldVal = (existing as Record<string, unknown>)[key];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changesForAudit[key] = { old: oldVal, new: newVal };
    }
  }
  if (Object.keys(changesForAudit).length > 0) {
    await auditFieldChanges(user, "Product", id, changesForAudit);
  }

  return NextResponse.json(updated);
}
