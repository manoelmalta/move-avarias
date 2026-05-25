import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/client";
import { CreatePriceSchema } from "@/lib/validations/product";
import { assertPermission } from "@/lib/permissions";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  const productId = req.nextUrl.searchParams.get("productId");

  try {
    const prices = await prisma.productPrice.findMany({
      where: { clientId, ...(productId ? { productId } : {}) },
      include: { product: { select: { internalCode: true, description: true, ean: true, dun: true } } },
      orderBy: { validFrom: "desc" },
    });
    return NextResponse.json(prices);
  } catch (err) {
    console.error("[GET /api/prices]", err);
    return NextResponse.json({ error: "Erro ao buscar preços" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  try { assertPermission(user, "price:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let body: { data: unknown };
  try {
    body = await req.json() as { data: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = CreatePriceSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const price = await prisma.productPrice.create({
      data: {
        clientId: user.clientId,
        productId: parsed.data.productId,
        unitValue: parsed.data.unitValue,
        validFrom: new Date(parsed.data.validFrom),
        validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
        sourceNote: parsed.data.sourceNote?.trim() || null,
      },
    });

    return NextResponse.json(price, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe um preço cadastrado para este produto nesta data de início de vigência" },
        { status: 409 }
      );
    }
    console.error("[POST /api/prices]", err);
    return NextResponse.json({ error: "Erro interno ao salvar preço" }, { status: 500 });
  }
}
