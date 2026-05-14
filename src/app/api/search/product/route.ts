import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentPrice } from "@/lib/pricing";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  const barcode = req.nextUrl.searchParams.get("barcode");
  if (!barcode) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });

  const product = await prisma.product.findFirst({
    where: {
      clientId,
      active: true,
      OR: [{ ean: barcode }, { dun: barcode }, { internalCode: barcode }],
    },
  });

  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const unitValue = await getCurrentPrice(product.id, clientId);

  return NextResponse.json({ ...product, unitValue });
}
