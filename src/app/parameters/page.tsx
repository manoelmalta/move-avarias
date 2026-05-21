import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OriginsManager } from "@/components/parameters/origins-manager";

async function getParameters(clientId: string) {
  const [origins, damageTypes, statuses, destinations] = await Promise.all([
    prisma.parameterOrigin.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDamageType.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterStatus.findMany({ where: { clientId }, orderBy: { funnelOrder: "asc" } }),
    prisma.parameterDestination.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { origins, damageTypes, statuses, destinations };
}

export default async function ParametersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user, "parameter:manage")) redirect("/occurrences");
  const data = await getParameters(session.user.clientId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Parâmetros do Sistema</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Origens de Avaria</CardTitle></CardHeader>
          <CardContent>
            <OriginsManager origins={data.origins} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tipos de Avaria</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.damageTypes.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span>{d.name}</span>
                <Badge variant={d.active ? "success" : "secondary"}>{d.active ? "Ativo" : "Inativo"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status de Ocorrência</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.statuses.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span>{s.name}</span>
                <div className="flex gap-2">
                  {s.isFinal && <Badge variant="success">Final</Badge>}
                  <Badge variant={s.active ? "info" : "secondary"}>{s.active ? "Ativo" : "Inativo"}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Destinações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data.destinations.map((d) => (
              <div key={d.id} className="space-y-1 pb-3 border-b last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{d.name}</span>
                  <div className="flex gap-1">
                    {d.requiresStorageLocation && <Badge variant="warning">Req. Armazenagem</Badge>}
                    <Badge variant={d.active ? "success" : "secondary"}>{d.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>
                {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
