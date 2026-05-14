import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = session.user.clientId;

  const users = await prisma.user.findMany({
    where: { clientId, active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}
