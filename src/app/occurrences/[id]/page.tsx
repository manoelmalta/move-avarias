import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { OccurrenceDetail } from "@/components/occurrences/occurrence-detail";
import { hasPermission } from "@/lib/permissions";

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
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const occurrence = await getOccurrence(id);

  // Return 404 for both "not found" and "wrong client" to avoid leaking existence
  if (!occurrence || occurrence.clientId !== session.user.clientId) notFound();

  const canViewAll = hasPermission(session.user, "occurrence:view_all");
  // SEPARADOR (view_own only) may only access their own occurrences
  if (!canViewAll && occurrence.openedByUserId !== session.user.id) notFound();

  const parameters = await getParameters(occurrence.clientId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <OccurrenceDetail occurrence={occurrence} statuses={parameters.statuses} destinations={parameters.destinations} />
    </div>
  );
}
