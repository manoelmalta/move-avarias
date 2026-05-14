import { prisma } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ClipboardList, AlertCircle, CheckCircle, Clock, Package, TrendingUp } from "lucide-react";

async function getDashboardData() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return null;

  const [occurrences, statuses] = await Promise.all([
    prisma.damageOccurrence.findMany({
      where: { clientId: client.id },
      include: {
        status: true,
        items: { include: { damageType: true } },
        origin: true,
      },
    }),
    prisma.parameterStatus.findMany({ where: { clientId: client.id }, orderBy: { funnelOrder: "asc" } }),
  ]);

  const totalOccurrences = occurrences.length;
  const totalItemsValue = occurrences.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.totalValue, 0), 0);
  const totalItemsCount = occurrences.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  const finalStatus = statuses.find((s) => s.isFinal);
  const closedOccurrences = finalStatus ? occurrences.filter((o) => o.statusId === finalStatus.id).length : 0;
  const firstStatus = statuses[0];
  const openOccurrences = firstStatus ? occurrences.filter((o) => o.statusId === firstStatus.id).length : 0;
  const inProgressOccurrences = totalOccurrences - openOccurrences - closedOccurrences;

  const byStatus = statuses.map((s) => ({
    name: s.name,
    count: occurrences.filter((o) => o.statusId === s.id).length,
  }));

  const damageTypeCount: Record<string, { name: string; count: number }> = {};
  for (const occ of occurrences) {
    for (const item of occ.items) {
      const id = item.damageTypeId;
      if (!damageTypeCount[id]) damageTypeCount[id] = { name: item.damageType.name, count: 0 };
      damageTypeCount[id]!.count += 1;
    }
  }
  const topDamageTypes = Object.values(damageTypeCount).sort((a, b) => b.count - a.count).slice(0, 5);

  const originCount: Record<string, { name: string; count: number }> = {};
  for (const occ of occurrences) {
    const id = occ.originId;
    if (!originCount[id]) originCount[id] = { name: occ.origin.name, count: 0 };
    originCount[id]!.count += 1;
  }
  const topOrigins = Object.values(originCount).sort((a, b) => b.count - a.count).slice(0, 5);

  return { totalOccurrences, openOccurrences, inProgressOccurrences, closedOccurrences, totalItemsValue, totalItemsCount, byStatus, topDamageTypes, topOrigins };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) return <p>Sem dados para exibir.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral das ocorrências de avarias</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Total"
          value={data.totalOccurrences}
          iconColor="text-slate-500"
          accentColor="#64748B"
        />
        <StatCard
          icon={AlertCircle}
          label="Abertas"
          value={data.openOccurrences}
          iconColor="text-orange-500"
          accentColor="#F97316"
        />
        <StatCard
          icon={Clock}
          label="Em Tratamento"
          value={data.inProgressOccurrences}
          iconColor="text-amber-500"
          accentColor="#F59E0B"
        />
        <StatCard
          icon={CheckCircle}
          label="Finalizadas"
          value={data.closedOccurrences}
          iconColor="text-green-600"
          accentColor="#16A34A"
        />
        <StatCard
          icon={Package}
          label="Itens Avariados"
          value={data.totalItemsCount.toFixed(0)}
          iconColor="text-purple-600"
          accentColor="#9333EA"
        />
        <StatCard
          icon={TrendingUp}
          label="Valor Total"
          value={formatCurrency(data.totalItemsValue)}
          iconColor="text-red-500"
          accentColor="#EF4444"
          small
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.byStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground/80 truncate max-w-[180px]">{s.name}</span>
                <span className="font-semibold tabular-nums ml-2 text-foreground">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top Tipos de Avaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.topDamageTypes.length === 0 && <p className="text-sm text-muted-foreground">Sem dados</p>}
            {data.topDamageTypes.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">{t.name}</span>
                <span className="font-semibold tabular-nums">{t.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top Origens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.topOrigins.length === 0 && <p className="text-sm text-muted-foreground">Sem dados</p>}
            {data.topOrigins.map((o) => (
              <div key={o.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">{o.name}</span>
                <span className="font-semibold tabular-nums">{o.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  accentColor,
  small,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconColor?: string;
  accentColor?: string;
  small?: boolean;
}) {
  return (
    <Card
      className="overflow-hidden"
      style={{ borderLeftWidth: "3px", borderLeftColor: accentColor ?? "#e2e8f0" }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`${small ? "text-lg" : "text-2xl"} font-bold mt-1 tabular-nums leading-none`}>
              {value}
            </p>
          </div>
          <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor ?? "text-muted-foreground"}`} />
        </div>
      </CardContent>
    </Card>
  );
}
