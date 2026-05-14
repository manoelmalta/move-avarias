import { prisma } from "@/lib/db/client";
import { NewOccurrenceForm } from "@/components/occurrences/new-occurrence-form";

async function getFormData() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return null;

  const [origins, damageTypes] = await Promise.all([
    prisma.parameterOrigin.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDamageType.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return { origins, damageTypes };
}

export default async function NewOccurrencePage() {
  const data = await getFormData();
  if (!data) return <p>Erro ao carregar dados.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nova Ocorrência</h1>
      <NewOccurrenceForm origins={data.origins} damageTypes={data.damageTypes} />
    </div>
  );
}
