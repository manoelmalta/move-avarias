import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { CreateOriginSchema } from "@/lib/validations/parameter";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origins = await prisma.parameterOrigin.findMany({
    where: { clientId: session.user.clientId },
    select: { id: true, name: true, active: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(origins);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user, "parameter:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = CreateOriginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name } = parsed.data;
  const clientId = session.user.clientId;

  // Impedir duplicidade case-insensitive
  const existing = await prisma.parameterOrigin.findFirst({
    where: {
      clientId,
      name: { equals: name, mode: "insensitive" },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma origem com esse nome." },
      { status: 409 }
    );
  }

  // sortOrder = max atual + 1
  const maxOrder = await prisma.parameterOrigin.aggregate({
    where: { clientId },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  const origin = await prisma.parameterOrigin.create({
    data: {
      clientId,
      name,
      active: true,
      sortOrder: nextOrder,
    },
    select: { id: true, name: true, active: true, sortOrder: true },
  });

  return NextResponse.json(origin, { status: 201 });
}
