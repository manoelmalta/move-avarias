import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { ProductsManager } from "@/components/products/products-manager";

async function getProducts(clientId: string) {
  const now = new Date();

  const [products, prices] = await Promise.all([
    prisma.product.findMany({
      where: { clientId },
      orderBy: { internalCode: "asc" },
    }),
    prisma.productPrice.findMany({
      where: {
        clientId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { productId: true, unitValue: true },
    }),
  ]);

  const priceMap = new Map<string, number>();
  for (const price of prices) {
    if (!priceMap.has(price.productId)) priceMap.set(price.productId, price.unitValue);
  }

  return products.map((p) => ({
    ...p,
    currentPrice: priceMap.get(p.id) ?? null,
  }));
}

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user, "product:manage")) redirect("/occurrences");
  const products = await getProducts(session.user.clientId);
  return (
    <div className="space-y-4">
      <ProductsManager products={products} />
    </div>
  );
}
