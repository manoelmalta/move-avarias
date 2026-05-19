import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreateOccurrenceSchema } from "@/lib/validations/occurrence";
import { generateOccurrenceCode } from "@/lib/occurrence-code";
import { createAuditLog } from "@/lib/audit";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

const VALID_PAGE_SIZES = [25, 50, 100] as const;
type ValidPageSize = (typeof VALID_PAGE_SIZES)[number];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = session;
  const canViewAll = hasPermission(user, "occurrence:view_all");
  const canViewOwn = hasPermission(user, "occurrence:view_own");

  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams;

  // ── Pagination ──────────────────────────────────────────────────────────────
  const rawPage = parseInt(search.get("page") ?? "1");
  const page = !isNaN(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawPageSize = parseInt(search.get("pageSize") ?? "25");
  const pageSize: ValidPageSize = (VALID_PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? (rawPageSize as ValidPageSize)
    : 25;

  // ── WHERE ────────────────────────────────────────────────────────────────────
  const where: Record<string, unknown> = { clientId: user.clientId };

  // Permission scoping: SEPARADOR (view_own only) always sees only their own records.
  // Even if they pass a different openedByUserId via URL, it is ignored.
  if (!canViewAll) {
    where.openedByUserId = user.id;
  } else if (search.get("openedByUserId")) {
    where.openedByUserId = search.get("openedByUserId");
  }

  // Scalar filters
  if (search.get("statusId")) where.statusId = search.get("statusId");
  if (search.get("originId")) where.originId = search.get("originId");
  if (search.get("destinationId")) where.destinationId = search.get("destinationId");
  if (search.get("code")) where.occurrenceCode = { contains: search.get("code") };

  // createdAt range (dateFrom / dateTo)
  if (search.get("dateFrom") || search.get("dateTo")) {
    const createdAt: Record<string, unknown> = {};
    if (search.get("dateFrom")) createdAt.gte = new Date(search.get("dateFrom")!);
    if (search.get("dateTo")) createdAt.lte = new Date(search.get("dateTo")! + "T23:59:59");
    where.createdAt = createdAt;
  }

  // lifecycle + completedAt range
  const lifecycle = search.get("lifecycle");
  const completedFrom = search.get("completedFrom");
  const completedTo = search.get("completedTo");

  if (lifecycle === "open") {
    // Explicitly open — completedAt must be null; ignore completedFrom/To
    where.completedAt = null;
  } else if (lifecycle === "closed" || completedFrom || completedTo) {
    const completedAt: Record<string, unknown> = {};
    if (lifecycle === "closed") completedAt.not = null;
    if (completedFrom) completedAt.gte = new Date(completedFrom);
    if (completedTo) completedAt.lte = new Date(completedTo + "T23:59:59");
    where.completedAt = completedAt;
  }

  // Items sub-filters via top-level AND (allows conditions to match different items)
  const andConditions: unknown[] = [];
  if (search.get("damageTypeId")) {
    andConditions.push({ items: { some: { damageTypeId: search.get("damageTypeId") } } });
  }
  if (search.get("noPrice") === "true") {
    andConditions.push({ items: { some: { unitValue: { lte: 0.01 } } } });
  }
  if (andConditions.length > 0) where.AND = andConditions;

  // ── Queries ──────────────────────────────────────────────────────────────────
  const [occurrences, total] = await Promise.all([
    prisma.damageOccurrence.findMany({
      where,
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        origin: true,
        status: true,
        destination: true,
        items: { include: { damageType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.damageOccurrence.count({ where }),
  ]);

  return NextResponse.json({
    data: occurrences,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = session;

  if (!hasPermission(user, "occurrence:create")) {
    return NextResponse.json({ error: "Sem permissão para criar ocorrências" }, { status: 403 });
  }

  const body = await req.json() as { data: unknown };
  const parsed = CreateOccurrenceSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const occurrenceCode = await generateOccurrenceCode(user.clientId);
  const firstStatus = await prisma.parameterStatus.findFirst({
    where: { clientId: user.clientId, active: true },
    orderBy: { funnelOrder: "asc" },
  });

  if (!firstStatus) return NextResponse.json({ error: "Status inicial não configurado" }, { status: 500 });

  const occurrence = await prisma.damageOccurrence.create({
    data: {
      clientId: user.clientId,
      occurrenceCode,
      openedByUserId: user.id,
      originId: parsed.data.originId,
      statusId: firstStatus.id,
      description: parsed.data.description,
      notes: parsed.data.notes ?? null,
      items: {
        create: parsed.data.items.map((item) => ({
          clientId: user.clientId,
          productId: item.productId,
          barcodeInput: item.barcodeInput ?? null,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: item.totalValue,
          batch: item.batch ?? null,
          expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
          damageTypeId: item.damageTypeId,
        })),
      },
    },
    include: { items: true },
  });

  await createAuditLog({
    user,
    entityType: "DamageOccurrence",
    entityId: occurrence.id,
    occurrenceId: occurrence.id,
    action: "CREATE",
    fieldName: "occurrenceCode",
    newValue: occurrenceCode,
  });

  return NextResponse.json(occurrence, { status: 201 });
}
