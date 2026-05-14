import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NewOccurrenceForm } from "@/components/occurrences/new-occurrence-form";

async function getFormData(clientId: string) {
  const [origins, damageTypes] = await Promise.all([
    prisma.parameterOrigin.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.parameterDamageType.findMany({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { origins, damageTypes };
}

export default async function NewOccurrencePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const data = await getFormData(session.user.clientId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nova Ocorrência</h1>
      <NewOccurrenceForm origins={data.origins} damageTypes={data.damageTypes} />
    </div>
  );
}
