/**
 * scripts/import-product-costs.ts
 *
 * Imports unit costs from imports/cadastro_produtos.xlsx into ProductPrice.
 * Recalculates existing DamageOccurrenceItem values to match the new costs.
 *
 * Usage:
 *   npx tsx scripts/import-product-costs.ts            # dry-run (default)
 *   npx tsx scripts/import-product-costs.ts --dry-run  # explicit dry-run
 *   npx tsx scripts/import-product-costs.ts --apply    # write to database
 */

import "dotenv/config";
import * as XLSX from "xlsx";
import * as path from "path";
import { prisma } from "@/lib/db/client";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCEL_PATH = path.resolve(process.cwd(), "imports/cadastro_produtos.xlsx");
const SHEET_NAME = "Endereçamento";
const SOURCE_NOTE = "import:cadastro_produtos.xlsx:2026-05-18";
const FALLBACK_VALUE = 0.01;

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = !args.includes("--apply");

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toFloat(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  if (!isFinite(n) || isNaN(n)) return null;
  return n;
}

// ── Step 1: Read Excel ────────────────────────────────────────────────────────

function readExcel(): Map<string, number> {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found in Excel`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  const byCode = new Map<string, number>();
  const alerts: string[] = [];

  for (const row of rows) {
    const rawCod = row["Cod. Produto"];
    const rawVal = row["valor_unitario"];

    if (rawCod === null || rawCod === undefined) continue;
    const cod = String(rawCod).trim();
    if (!cod) continue;

    let val = toFloat(rawVal);
    if (val === null || val <= 0) val = FALLBACK_VALUE;

    if (byCode.has(cod)) {
      const existing = byCode.get(cod)!;
      if (Math.abs(existing - val) > 0.001) {
        alerts.push(
          `Cod. Produto duplicado com valores DIVERGENTES: ${cod} — existente=${existing}, novo=${val}. Usando o primeiro.`
        );
      }
      // Keep first occurrence (silent for equal values)
      continue;
    }

    byCode.set(cod, val);
  }

  if (alerts.length > 0) {
    console.error("\n⚠️  ALERTAS DO EXCEL:");
    for (const a of alerts) console.error("  " + a);
    if (!isDryRun) {
      console.error("\nAborting --apply due to divergent duplicates. Run --dry-run first.");
      process.exit(1);
    }
  }

  return byCode;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  IMPORTAÇÃO DE CUSTOS — ${isDryRun ? "DRY-RUN (sem gravação)" : "APPLY (gravando no banco)"}`);
  console.log(`${"═".repeat(60)}\n`);

  // ── Read Excel ──────────────────────────────────────────────────────────────
  console.log("📂 Lendo Excel...");
  const excelPrices = readExcel();
  console.log(`   ${excelPrices.size} produtos únicos no Excel\n`);

  // ── Read DB products ────────────────────────────────────────────────────────
  console.log("🗄️  Consultando banco...");
  const dbProducts = await prisma.product.findMany({
    select: { id: true, internalCode: true, description: true, clientId: true },
  });
  console.log(`   ${dbProducts.length} produtos no banco`);

  // Determine clientId — must be unique
  const clientIds = [...new Set(dbProducts.map((p) => p.clientId))];
  if (clientIds.length === 0) {
    console.error("❌  Nenhum produto no banco. Abortando.");
    process.exit(1);
  }
  if (clientIds.length > 1) {
    console.error("❌  Múltiplos clientIds detectados:", clientIds);
    console.error("   Script suporta apenas um cliente. Abortando.");
    process.exit(1);
  }
  const clientId = clientIds[0];
  console.log(`   clientId: ${clientId.substring(0, 12)}...\n`);

  // ── Build price map per productId ───────────────────────────────────────────
  const productPriceMap = new Map<string, number>(); // productId → new unitValue
  const matchedByCode: string[] = [];
  const notInExcel: typeof dbProducts = [];

  for (const p of dbProducts) {
    if (excelPrices.has(p.internalCode)) {
      productPriceMap.set(p.id, excelPrices.get(p.internalCode)!);
      matchedByCode.push(p.internalCode);
    } else {
      productPriceMap.set(p.id, FALLBACK_VALUE);
      notInExcel.push(p);
    }
  }

  const productsWith001 = [...productPriceMap.entries()].filter(([, v]) => v <= FALLBACK_VALUE).length;

  // ── Existing prices ─────────────────────────────────────────────────────────
  const now = new Date();
  const existingCurrentPrices = await prisma.productPrice.findMany({
    where: {
      clientId,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    select: { id: true, productId: true, unitValue: true },
  });
  const pricesByProduct = new Map<string, typeof existingCurrentPrices>();
  for (const p of existingCurrentPrices) {
    if (!pricesByProduct.has(p.productId)) pricesByProduct.set(p.productId, []);
    pricesByProduct.get(p.productId)!.push(p);
  }
  const multiPriceProducts = [...pricesByProduct.entries()].filter(([, v]) => v.length > 1);

  // ── Occurrence items ────────────────────────────────────────────────────────
  const items = await prisma.damageOccurrenceItem.findMany({
    select: { id: true, productId: true, quantity: true, unitValue: true, totalValue: true },
  });

  const totalValueBefore = items.reduce((s, i) => s + i.totalValue, 0);

  // Compute new values per item
  type ItemUpdate = { id: string; oldUnit: number; newUnit: number; oldTotal: number; newTotal: number; qty: number };
  const itemUpdates: ItemUpdate[] = [];

  for (const item of items) {
    const newUnit = productPriceMap.get(item.productId) ?? FALLBACK_VALUE;
    const newTotal = Math.round(item.quantity * newUnit * 100) / 100;
    itemUpdates.push({
      id: item.id,
      oldUnit: item.unitValue,
      newUnit,
      oldTotal: item.totalValue,
      newTotal,
      qty: item.quantity,
    });
  }

  const totalValueAfter = itemUpdates.reduce((s, i) => s + i.newTotal, 0);
  const itemsChanged = itemUpdates.filter((i) => Math.abs(i.oldUnit - i.newUnit) > 0.001);

  // Top 10 biggest variations
  const top10 = [...itemUpdates]
    .sort((a, b) => Math.abs(b.newTotal - b.oldTotal) - Math.abs(a.newTotal - a.oldTotal))
    .slice(0, 10);

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log("═══ RELATÓRIO DRY-RUN ═══════════════════════════════════\n");
  console.log(`Produtos no banco:                    ${dbProducts.length}`);
  console.log(`Produtos no Excel (únicos):           ${excelPrices.size}`);
  console.log(`Matched por internalCode:             ${matchedByCode.length}`);
  console.log(`Do banco ausentes no Excel (→ 0,01): ${notInExcel.length}`);
  console.log(`  Amostra: ${notInExcel.slice(0, 5).map((p) => p.internalCode).join(", ")}`);
  console.log(`Produtos que receberão 0,01:          ${productsWith001}`);
  console.log(`  (435 do Excel já têm 0,01 + ${notInExcel.length} ausentes)`);
  console.log(`\nProductPrice vigentes que serão encerrados: ${existingCurrentPrices.length}`);
  if (multiPriceProducts.length > 0) {
    console.log(`  ⚠️  Produtos com múltiplos preços vigentes (todos encerrados): ${multiPriceProducts.length}`);
    for (const [pid, ps] of multiPriceProducts) {
      console.log(`     productId=${pid.substring(0, 10)}... — ${ps.length} registros`);
    }
  }
  console.log(`Novos ProductPrice a criar:           ${dbProducts.length}`);
  console.log(`\nDamageOccurrenceItem total:           ${items.length}`);
  console.log(`Itens com valor alterado:             ${itemsChanged.length}`);
  console.log(`  Valor total ANTES:  ${fmt(totalValueBefore)}`);
  console.log(`  Valor total DEPOIS: ${fmt(totalValueAfter)}`);
  console.log(`  Variação:           ${fmt(totalValueAfter - totalValueBefore)}`);

  console.log(`\nTop 10 maiores variações por item:`);
  for (const u of top10) {
    const diff = u.newTotal - u.oldTotal;
    const sign = diff >= 0 ? "+" : "";
    console.log(
      `  id=${u.id.substring(0, 10)}... qty=${u.qty} | uv: ${fmt(u.oldUnit)} → ${fmt(u.newUnit)} | total: ${fmt(u.oldTotal)} → ${fmt(u.newTotal)} (${sign}${fmt(diff)})`
    );
  }

  console.log(`\nProdutos ainda sem preço após importação: 0`);
  console.log(`  (todos receberão ao menos ${fmt(FALLBACK_VALUE)})`);

  if (notInExcel.length > 0) {
    console.log(`\n⚠️  Produtos do banco ausentes do Excel (receberão ${fmt(FALLBACK_VALUE)}):`);
    for (const p of notInExcel) {
      console.log(`   ${p.internalCode.padEnd(12)} ${p.description.substring(0, 50)}`);
    }
  }

  console.log(`\n${"═".repeat(60)}`);

  if (isDryRun) {
    console.log("\n✅  Dry-run concluído. Nenhuma alteração foi feita no banco.");
    console.log("   Para aplicar: npx tsx scripts/import-product-costs.ts --apply\n");
    return;
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  console.log("\n🚀  Aplicando importação em transação...\n");

  const applyNow = new Date();

  await prisma.$transaction(
    async (tx) => {
      // 1. Encerrar todos os preços vigentes atuais
      if (existingCurrentPrices.length > 0) {
        await tx.productPrice.updateMany({
          where: { id: { in: existingCurrentPrices.map((p) => p.id) } },
          data: { validTo: applyNow },
        });
        console.log(`   ✓ ${existingCurrentPrices.length} preços encerrados (validTo = now)`);
      }

      // 2. Create new ProductPrice for every product
      const newPrices = dbProducts.map((p) => ({
        clientId: p.clientId,
        productId: p.id,
        unitValue: productPriceMap.get(p.id) ?? FALLBACK_VALUE,
        validFrom: applyNow,
        validTo: null,
        sourceNote: SOURCE_NOTE,
      }));

      await tx.productPrice.createMany({ data: newPrices });
      console.log(`   ✓ ${newPrices.length} novos ProductPrice criados`);

      // 3. Recalculate all DamageOccurrenceItem
      for (const u of itemUpdates) {
        await tx.damageOccurrenceItem.update({
          where: { id: u.id },
          data: { unitValue: u.newUnit, totalValue: u.newTotal },
        });
      }
      console.log(`   ✓ ${itemUpdates.length} DamageOccurrenceItem recalculados`);
    },
    { timeout: 30000 }
  );

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  RELATÓRIO FINAL — APLICAÇÃO CONCLUÍDA");
  console.log("════════════════════════════════════════════════════════════\n");
  console.log(`Produtos processados:           ${dbProducts.length}`);
  console.log(`Preços encerrados:              ${existingCurrentPrices.length}`);
  console.log(`Novos preços criados:           ${dbProducts.length}`);
  console.log(`Produtos com custo 0,01:        ${productsWith001}`);
  console.log(`OccurrenceItems recalculados:   ${itemUpdates.length}`);
  console.log(`  Valor total antes:  ${fmt(totalValueBefore)}`);
  console.log(`  Valor total depois: ${fmt(totalValueAfter)}`);
  console.log(`  Variação:           ${fmt(totalValueAfter - totalValueBefore)}`);
  console.log(`\nsourceNote: "${SOURCE_NOTE}"\n`);
}

main()
  .catch((e) => {
    console.error("\n❌  Erro fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
