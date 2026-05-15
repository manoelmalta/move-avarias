import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const rows = await prisma.product.findMany({
    where: {
      clientId,
      active: true,
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { internalCode: { contains: q, mode: "insensitive" } },
        { ean: { contains: q, mode: "insensitive" } },
        { dun: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, internalCode: true, description: true, ean: true, dun: true },
    take: 20,
  });

  // Exact-match priority: exact code hits rise to the top
  const qLower = q.toLowerCase();
  rows.sort((a, b) => {
    const scoreA =
      a.internalCode.toLowerCase() === qLower ? 0 :
      a.ean.toLowerCase() === qLower ? 1 :
      (a.dun?.toLowerCase() === qLower ? 2 : 3);
    const scoreB =
      b.internalCode.toLowerCase() === qLower ? 0 :
      b.ean.toLowerCase() === qLower ? 1 :
      (b.dun?.toLowerCase() === qLower ? 2 : 3);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.description.localeCompare(b.description, "pt-BR");
  });

  const top8 = rows.slice(0, 8);

  // Batch price lookup — one query for all returned products
  const now = new Date();
  const prices = await prisma.productPrice.findMany({
    where: {
      clientId,
      productId: { in: top8.map((p) => p.id) },
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { validFrom: "desc" },
    select: { productId: true, unitValue: true },
  });

  const priceMap = new Map<string, number>();
  for (const price of prices) {
    if (!priceMap.has(price.productId)) priceMap.set(price.productId, price.unitValue);
  }

  return NextResponse.json(
    top8.map((p) => ({
      id: p.id,
      internalCode: p.internalCode,
      description: p.description,
      ean: p.ean,
      dun: p.dun,
      unitValue: priceMap.get(p.id) ?? null,
    }))
  );
}
