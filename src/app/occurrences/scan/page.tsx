import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { OccurrenceScanner } from "@/components/occurrences/occurrence-scanner";

export default async function ScanOccurrencePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canView =
    hasPermission(session.user, "occurrence:view_all") ||
    hasPermission(session.user, "occurrence:view_own");

  if (!canView) redirect("/occurrences");

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Escanear Ocorrência</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aponte a câmera para o QR Code da etiqueta ou busque pelo código da ocorrência.
        </p>
      </div>
      <OccurrenceScanner />
    </div>
  );
}
