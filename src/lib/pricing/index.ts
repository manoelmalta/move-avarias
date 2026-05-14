import { prisma } from "@/lib/db/client";

export async function getCurrentPrice(
  productId: string,
  clientId: string,
  referenceDate: Date = new Date()
): Promise<number | null> {
  const price = await prisma.productPrice.findFirst({
    where: {
      productId,
      clientId,
      validFrom: { lte: referenceDate },
      OR: [{ validTo: null }, { validTo: { gte: referenceDate } }],
    },
    orderBy: { validFrom: "desc" },
  });
  return price?.unitValue ?? null;
}
