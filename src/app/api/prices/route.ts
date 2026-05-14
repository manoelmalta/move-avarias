import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreatePriceSchema } from "@/lib/validations/product";
import { assertPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json([]);

  const prices = await prisma.productPrice.findMany({
    where: { clientId: client.id, ...(productId ? { productId } : {}) },
    include: { product: { select: { internalCode: true, description: true } } },
    orderBy: { validFrom: "desc" },
  });
  return NextResponse.json(prices);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { user: SessionUser; data: unknown };
  const { user, data } = body;

  try { assertPermission(user, "price:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = CreatePriceSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 500 });

  const price = await prisma.productPrice.create({
    data: {
      clientId: client.id,
      productId: parsed.data.productId,
      unitValue: parsed.data.unitValue,
      validFrom: new Date(parsed.data.validFrom),
      validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
      sourceNote: parsed.data.sourceNote ?? null,
    },
  });

  return NextResponse.json(price, { status: 201 });
}
