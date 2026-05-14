import { prisma } from "@/lib/db/client";
import { PricesManager } from "@/components/products/prices-manager";

async function getData() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return { products: [], prices: [] };

  const [products, prices] = await Promise.all([
    prisma.product.findMany({ where: { clientId: client.id, active: true }, orderBy: { internalCode: "asc" } }),
    prisma.productPrice.findMany({
      where: { clientId: client.id },
      include: { product: { select: { internalCode: true, description: true } } },
      orderBy: { validFrom: "desc" },
    }),
  ]);

  return { products, prices };
}

export default async function PricesPage() {
  const { products, prices } = await getData();
  return (
    <div className="space-y-4">
      <PricesManager products={products} prices={prices} />
    </div>
  );
}
