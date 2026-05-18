import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ProductLookup } from "@/components/products/product-lookup";

export default async function ProductLookupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { user } = session;

  // Accessible to anyone who can view occurrences (own or all)
  if (!hasPermission(user, "occurrence:view_all") && !hasPermission(user, "occurrence:view_own")) {
    redirect("/occurrences");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Consulta de Produto</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Busque por código interno, EAN, DUN ou descrição
        </p>
      </div>
      <ProductLookup />
    </div>
  );
}
