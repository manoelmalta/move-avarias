import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/client";
import { CreateProductSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/permissions";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  try {
    const products = await prisma.product.findMany({
      where: { clientId },
      orderBy: { internalCode: "asc" },
      include: {
        prices: {
          orderBy: { validFrom: "desc" },
          take: 1,
        },
      },
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Erro ao buscar produtos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  try { assertPermission(user, "product:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let body: { data: unknown };
  try {
    body = await req.json() as { data: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = CreateProductSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Normaliza DUN: string vazia vira null
  const productData = {
    ...parsed.data,
    dun: parsed.data.dun?.trim() || null,
    clientId: user.clientId,
  };

  try {
    // Verifica duplicidade de EAN
    const existingEan = await prisma.product.findUnique({
      where: { clientId_ean: { clientId: user.clientId, ean: productData.ean } },
    });
    if (existingEan) {
      return NextResponse.json({ error: "Já existe produto com este EAN" }, { status: 409 });
    }

    // Verifica duplicidade de código interno
    const existingCode = await prisma.product.findUnique({
      where: { clientId_internalCode: { clientId: user.clientId, internalCode: productData.internalCode } },
    });
    if (existingCode) {
      return NextResponse.json({ error: "Já existe produto com este Código Interno" }, { status: 409 });
    }

    const product = await prisma.product.create({ data: productData });

    await createAuditLog({ user, entityType: "Product", entityId: product.id, action: "CREATE", newValue: product.description });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    // Trata constraint unique do Prisma como último recurso (corrida entre requisições)
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
    console.error("[POST /api/products]", err);
    return NextResponse.json({ error: "Erro interno ao salvar produto" }, { status: 500 });
  }
}
