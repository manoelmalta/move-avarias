-- Add publicToken to DamageOccurrence for public label/QR code access.
-- Step 1: add as nullable to safely backfill 157 existing rows.
ALTER TABLE "DamageOccurrence" ADD COLUMN "publicToken" TEXT;

-- Step 2: populate existing rows with a unique random value (UUID v4).
UPDATE "DamageOccurrence" SET "publicToken" = gen_random_uuid()::TEXT WHERE "publicToken" IS NULL;

-- Step 3: enforce NOT NULL and UNIQUE constraints.
ALTER TABLE "DamageOccurrence" ALTER COLUMN "publicToken" SET NOT NULL;
CREATE UNIQUE INDEX "DamageOccurrence_publicToken_key" ON "DamageOccurrence"("publicToken");
