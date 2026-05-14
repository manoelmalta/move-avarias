import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OccurrencesFilter } from "@/components/occurrences/occurrences-filter";
import { Plus } from "lucide-react";

function getStatusVariant(
  statusName: string
): "default" | "secondary" | "success" | "warning" | "info" | "destructive" | "purple" {
  if (statusName.includes("5-") || statusName.toLowerCase().includes("finalizado")) return "success";
  if (statusName.includes("4-") || statusName.toLowerCase().includes("destinação finalizada")) return "purple";
  if (statusName.includes("3-") || statusName.toLowerCase().includes("definida")) return "info";
  if (statusName.includes("2-") || statusName.toLowerCase().includes("tratamento")) return "warning";
  return "secondary";
}

async function getOccurrences(clientId: string, searchParams: Record<string, string>) {
  const where: Record<string, unknown> = { clientId };
  if (searchParams.statusId) where.statusId = searchParams.statusId;
  if (searchParams.originId) where.originId = searchParams.originId;
  if (searchParams.destinationId) where.destinationId = searchParams.destinationId;
  if (searchParams.code) where.occurrenceCode = { contains: searchParams.code };
  if (searchParams.dateFrom || searchParams.dateTo) {
    where.createdAt = {};
    if (searchParams.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(searchParams.dateFrom);
    if (searchParams.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(searchParams.dateTo + "T23:59:59");
  }

  return prisma.damageOccurrence.findMany({
    where,
    include: {
      openedBy: { select: { name: true } },
      origin: true,
      status: true,
      destination: true,
      items: { include: { damageType: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getFilterOptions(clientId: string) {
  const [statuses, origins, destinations] = await Promise.all([
    prisma.parameterStatus.findMany({ where: { clientId }, orderBy: { funnelOrder: "asc" } }),
    prisma.parameterOrigin.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDestination.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { statuses, origins, destinations };
}

export default async function OccurrencesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { clientId } = session.user;
  const params = await searchParams;
  const [occurrences, filterOptions] = await Promise.all([
    getOccurrences(clientId, params),
    getFilterOptions(clientId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ocorrências</h1>
        <Button asChild>
          <Link href="/occurrences/new"><Plus className="h-4 w-4" />Nova Ocorrência</Link>
        </Button>
      </div>

      <OccurrencesFilter filterOptions={filterOptions} currentParams={params} />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Tipo de Avaria</TableHead>
              <TableHead>Destinação</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Conclusão</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {occurrences.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma ocorrência encontrada.</TableCell>
              </TableRow>
            )}
            {occurrences.map((occ) => {
              const mainDamageType = occ.items[0]?.damageType.name ?? "-";
              const totalValue = occ.items.reduce((s, i) => s + i.totalValue, 0);
              return (
                <TableRow key={occ.id}>
                  <TableCell className="font-mono text-sm font-medium">{occ.occurrenceCode}</TableCell>
                  <TableCell className="text-sm">{formatDate(occ.createdAt)}</TableCell>
                  <TableCell className="text-sm">{occ.openedBy.name}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(occ.status.name)} className="text-xs whitespace-nowrap">
                      {occ.status.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{occ.origin.name}</TableCell>
                  <TableCell className="text-sm">{mainDamageType}</TableCell>
                  <TableCell className="text-sm">{occ.destination?.name ?? "-"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(totalValue)}</TableCell>
                  <TableCell className="text-sm">{formatDate(occ.completedAt)}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/occurrences/${occ.id}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
