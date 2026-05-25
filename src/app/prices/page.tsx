import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { PricesManager } from "@/components/products/prices-manager";

async function getData(clientId: string) {
  const now = new Date();

  const [products, prices] = await Promise.all([
    prisma.product.findMany({
      where: { clientId, active: true },
      orderBy: { internalCode: "asc" },
      select: { id: true, internalCode: true, description: true, ean: true, dun: true },
    }),
    prisma.productPrice.findMany({
      where: { clientId },
      include: { product: { select: { internalCode: true, description: true, ean: true, dun: true } } },
      orderBy: { validFrom: "desc" },
    }),
  ]);

  // Calcula preço vigente e próximo programado por produto
  const currentPriceMap = new Map<string, number>();
  const nextPriceMap = new Map<string, { unitValue: number; validFrom: Date }>();

  for (const price of prices) {
    const vf = new Date(price.validFrom);
    const vt = price.validTo ? new Date(price.validTo) : null;

    if (vf <= now && (vt === null || vt >= now)) {
      // Vigente agora — como prices está ordenado por validFrom desc, o primeiro é o mais recente
      if (!currentPriceMap.has(price.productId)) {
        currentPriceMap.set(price.productId, price.unitValue);
      }
    } else if (vf > now) {
      // Futuro — captura o próximo mais próximo
      const existing = nextPriceMap.get(price.productId);
      if (!existing || vf < new Date(existing.validFrom)) {
        nextPriceMap.set(price.productId, { unitValue: price.unitValue, validFrom: vf });
      }
    }
  }

  return {
    products,
    prices,
    currentPriceMap: Object.fromEntries(currentPriceMap),
    nextPriceMap: Object.fromEntries(
      Array.from(nextPriceMap.entries()).map(([k, v]) => [k, { unitValue: v.unitValue, validFrom: v.validFrom.toISOString() }])
    ),
  };
}

export default async function PricesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user, "price:manage")) redirect("/occurrences");
  const data = await getData(session.user.clientId);
  return (
    <div className="space-y-4">
      <PricesManager {...data} />
    </div>
  );
}
