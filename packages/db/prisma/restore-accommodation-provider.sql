-- ==============================================================================
-- Jesmond 2.0 - Restore Original Accommodation Provider Account
-- Target User: allienshaurya@gmail.com (ID: 0b0ad15f-5c50-4801-a5be-ceef2df31e36)
-- Target Organization: Jesmond Demo Host (ID: 60c68f92-da28-4ac5-b3cf-72a28a2a7f33)
-- Purpose:
--   1. Restore Organization businessCategory from 'RETAIL' back to 'RENTALS'
--   2. Ensure Organization type remains 'PROVIDER'
--   3. Upsert OrgStaff membership linking user to organization with ADMIN role and ['*'] permissions
--   4. Clear any Retail branch association
--   5. Strictly preserve all existing properties, user credentials, and verification state
-- ==============================================================================

BEGIN;

-- 1. Restore Organization type and businessCategory
UPDATE "Organization"
SET "businessCategory" = 'RENTALS',
    "type" = 'PROVIDER',
    "updatedAt" = NOW()
WHERE "id" = '60c68f92-da28-4ac5-b3cf-72a28a2a7f33';

-- 2. Upsert OrgStaff membership for the Accommodation Provider owner
INSERT INTO "OrgStaff" (
  "id",
  "userId",
  "organizationId",
  "role",
  "permissions",
  "retailBranchId",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
VALUES (
  gen_random_uuid()::text,
  '0b0ad15f-5c50-4801-a5be-ceef2df31e36',
  '60c68f92-da28-4ac5-b3cf-72a28a2a7f33',
  'ADMIN',
  ARRAY['*']::text[],
  NULL,
  NOW(),
  NOW(),
  NULL
)
ON CONFLICT ("userId", "organizationId")
DO UPDATE SET
  "role" = 'ADMIN',
  "permissions" = ARRAY['*']::text[],
  "retailBranchId" = NULL,
  "deletedAt" = NULL,
  "updatedAt" = NOW();

COMMIT;
