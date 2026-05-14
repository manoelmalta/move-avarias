import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreateProductSchema } from "@/lib/validations/product";
import { createAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/permissions";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

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
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  try { assertPermission(user, "product:manage"); } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json() as { data: unknown };
  const parsed = CreateProductSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.product.findUnique({
    where: { clientId_ean: { clientId: user.clientId, ean: parsed.data.ean } },
  });
  if (existing) return NextResponse.json({ error: "Já existe produto com este EAN" }, { status: 409 });

  const product = await prisma.product.create({
    data: { ...parsed.data, clientId: user.clientId },
  });

  await createAuditLog({ user, entityType: "Product", entityId: product.id, action: "CREATE", newValue: product.description });

  return NextResponse.json(product, { status: 201 });
}
