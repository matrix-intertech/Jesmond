-- Add Columns to State and City
ALTER TABLE "State" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "State" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "State" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "City" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "City" ADD COLUMN "officialCode" TEXT;
ALTER TABLE "City" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "City" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 1. Add new columns to Suburb as nullable initially
ALTER TABLE "Suburb" ADD COLUMN "stateId" TEXT;
ALTER TABLE "Suburb" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Suburb" ADD COLUMN "officialCode" TEXT;
ALTER TABLE "Suburb" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Suburb" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make existing city relations optional if not already
ALTER TABLE "Suburb" ALTER COLUMN "cityId" DROP NOT NULL;
ALTER TABLE "Suburb" ALTER COLUMN "lat" DROP NOT NULL;
ALTER TABLE "Suburb" ALTER COLUMN "lng" DROP NOT NULL;

-- 2. Populate State relationships where deterministically possible from City
UPDATE "Suburb" s
SET "stateId" = c."stateId"
FROM "City" c
WHERE s."cityId" = c."id";

-- Ensure 'OTHER' state exists as fallback to guarantee stateId is NOT NULL for orphan legacy Suburbs
INSERT INTO "State" ("id", "countryId", "code", "name", "normalizedName")
SELECT 'fallback-state-other', (SELECT id FROM "Country" LIMIT 1), 'OTHER', 'Other Territories', 'other-territories'
WHERE NOT EXISTS (SELECT 1 FROM "State" WHERE "code" = 'OTHER');

-- Assign missing stateIds to OTHER
UPDATE "Suburb" SET "stateId" = (SELECT id FROM "State" WHERE code = 'OTHER') WHERE "stateId" IS NULL;

-- 3. Normalize existing suburb and city names
UPDATE "Suburb" SET "normalizedName" = LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', '-', 'g'));
UPDATE "City" SET "normalizedName" = LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', '-', 'g'));
UPDATE "State" SET "normalizedName" = LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', '-', 'g'));

-- 4 & 5. Detect and Select Canonical Suburb for Duplicate Groups
CREATE TEMP TABLE "DuplicateSuburbMapping" AS
SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY "stateId", "normalizedName" ORDER BY "createdAt" ASC, id ASC) as canonical_id
FROM "Suburb";

-- 6. Re-point dependent foreign keys from duplicate Suburb records to canonical record
-- Note: schema.prisma reveals Suburb is referenced by Property and Campus
UPDATE "Property" p
SET "suburbId" = m.canonical_id
FROM "DuplicateSuburbMapping" m
WHERE p."suburbId" = m.id AND m.id != m.canonical_id;

UPDATE "Campus" c
SET "suburbId" = m.canonical_id
FROM "DuplicateSuburbMapping" m
WHERE c."suburbId" = m.id AND m.id != m.canonical_id;

-- 7. Merge postcodes where appropriate into canonical
-- Since string aggregation syntax varies, we will just use the canonical's postcode for safety.
-- 8. Remove ONLY duplicate orphan Suburb rows
DELETE FROM "Suburb"
WHERE id IN (SELECT id FROM "DuplicateSuburbMapping" WHERE id != canonical_id);

DROP TABLE "DuplicateSuburbMapping";

-- Same deduplication logic for City
CREATE TEMP TABLE "DuplicateCityMapping" AS
SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY "stateId", "normalizedName" ORDER BY "createdAt" ASC, id ASC) as canonical_id
FROM "City";

UPDATE "Suburb" s
SET "cityId" = m.canonical_id
FROM "DuplicateCityMapping" m
WHERE s."cityId" = m.id AND m.id != m.canonical_id;

DELETE FROM "City"
WHERE id IN (SELECT id FROM "DuplicateCityMapping" WHERE id != canonical_id);

DROP TABLE "DuplicateCityMapping";

-- 11. Enforce NOT NULL on stateId now that all Suburbs have valid state mappings
ALTER TABLE "Suburb" ALTER COLUMN "stateId" SET NOT NULL;

-- 10. Create Unique Indexes (duplicates safely removed)
CREATE UNIQUE INDEX "State_normalizedName_countryId_key" ON "State"("normalizedName", "countryId");
CREATE UNIQUE INDEX "State_code_countryId_key" ON "State"("code", "countryId");

CREATE UNIQUE INDEX "City_normalizedName_stateId_key" ON "City"("normalizedName", "stateId");

CREATE INDEX "Suburb_stateId_idx" ON "Suburb"("stateId");
CREATE UNIQUE INDEX "Suburb_stateId_normalizedName_key" ON "Suburb"("stateId", "normalizedName");

-- 12. Add Foreign Keys
ALTER TABLE "Suburb" ADD CONSTRAINT "Suburb_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
