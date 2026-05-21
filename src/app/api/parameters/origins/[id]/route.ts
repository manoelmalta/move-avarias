import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { UpdateOriginSchema } from "@/lib/validations/parameter";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user, "parameter:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const clientId = session.user.clientId;

  const target = await prisma.parameterOrigin.findUnique({
    where: { id },
    select: { id: true, clientId: true, name: true, active: true },
  });

  if (!target || target.clientId !== clientId) {
    return NextResponse.json({ error: "Origem não encontrada" }, { status: 404 });
  }

  const body = await req.json() as unknown;
  const parsed = UpdateOriginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, active } = parsed.data;

  // Impedir duplicidade de nome case-insensitive (se alterando nome)
  if (name !== undefined && name.toLowerCase() !== target.name.toLowerCase()) {
    const duplicate = await prisma.parameterOrigin.findFirst({
      where: {
        clientId,
        name: { equals: name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Já existe uma origem com esse nome." },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (active !== undefined) updateData.active = active;

  const updated = await prisma.parameterOrigin.update({
    where: { id: target.id },
    data: updateData,
    select: { id: true, name: true, active: true, sortOrder: true },
  });

  return NextResponse.json(updated);
}
