/**
 * scripts/clean-demo-base.ts
 *
 * Cleans demo/test data from the database.
 *
 * Usage:
 *   npx tsx scripts/clean-demo-base.ts --dry-run   (default, no DB changes)
 *   npx tsx scripts/clean-demo-base.ts --apply     (real execution inside $transaction)
 *
 * What it removes:
 *   - All AuditLog records (59 test/dev records)
 *   - All DamageOccurrenceItem from demo occurrences
 *   - All DamageOccurrence (all are demo/test — opened by @demo.com users)
 *   - ProductPrice records for 6 demo/test products
 *   - 6 demo/test Product records (PROD001, PROD002, PROD003, TEST-1C, TEST-3C, 999999)
 *   - 3 inactive test users with no remaining FK references
 *
 * What it NEVER touches:
 *   - Real products (internalCode NOT in demo list)
 *   - Real ProductPrice records
 *   - Parameters (Origin, DamageType, Status, Destination)
 *   - Active demo users: admin@demo.com, separador@demo.com, analista@demo.com,
 *     lider@demo.com, gestor@demo.com
 *   - schema.prisma (no migration)
 */

import "dotenv/config";
import { prisma } from "../src/lib/db/client";

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIENT_SLUG = "cliente-demo";

/** Internal codes of demo/test products to be deleted */
const DEMO_PRODUCT_CODES = ["PROD001", "PROD002", "PROD003", "TEST-1C", "TEST-3C", "999999"];

/** Emails of inactive test users that can be safely deleted (no FK refs expected) */
const DELETABLE_INACTIVE_USER_EMAILS = [
  "teste.5b@demo.com",
  "teste.rodada5a@demo.com",
  "validacao.5a@demo.com",
];

/** Emails of active demo users that must NEVER be touched */
const PROTECTED_ACTIVE_USER_EMAILS = [
  "admin@demo.com",
  "separador@demo.com",
  "analista@demo.com",
  "lider@demo.com",
  "gestor@demo.com",
];

// ── Hard-stop guard ───────────────────────────────────────────────────────────

function hardStop(reason: string): never {
  console.error("\n🛑  HARD STOP:", reason);
  console.error("   No changes were made to the database.");
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = !isApply;

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  MOVE AVARIAS — Demo Base Cleanup`);
  console.log(`  Mode: ${isDryRun ? "DRY-RUN (no changes)" : "⚡ APPLY (real changes)"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Resolve client ───────────────────────────────────────────────────────
  const client = await prisma.client.findFirst({ where: { slug: CLIENT_SLUG } });
  if (!client) hardStop(`Client '${CLIENT_SLUG}' not found.`);
  const cid = client.id;
  console.log(`Client: ${client.name} (${cid})\n`);

  // ── 1. Resolve demo product IDs ──────────────────────────────────────────
  const demoProducts = await prisma.product.findMany({
    where: { clientId: cid, internalCode: { in: DEMO_PRODUCT_CODES } },
    include: { prices: true, occurrenceItems: { select: { id: true } } },
  });

  // Safety: verify no real product is in the list
  for (const p of demoProducts) {
    if (!DEMO_PRODUCT_CODES.includes(p.internalCode)) {
      hardStop(`Real product ${p.internalCode} (${p.description}) found in demo list.`);
    }
  }
  const demoProductIds = demoProducts.map((p) => p.id);
  const demoPriceIds = demoProducts.flatMap((p) => p.prices.map((x) => x.id));

  // ── 2. Resolve all occurrences ───────────────────────────────────────────
  const allOccurrences = await prisma.damageOccurrence.findMany({
    where: { clientId: cid },
    include: {
      openedBy: { select: { email: true, name: true } },
      items: { select: { id: true } },
      auditLogs: { select: { id: true } },
    },
  });

  // Safety: verify ALL occurrences are opened by @demo.com users
  const nonDemoOccurrences = allOccurrences.filter(
    (o) => !o.openedBy.email.toLowerCase().includes("@demo.com")
  );
  if (nonDemoOccurrences.length > 0) {
    hardStop(
      `Found ${nonDemoOccurrences.length} occurrence(s) NOT opened by @demo.com users:\n` +
        nonDemoOccurrences.map((o) => `  ${o.occurrenceCode} by ${o.openedBy.email}`).join("\n")
    );
  }

  const demoOccurrenceIds = allOccurrences.map((o) => o.id);
  const demoItemIds = allOccurrences.flatMap((o) => o.items.map((i) => i.id));

  // ── 3. Resolve AuditLogs ─────────────────────────────────────────────────
  const allAuditLogs = await prisma.auditLog.findMany({
    where: { clientId: cid },
    select: { id: true, entityType: true, occurrenceId: true, userId: true },
  });

  // Safety: all audit logs should be test/dev records
  // If a log exists for an entityType we don't expect, stop.
  const knownEntityTypes = new Set(["DamageOccurrence", "User", "Product"]);
  const unknownLogs = allAuditLogs.filter((l) => !knownEntityTypes.has(l.entityType));
  if (unknownLogs.length > 0) {
    hardStop(
      `Found AuditLog entries with unexpected entityType(s):\n` +
        unknownLogs.map((l) => `  ${l.id} entityType=${l.entityType}`).join("\n")
    );
  }
  const auditLogIds = allAuditLogs.map((l) => l.id);

  // ── 4. Resolve inactive deletable users ──────────────────────────────────
  const deletableUsers = await prisma.user.findMany({
    where: { clientId: cid, email: { in: DELETABLE_INACTIVE_USER_EMAILS } },
    include: { _count: { select: { occurrences: true, auditLogs: true } } },
  });

  // Safety: none of these should be active
  for (const u of deletableUsers) {
    if (u.active) {
      hardStop(`User ${u.email} is ACTIVE but is in the deletable list. Aborting.`);
    }
    // After AuditLog deletion, FK refs to userId will be gone. But we check now:
    // In dry-run we just report; in apply the tx deletes audit logs first.
    if (u._count.auditLogs > 0 && isDryRun) {
      console.warn(
        `  ⚠️  User ${u.email} has ${u._count.auditLogs} AuditLog ref(s) — will be deleted first in tx.`
      );
    }
  }

  // Safety: protected users must NOT be in deletable list
  const protectedUsers = await prisma.user.findMany({
    where: { clientId: cid, email: { in: PROTECTED_ACTIVE_USER_EMAILS } },
  });
  for (const u of protectedUsers) {
    if (!u.active) {
      hardStop(`Protected user ${u.email} is inactive — unexpected. Aborting.`);
    }
    if (DELETABLE_INACTIVE_USER_EMAILS.includes(u.email)) {
      hardStop(`Protected user ${u.email} is in the deletable list. Aborting.`);
    }
  }
  // Admin Demo must be active
  const adminDemo = protectedUsers.find((u) => u.email === "admin@demo.com");
  if (!adminDemo || !adminDemo.active) {
    hardStop("Admin Demo (admin@demo.com) is not found or not active. Aborting.");
  }

  // ── 5. Current state counts (before) ────────────────────────────────────
  const [totalOccs, totalItems, totalAudit, totalProducts, totalPrices, totalUsers] =
    await Promise.all([
      prisma.damageOccurrence.count({ where: { clientId: cid } }),
      prisma.damageOccurrenceItem.count({ where: { clientId: cid } }),
      prisma.auditLog.count({ where: { clientId: cid } }),
      prisma.product.count({ where: { clientId: cid } }),
      prisma.productPrice.count({ where: { clientId: cid } }),
      prisma.user.count({ where: { clientId: cid } }),
    ]);

  const [totalActiveUsers, totalInactiveUsers] = await Promise.all([
    prisma.user.count({ where: { clientId: cid, active: true } }),
    prisma.user.count({ where: { clientId: cid, active: false } }),
  ]);

  // Parameter counts (must not change)
  const [totalStatus, totalOrigins, totalDamageTypes, totalDestinations] = await Promise.all([
    prisma.parameterStatus.count({ where: { clientId: cid } }),
    prisma.parameterOrigin.count({ where: { clientId: cid } }),
    prisma.parameterDamageType.count({ where: { clientId: cid } }),
    prisma.parameterDestination.count({ where: { clientId: cid } }),
  ]);

  // ── 6. Expected counts verification ─────────────────────────────────────
  const EXPECTED = {
    occurrences: 17,
    items: 18,
    auditLogs: 59,
    demoProducts: 6,
    demoPrices: 10,
    deletableUsers: 3,
  };

  let divergence = false;
  function checkExpected(label: string, actual: number, expected: number) {
    const ok = actual === expected;
    if (!ok) divergence = true;
    console.log(`  ${ok ? "✓" : "✗"} ${label}: ${actual} (expected ${expected})`);
  }

  console.log("── Expected counts verification ────────────────────────────");
  checkExpected("Demo occurrences", allOccurrences.length, EXPECTED.occurrences);
  checkExpected("Demo items", demoItemIds.length, EXPECTED.items);
  checkExpected("AuditLogs total", allAuditLogs.length, EXPECTED.auditLogs);
  checkExpected("Demo products", demoProducts.length, EXPECTED.demoProducts);
  checkExpected("Demo ProductPrices", demoPriceIds.length, EXPECTED.demoPrices);
  checkExpected("Deletable inactive users", deletableUsers.length, EXPECTED.deletableUsers);
  console.log();

  if (divergence) {
    hardStop("Counts diverge from expected. Review before proceeding.");
  }

  // ── 7. Dry-run report ────────────────────────────────────────────────────
  console.log("── Occurrences to be DELETED ───────────────────────────────");
  for (const o of allOccurrences) {
    console.log(`  ${o.occurrenceCode}  by=${o.openedBy.email}  items=${o.items.length}`);
  }
  console.log();

  console.log("── Items to be DELETED ─────────────────────────────────────");
  console.log(`  ${demoItemIds.length} DamageOccurrenceItem rows`);
  console.log();

  console.log("── AuditLogs to be DELETED ─────────────────────────────────");
  const logsByType: Record<string, number> = {};
  for (const l of allAuditLogs) logsByType[l.entityType] = (logsByType[l.entityType] ?? 0) + 1;
  for (const [type, count] of Object.entries(logsByType)) {
    console.log(`  ${count} × entityType=${type}`);
  }
  console.log(`  Total: ${auditLogIds.length} rows`);
  console.log();

  console.log("── Demo Products to be DELETED ─────────────────────────────");
  for (const p of demoProducts) {
    console.log(
      `  [${p.internalCode}] ${p.description}  prices=${p.prices.length}  items=${p.occurrenceItems.length}`
    );
  }
  console.log();

  console.log("── Inactive users to be DELETED ────────────────────────────");
  for (const u of deletableUsers) {
    console.log(`  ${u.email}  role=${u.role}  active=${u.active}`);
  }
  console.log();

  console.log("── PROTECTED — will NOT be touched ─────────────────────────");
  for (const u of protectedUsers) {
    console.log(`  KEEP ACTIVE: ${u.email}  role=${u.role}`);
  }
  console.log(`  KEEP: ${totalProducts - demoProducts.length} real products`);
  console.log(`  KEEP: ${totalPrices - demoPriceIds.length} real ProductPrice records`);
  console.log(
    `  KEEP: ${totalStatus} statuses, ${totalOrigins} origins, ${totalDamageTypes} damage types, ${totalDestinations} destinations`
  );
  console.log();

  console.log("── Simulated counts BEFORE → AFTER ─────────────────────────");
  console.log(`  DamageOccurrence    : ${totalOccs} → ${totalOccs - allOccurrences.length}`);
  console.log(`  DamageOccurrenceItem: ${totalItems} → ${totalItems - demoItemIds.length}`);
  console.log(`  AuditLog            : ${totalAudit} → ${totalAudit - auditLogIds.length}`);
  console.log(`  Product             : ${totalProducts} → ${totalProducts - demoProducts.length}`);
  console.log(`  ProductPrice        : ${totalPrices} → ${totalPrices - demoPriceIds.length}`);
  console.log(`  Users (total)       : ${totalUsers} → ${totalUsers - deletableUsers.length}`);
  console.log(`  Users (active)      : ${totalActiveUsers} → ${totalActiveUsers} (unchanged)`);
  console.log(
    `  Users (inactive)    : ${totalInactiveUsers} → ${totalInactiveUsers - deletableUsers.length}`
  );
  console.log();

  if (isDryRun) {
    console.log("══════════════════════════════════════════════════════════");
    console.log("  DRY-RUN COMPLETE — No changes were made.");
    console.log("  Run with --apply to execute.");
    console.log("══════════════════════════════════════════════════════════");
    return;
  }

  // ── 8. Apply ─────────────────────────────────────────────────────────────
  console.log("── Executing in prisma.$transaction() ──────────────────────");

  await prisma.$transaction(async (tx) => {
    // Step 1: AuditLog (all)
    const r1 = await tx.auditLog.deleteMany({ where: { clientId: cid } });
    console.log(`  ✓ AuditLog deleted: ${r1.count}`);

    // Step 2: DamageOccurrenceItem
    const r2 = await tx.damageOccurrenceItem.deleteMany({
      where: { occurrenceId: { in: demoOccurrenceIds } },
    });
    console.log(`  ✓ DamageOccurrenceItem deleted: ${r2.count}`);

    // Step 3: DamageOccurrence
    const r3 = await tx.damageOccurrence.deleteMany({
      where: { id: { in: demoOccurrenceIds } },
    });
    console.log(`  ✓ DamageOccurrence deleted: ${r3.count}`);

    // Step 4: ProductPrice (demo products only)
    const r4 = await tx.productPrice.deleteMany({
      where: { productId: { in: demoProductIds } },
    });
    console.log(`  ✓ ProductPrice deleted: ${r4.count}`);

    // Step 5: Product (demo only)
    const r5 = await tx.product.deleteMany({
      where: { id: { in: demoProductIds } },
    });
    console.log(`  ✓ Product deleted: ${r5.count}`);

    // Step 6: Inactive test users (now safe: their audit logs were deleted in step 1)
    const r6 = await tx.user.deleteMany({
      where: { clientId: cid, email: { in: DELETABLE_INACTIVE_USER_EMAILS } },
    });
    console.log(`  ✓ User (inactive) deleted: ${r6.count}`);

    // Guard: verify expected row counts
    if (r1.count !== auditLogIds.length) throw new Error(`AuditLog: expected ${auditLogIds.length}, got ${r1.count}`);
    if (r2.count !== demoItemIds.length) throw new Error(`Items: expected ${demoItemIds.length}, got ${r2.count}`);
    if (r3.count !== demoOccurrenceIds.length) throw new Error(`Occurrences: expected ${demoOccurrenceIds.length}, got ${r3.count}`);
    if (r4.count !== demoPriceIds.length) throw new Error(`Prices: expected ${demoPriceIds.length}, got ${r4.count}`);
    if (r5.count !== demoProductIds.length) throw new Error(`Products: expected ${demoProductIds.length}, got ${r5.count}`);
    if (r6.count !== deletableUsers.length) throw new Error(`Users: expected ${deletableUsers.length}, got ${r6.count}`);

    console.log("\n  ✓ All row counts match. Transaction will commit.");
  });

  console.log("\n── Transaction committed successfully ──────────────────────");

  // ── 9. Post-apply verification ───────────────────────────────────────────
  const [postOccs, postItems, postAudit, postProducts, postPrices, postUsers] = await Promise.all([
    prisma.damageOccurrence.count({ where: { clientId: cid } }),
    prisma.damageOccurrenceItem.count({ where: { clientId: cid } }),
    prisma.auditLog.count({ where: { clientId: cid } }),
    prisma.product.count({ where: { clientId: cid } }),
    prisma.productPrice.count({ where: { clientId: cid } }),
    prisma.user.count({ where: { clientId: cid } }),
  ]);

  const [postActiveUsers, postInactiveUsers] = await Promise.all([
    prisma.user.count({ where: { clientId: cid, active: true } }),
    prisma.user.count({ where: { clientId: cid, active: false } }),
  ]);

  const postDemoProducts = await prisma.product.count({
    where: { clientId: cid, internalCode: { in: DEMO_PRODUCT_CODES } },
  });

  const [postStatus, postOrigins, postDamageTypes, postDestinations] = await Promise.all([
    prisma.parameterStatus.count({ where: { clientId: cid } }),
    prisma.parameterOrigin.count({ where: { clientId: cid } }),
    prisma.parameterDamageType.count({ where: { clientId: cid } }),
    prisma.parameterDestination.count({ where: { clientId: cid } }),
  ]);

  const postAdminDemo = await prisma.user.findFirst({
    where: { clientId: cid, email: "admin@demo.com" },
  });

  console.log("\n── Post-apply verification ─────────────────────────────────");

  function verify(label: string, actual: number, expected: number) {
    const ok = actual === expected;
    console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}: ${actual} (expected ${expected})`);
    if (!ok) throw new Error(`Verification failed: ${label} = ${actual}, expected ${expected}`);
  }

  verify("DamageOccurrence", postOccs, 0);
  verify("DamageOccurrenceItem", postItems, 0);
  verify("AuditLog", postAudit, 0);
  verify("Demo products remaining", postDemoProducts, 0);
  verify("Real products remaining", postProducts, totalProducts - DEMO_PRODUCT_CODES.length);
  verify("ProductPrice remaining", postPrices, totalPrices - demoPriceIds.length);
  verify("Users total", postUsers, totalUsers - deletableUsers.length);
  verify("Users active", postActiveUsers, totalActiveUsers); // unchanged
  verify("Users inactive", postInactiveUsers, totalInactiveUsers - deletableUsers.length);
  verify("ParameterStatus", postStatus, totalStatus);
  verify("ParameterOrigin", postOrigins, totalOrigins);
  verify("ParameterDamageType", postDamageTypes, totalDamageTypes);
  verify("ParameterDestination", postDestinations, totalDestinations);

  if (!postAdminDemo || !postAdminDemo.active) {
    throw new Error("Admin Demo is not found or not active after cleanup!");
  }
  console.log(`  ✓ Admin Demo (admin@demo.com) active=${postAdminDemo.active}`);

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  ✅  APPLY COMPLETE — Database cleaned successfully.");
  console.log("══════════════════════════════════════════════════════════");
}

main()
  .catch((err) => {
    console.error("\n💥 Fatal error:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
