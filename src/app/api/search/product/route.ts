import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentPrice } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get("barcode");
  const clientSlug = "cliente-demo";

  if (!barcode) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });

  const client = await prisma.client.findFirst({ where: { slug: clientSlug } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const product = await prisma.product.findFirst({
    where: {
      clientId: client.id,
      active: true,
      OR: [{ ean: barcode }, { dun: barcode }, { internalCode: barcode }],
    },
  });

  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const unitValue = await getCurrentPrice(product.id, client.id);

  return NextResponse.json({ ...product, unitValue });
}
