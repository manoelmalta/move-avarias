import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const client = await prisma.client.findFirst({ where: { slug: "cliente-demo" } });
  if (!client) return NextResponse.json([], { status: 200 });

  const users = await prisma.user.findMany({
    where: { clientId: client.id, active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}
