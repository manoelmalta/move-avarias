import { prisma } from "@/lib/db/client";

export async function getPublicOccurrenceLabelData(token: string) {
  return prisma.damageOccurrence.findUnique({
    where: { publicToken: token },
    select: {
      occurrenceCode: true,
      description: true,
      notes: true,
      createdAt: true,
      origin: { select: { name: true } },
      status: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          product: { select: { description: true, internalCode: true } },
          damageType: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export type PublicOccurrenceLabelData = NonNullable<
  Awaited<ReturnType<typeof getPublicOccurrenceLabelData>>
>;

export function buildPublicOccurrenceUrl(token: string, host: string): string {
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}/public/occurrence/${token}`;
}
