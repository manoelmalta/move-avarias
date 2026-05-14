import { prisma } from "@/lib/db/client";

export async function generateOccurrenceCode(clientId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AVR-${year}-`;

  const last = await prisma.damageOccurrence.findFirst({
    where: { clientId, occurrenceCode: { startsWith: prefix } },
    orderBy: { occurrenceCode: "desc" },
  });

  let seq = 1;
  if (last) {
    const parts = last.occurrenceCode.split("-");
    seq = parseInt(parts[2] ?? "0", 10) + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}
