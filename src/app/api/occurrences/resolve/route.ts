import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = session;
  const canViewAll = hasPermission(user, "occurrence:view_all");
  const canViewOwn = hasPermission(user, "occurrence:view_own");

  if (!canViewAll && !canViewOwn) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar ocorrências." },
      { status: 403 }
    );
  }

  const search = req.nextUrl.searchParams;
  const publicToken = search.get("publicToken")?.trim();
  const occurrenceCode = search.get("occurrenceCode")?.trim().toUpperCase();

  if (!publicToken && !occurrenceCode) {
    return NextResponse.json(
      { error: "Informe publicToken ou occurrenceCode." },
      { status: 400 }
    );
  }

  const occurrence = publicToken
    ? await prisma.damageOccurrence.findUnique({
        where: { publicToken },
        select: { id: true, clientId: true, openedByUserId: true },
      })
    : await prisma.damageOccurrence.findUnique({
        where: { occurrenceCode: occurrenceCode! },
        select: { id: true, clientId: true, openedByUserId: true },
      });

  // Return 404 for both "not found" and "wrong client" to avoid leaking existence
  if (!occurrence || occurrence.clientId !== user.clientId) {
    return NextResponse.json({ error: "Ocorrência não encontrada." }, { status: 404 });
  }

  // view_own users may only resolve their own occurrences
  if (!canViewAll && occurrence.openedByUserId !== user.id) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar esta ocorrência." },
      { status: 403 }
    );
  }

  return NextResponse.json({ id: occurrence.id });
}
