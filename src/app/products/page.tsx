import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProductsManager } from "@/components/products/products-manager";
import { getCurrentPrice } from "@/lib/pricing";

async function getProducts(clientId: string) {
  const products = await prisma.product.findMany({
    where: { clientId },
    orderBy: { internalCode: "asc" },
  });

  const withPrices = await Promise.all(
    products.map(async (p) => ({
      ...p,
      currentPrice: await getCurrentPrice(p.id, clientId),
    }))
  );

  return withPrices;
}

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const products = await getProducts(session.user.clientId);
  return (
    <div className="space-y-4">
      <ProductsManager products={products} />
    </div>
  );
}
