import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PricesManager } from "@/components/products/prices-manager";

async function getData(clientId: string) {
  const [products, prices] = await Promise.all([
    prisma.product.findMany({ where: { clientId, active: true }, orderBy: { internalCode: "asc" } }),
    prisma.productPrice.findMany({
      where: { clientId },
      include: { product: { select: { internalCode: true, description: true } } },
      orderBy: { validFrom: "desc" },
    }),
  ]);
  return { products, prices };
}

export default async function PricesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { products, prices } = await getData(session.user.clientId);
  return (
    <div className="space-y-4">
      <PricesManager products={products} prices={prices} />
    </div>
  );
}
