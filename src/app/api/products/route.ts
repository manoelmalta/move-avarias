import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreateProductSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function GET() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: { clientId: client.id },
    orderBy: { internalCode: "asc" },
    include: {
      prices: {
        orderBy: { validFrom: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { user: SessionUser; data: unknown };
  const { user, data } = body;

  try { assertPermission(user, "product:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = CreateProductSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 500 });

  const existing = await prisma.product.findUnique({
    where: { clientId_ean: { clientId: client.id, ean: parsed.data.ean } },
  });
  if (existing) return NextResponse.json({ error: "Já existe produto com este EAN" }, { status: 409 });

  const product = await prisma.product.create({
    data: { ...parsed.data, clientId: client.id },
  });

  await createAuditLog({ user, entityType: "Product", entityId: product.id, action: "CREATE", newValue: product.description });

  return NextResponse.json(product, { status: 201 });
}
