import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user, "dashboard:indicators")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { clientId } = session.user;
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }

  const records = await prisma.monthlyBilling.findMany({
    where: { clientId, year },
    select: { month: true, amount: true },
    orderBy: { month: "asc" },
  });

  const items = records.map((r) => ({
    month: r.month,
    amount: r.amount.toFixed(2),
  }));

  return NextResponse.json({ year, items });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user, "dashboard:indicators")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { clientId } = session.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).year !== "number" ||
    typeof (body as Record<string, unknown>).month !== "number" ||
    (typeof (body as Record<string, unknown>).amount !== "number" &&
      typeof (body as Record<string, unknown>).amount !== "string")
  ) {
    return NextResponse.json({ error: "Campos obrigatórios: year, month, amount" }, { status: 400 });
  }

  const { year, month, amount } = body as { year: number; month: number; amount: number | string };

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Mês inválido (1–12)" }, { status: 400 });
  }

  const normalized =
    typeof amount === "string"
      ? parseFloat(amount.replace(/\./g, "").replace(",", "."))
      : amount;

  if (isNaN(normalized) || normalized < 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const record = await prisma.monthlyBilling.upsert({
    where: { clientId_year_month: { clientId, year, month } },
    create: { clientId, year, month, amount: normalized },
    update: { amount: normalized },
    select: { month: true, amount: true },
  });

  return NextResponse.json({ month: record.month, amount: record.amount.toFixed(2) });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user, "dashboard:indicators")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { clientId } = session.user;
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");

  const year = yearParam ? parseInt(yearParam, 10) : NaN;
  const month = monthParam ? parseInt(monthParam, 10) : NaN;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Mês inválido (1–12)" }, { status: 400 });
  }

  // deleteMany is a no-op when the record doesn't exist — safe to call unconditionally
  await prisma.monthlyBilling.deleteMany({ where: { clientId, year, month } });

  return NextResponse.json({ ok: true });
}
