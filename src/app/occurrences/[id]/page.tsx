import { prisma } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { OccurrenceDetail } from "@/components/occurrences/occurrence-detail";

async function getOccurrence(id: string) {
  return prisma.damageOccurrence.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true, email: true, role: true } },
      origin: true,
      status: true,
      destination: true,
      items: { include: { product: true, damageType: true } },
      auditLogs: {
        include: { user: { select: { name: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

async function getParameters(clientId: string) {
  const [statuses, destinations] = await Promise.all([
    prisma.parameterStatus.findMany({ where: { clientId, active: true }, orderBy: { funnelOrder: "asc" } }),
    prisma.parameterDestination.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { statuses, destinations };
}

export default async function OccurrenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const occurrence = await getOccurrence(id);
  if (!occurrence) notFound();

  const parameters = await getParameters(occurrence.clientId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <OccurrenceDetail occurrence={occurrence} statuses={parameters.statuses} destinations={parameters.destinations} />
    </div>
  );
}
