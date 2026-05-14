import { prisma } from "@/lib/db/client";
import { ProductsManager } from "@/components/products/products-manager";
import { getCurrentPrice } from "@/lib/pricing";

async function getProducts() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return [];

  const products = await prisma.product.findMany({
    where: { clientId: client.id },
    orderBy: { internalCode: "asc" },
  });

  const withPrices = await Promise.all(
    products.map(async (p) => ({
      ...p,
      currentPrice: await getCurrentPrice(p.id, client.id),
    }))
  );

  return withPrices;
}

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <div className="space-y-4">
      <ProductsManager products={products} />
    </div>
  );
}
