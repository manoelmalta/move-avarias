import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreatePriceSchema } from "@/lib/validations/product";
import { assertPermission } from "@/lib/permissions";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  const productId = req.nextUrl.searchParams.get("productId");
  const prices = await prisma.productPrice.findMany({
    where: { clientId, ...(productId ? { productId } : {}) },
    include: { product: { select: { internalCode: true, description: true } } },
    orderBy: { validFrom: "desc" },
  });
  return NextResponse.json(prices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  try { assertPermission(user, "price:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json() as { data: unknown };
  const parsed = CreatePriceSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const price = await prisma.productPrice.create({
    data: {
      clientId: user.clientId,
      productId: parsed.data.productId,
      unitValue: parsed.data.unitValue,
      validFrom: new Date(parsed.data.validFrom),
      validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
      sourceNote: parsed.data.sourceNote ?? null,
    },
  });

  return NextResponse.json(price, { status: 201 });
}
