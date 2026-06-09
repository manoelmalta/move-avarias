import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentPrice } from "@/lib/pricing";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma";

// ── Types ──────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  internalCode: string;
  description: string;
  ean: string;
  dun: string | null;
  active: boolean;
};

// ── Helper: full occurrence data for a single product ─────────────────────────

async function getFullData(
  product: Product,
  currentPrice: number | null,
  userId: string,
  clientId: string,
  canViewAll: boolean,
  canViewOwn: boolean
) {
  // Users with no occurrence permission receive empty arrays / zero stats
  if (!canViewAll && !canViewOwn) {
    return {
      product: { ...product, currentPrice },
      stats: { totalQuantity: 0, totalValue: 0, openCount: 0, closedCount: 0, totalOccurrences: 0 },
      damageTypes: [],
      destinations: [],
      openOccurrences: [],
      recentClosedOccurrences: [],
    };
  }

  const occWhere: Prisma.DamageOccurrenceWhereInput = {
    clientId,
    items: { some: { productId: product.id } },
    ...(canViewOwn && !canViewAll ? { openedByUserId: userId } : {}),
  };

  const occurrences = await prisma.damageOccurrence.findMany({
    where: occWhere,
    include: {
      status: { select: { id: true, name: true, isFinal: true } },
      origin: { select: { name: true } },
      destination: { select: { name: true } },
      items: {
        where: { productId: product.id },
        include: { damageType: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalQuantity = 0;
  let totalValue = 0;
  let openCount = 0;
  let closedCount = 0;

  const damageTypeMap = new Map<string, { quantity: number; value: number }>();
  const destinationMap = new Map<string, number>();

  for (const occ of occurrences) {
    if (occ.status.isFinal) closedCount++; else openCount++;

    const destName = occ.destination?.name ?? "Sem destinação";
    destinationMap.set(destName, (destinationMap.get(destName) ?? 0) + 1);

    for (const item of occ.items) {
      totalQuantity += item.quantity;
      totalValue += item.totalValue;
      const existing = damageTypeMap.get(item.damageType.name) ?? { quantity: 0, value: 0 };
      damageTypeMap.set(item.damageType.name, {
        quantity: existing.quantity + item.quantity,
        value: existing.value + item.totalValue,
      });
    }
  }

  const openOccurrences = occurrences
    .filter((o) => !o.status.isFinal)
    .slice(0, 10)
    .map((o) => ({
      id: o.id,
      occurrenceCode: o.occurrenceCode,
      status: { name: o.status.name },
      origin: { name: o.origin.name },
      destination: o.destination ? { name: o.destination.name } : null,
      createdAt: o.createdAt.toISOString(),
      quantity: o.items.reduce((s, i) => s + i.quantity, 0),
      totalValue: o.items.reduce((s, i) => s + i.totalValue, 0),
    }));

  const recentClosedOccurrences = occurrences
    .filter((o) => o.status.isFinal)
    .sort((a, b) => {
      // Sort by completedAt desc; fall back to updatedAt for legacy records without it
      const bTime = (b.completedAt ?? b.updatedAt).getTime();
      const aTime = (a.completedAt ?? a.updatedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 10)
    .map((o) => ({
      id: o.id,
      occurrenceCode: o.occurrenceCode,
      status: { name: o.status.name },
      origin: { name: o.origin.name },
      destination: o.destination ? { name: o.destination.name } : null,
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt?.toISOString() ?? null,
      quantity: o.items.reduce((s, i) => s + i.quantity, 0),
      totalValue: o.items.reduce((s, i) => s + i.totalValue, 0),
    }));

  return {
    product: { ...product, currentPrice },
    stats: { totalQuantity, totalValue, openCount, closedCount, totalOccurrences: openCount + closedCount },
    damageTypes: Array.from(damageTypeMap.entries())
      .map(([name, { quantity, value }]) => ({ name, quantity, value }))
      .sort((a, b) => b.value - a.value),
    destinations: Array.from(destinationMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    openOccurrences,
    recentClosedOccurrences,
  };
}

// ── Batch price helper ─────────────────────────────────────────────────────────

async function batchPrices(productIds: string[], clientId: string) {
  const now = new Date();
  const prices = await prisma.productPrice.findMany({
    where: {
      clientId,
      productId: { in: productIds },
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { validFrom: "desc" },
    select: { productId: true, unitValue: true },
  });
  const map = new Map<string, number>();
  for (const p of prices) {
    if (!map.has(p.productId)) map.set(p.productId, p.unitValue);
  }
  return map;
}

// ── Score for ordering multiple results ───────────────────────────────────────

function scoreProduct(p: Product, q: string): number {
  const ql = q.toLowerCase();
  const code = p.internalCode.toLowerCase();
  const ean = p.ean.toLowerCase();
  const dun = p.dun?.toLowerCase() ?? "";
  const desc = p.description.toLowerCase();

  if (code === ql || ean === ql || dun === ql) return 0;       // exact code match
  if (code.startsWith(ql)) return 1;                           // code starts with
  if (ean.startsWith(ql) || dun.startsWith(ql)) return 2;     // EAN/DUN starts with
  if (desc.startsWith(ql)) return 3;                           // description starts with
  if (code.includes(ql) || ean.includes(ql) || dun.includes(ql)) return 4; // code contains
  return 5;                                                    // description contains
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = session;
  const clientId = user.clientId;
  const canViewAll = hasPermission(user, "occurrence:view_all");
  const canViewOwn = hasPermission(user, "occurrence:view_own");

  // ── Path A: direct lookup by productId ────────────────────────────────────
  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, clientId },
    });
    if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const currentPrice = await getCurrentPrice(product.id, clientId);
    const data = await getFullData(product, currentPrice, user.id, clientId, canViewAll, canViewOwn);
    return NextResponse.json({ mode: "single", ...data });
  }

  // ── Path B: search by query ───────────────────────────────────────────────
  const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json(
      { error: "Informe ao menos 2 caracteres para buscar" },
      { status: 400 }
    );
  }

  // Step 1 — exact match on code fields (internalCode, EAN, DUN)
  const exactMatches = await prisma.product.findMany({
    where: {
      clientId,
      OR: [
        { internalCode: { equals: query, mode: "insensitive" } },
        { ean: { equals: query, mode: "insensitive" } },
        { dun: { equals: query, mode: "insensitive" } },
      ],
    },
  });

  if (exactMatches.length === 1) {
    const product = exactMatches[0];
    const currentPrice = await getCurrentPrice(product.id, clientId);
    const data = await getFullData(product, currentPrice, user.id, clientId, canViewAll, canViewOwn);
    return NextResponse.json({ mode: "single", ...data });
  }

  // Step 2 — partial search across all fields
  const partialMatches = await prisma.product.findMany({
    where: {
      clientId,
      OR: [
        { internalCode: { contains: query, mode: "insensitive" } },
        { ean: { contains: query, mode: "insensitive" } },
        { dun: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 40, // over-fetch to allow de-dup with exact set and proper sorting
  });

  // Merge exact + partial, de-duplicate by id
  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const p of [...exactMatches, ...partialMatches]) {
    if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
  }

  if (merged.length === 0) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  if (merged.length === 1) {
    const product = merged[0];
    const currentPrice = await getCurrentPrice(product.id, clientId);
    const data = await getFullData(product, currentPrice, user.id, clientId, canViewAll, canViewOwn);
    return NextResponse.json({ mode: "single", ...data });
  }

  // Multiple results — score, sort, cap at 15
  const scored = merged
    .map((p) => ({ product: p, score: scoreProduct(p, query) }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.product.internalCode.localeCompare(b.product.internalCode, "pt-BR");
    })
    .slice(0, 15);

  const priceMap = await batchPrices(scored.map((r) => r.product.id), clientId);

  return NextResponse.json({
    mode: "multiple",
    results: scored.map(({ product }) => ({
      id: product.id,
      internalCode: product.internalCode,
      description: product.description,
      ean: product.ean,
      dun: product.dun,
      active: product.active,
      currentPrice: priceMap.get(product.id) ?? null,
    })),
  });
}
