-- ============================================================================
-- JESMOND BUSINESS CREDENTIALS: PRODUCTION INITIALIZATION SQL
-- ============================================================================
-- Fully idempotent: safe to run multiple times without duplicate key violations
-- or data loss. Does NOT drop or alter existing data.
-- ============================================================================

-- 1. UPSERT ALL 12 STATUTORY CREDENTIAL TYPES
INSERT INTO "CredentialType" (
  "id", "code", "name", "description", "category", "issuer", "jurisdiction",
  "requiresDocument", "requiresExpiryDate", "requiresNumber", "numberPattern",
  "isPublic", "createdAt", "updatedAt"
)
VALUES
  (gen_random_uuid(), 'ABN', 'Australian Business Number', 'Official 11-digit Australian Business Number registered with the Australian Business Register (ABR)', NULL, 'Australian Business Register', 'ALL', false, false, true, '^\d{11}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'NSW_MVRL', 'Motor Vehicle Repairer Licence', 'Statutory repairer licence issued by NSW Fair Trading under the Motor Dealers and Repairers Act 2013', 'MECHANICS'::"BusinessCategory", 'NSW Fair Trading', 'NSW', true, true, true, '^(MVRL\d{4,6}|\d{5,8})$', true, NOW(), NOW()),
  (gen_random_uuid(), 'VIC_LVT', 'Licensed Vehicle Tester Licence', 'Authorisation to issue Certificates of Roadworthiness under VicRoads', 'MECHANICS'::"BusinessCategory", 'VicRoads', 'VIC', true, true, true, '^[A-Z0-9-]{4,12}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'QLD_AIS', 'Approved Inspection Station Approval', 'Approval to conduct safety inspections and issue Safety Certificates under Queensland Department of Transport and Main Roads', 'MECHANICS'::"BusinessCategory", 'Queensland Department of Transport and Main Roads', 'QLD', true, true, true, '^[A-Z0-9-]{4,12}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'WA_MRB', 'Motor Vehicle Repair Business Licence', 'Business licence issued under the Motor Vehicle Repairers Act 2003 by WA Consumer Protection', 'MECHANICS'::"BusinessCategory", 'WA Department of Mines, Industry Regulation and Safety', 'WA', true, true, true, '^MRB\d{3,6}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'ARCTICK', 'ARCtick Refrigerant Handling Licence', 'National refrigerant trading authorisation or handling licence under the Ozone Protection and Synthetic Greenhouse Gas Management Act 1989', 'MECHANICS'::"BusinessCategory", 'Australian Refrigeration Council (ARC)', 'ALL', true, true, true, '^(L|AU)\d{5,8}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'ECL_CONTRACTOR', 'Electrical Contractor Licence', 'State-issued contractor licence permitting electrical wiring and installation services', 'SERVICES'::"BusinessCategory", 'State Electrical Safety Authority', 'ALL', true, true, true, '^[A-Z0-9-]{4,12}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'PLUMBING_CONTRACTOR', 'Plumbing Contractor Licence', 'State-issued licence permitting plumbing, drainage and gasfitting services', 'SERVICES'::"BusinessCategory", 'State Plumbing Licensing Board', 'ALL', true, true, true, '^[A-Z0-9-]{4,12}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'FOOD_NOTIF', 'Council Food Business Notification', 'Notification or registration of food premises under the relevant State Food Act with the local municipal council', 'FOOD'::"BusinessCategory", 'Local Municipal Council', 'ALL', true, false, false, NULL, false, NOW(), NOW()),
  (gen_random_uuid(), 'FOOD_FSS', 'Food Safety Supervisor Certificate', 'Statement of Attainment from an approved RTO for food safety supervision in hospitality / food processing', 'FOOD'::"BusinessCategory", 'State Food Authority / Registered Training Organisation', 'ALL', true, true, true, '^[A-Z0-9-]{4,20}$', false, NOW(), NOW()),
  (gen_random_uuid(), 'SECOND_HAND_DEALER', 'Pawnbrokers & Second-Hand Dealers Licence', 'Statutory licence for businesses purchasing or selling second-hand goods', 'RETAIL'::"BusinessCategory", 'State Fair Trading / Police Licensing', 'ALL', true, true, true, '^[A-Z0-9-]{4,12}$', true, NOW(), NOW()),
  (gen_random_uuid(), 'REAL_ESTATE_CORP', 'Real Estate Corporation Licence', 'Corporation licence to conduct real estate agency, leasing and property management', 'RENTALS'::"BusinessCategory", 'State Fair Trading / Consumer Affairs', 'ALL', true, true, true, '^[A-Z0-9-]{4,12}$', true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "issuer" = EXCLUDED."issuer",
  "jurisdiction" = EXCLUDED."jurisdiction",
  "requiresDocument" = EXCLUDED."requiresDocument",
  "requiresExpiryDate" = EXCLUDED."requiresExpiryDate",
  "requiresNumber" = EXCLUDED."requiresNumber",
  "numberPattern" = EXCLUDED."numberPattern",
  "isPublic" = EXCLUDED."isPublic",
  "updatedAt" = NOW();

-- 2. INSERT ALL 16 STATUTORY CREDENTIAL REQUIREMENTS (IF NOT ALREADY PRESENT)
INSERT INTO "CredentialRequirement" ("id", "credentialTypeId", "businessCategory", "serviceName", "state", "isMandatory", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  ct.id,
  r.category,
  r.service,
  r.state,
  r.mandatory,
  NOW(),
  NOW()
FROM (
  VALUES
    -- Universal ABN across all categories
    ('ABN', 'RETAIL'::"BusinessCategory", NULL::text, NULL::text, true),
    ('ABN', 'FOOD'::"BusinessCategory", NULL::text, NULL::text, true),
    ('ABN', 'MECHANICS'::"BusinessCategory", NULL::text, NULL::text, true),
    ('ABN', 'SERVICES'::"BusinessCategory", NULL::text, NULL::text, true),
    ('ABN', 'RENTALS'::"BusinessCategory", NULL::text, NULL::text, true),
    -- Mechanics
    ('NSW_MVRL', 'MECHANICS'::"BusinessCategory", NULL::text, 'NSW'::text, true),
    ('VIC_LVT', 'MECHANICS'::"BusinessCategory", 'roadworthy-inspection'::text, 'VIC'::text, true),
    ('QLD_AIS', 'MECHANICS'::"BusinessCategory", 'safety-certificate'::text, 'QLD'::text, true),
    ('WA_MRB', 'MECHANICS'::"BusinessCategory", NULL::text, 'WA'::text, true),
    ('ARCTICK', 'MECHANICS'::"BusinessCategory", 'air-conditioning'::text, NULL::text, true),
    -- Services / Tradies
    ('ECL_CONTRACTOR', 'SERVICES'::"BusinessCategory", 'electrical'::text, NULL::text, true),
    ('PLUMBING_CONTRACTOR', 'SERVICES'::"BusinessCategory", 'plumbing'::text, NULL::text, true),
    -- Food
    ('FOOD_NOTIF', 'FOOD'::"BusinessCategory", NULL::text, NULL::text, true),
    ('FOOD_FSS', 'FOOD'::"BusinessCategory", 'ready-to-eat'::text, NULL::text, true),
    -- Retail Regulated
    ('SECOND_HAND_DEALER', 'RETAIL'::"BusinessCategory", 'second-hand'::text, NULL::text, true),
    -- Rentals Regulated
    ('REAL_ESTATE_CORP', 'RENTALS'::"BusinessCategory", 'property-management'::text, NULL::text, true)
) AS r(code, category, service, state, mandatory)
JOIN "CredentialType" ct ON ct.code = r.code
WHERE NOT EXISTS (
  SELECT 1 FROM "CredentialRequirement" cr
  WHERE cr."credentialTypeId" = ct.id
    AND cr."businessCategory" = r.category
    AND (cr."serviceName" = r.service OR (cr."serviceName" IS NULL AND r.service IS NULL))
    AND (cr."state" = r.state OR (cr."state" IS NULL AND r.state IS NULL))
);

-- 3. BACKFILL BusinessProfileCompletion FOR EXISTING ORGANIZATIONS
INSERT INTO "BusinessProfileCompletion" (
  "id", "organizationId", "isCompleted", "currentStep", "overallStatus", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  o.id,
  false,
  1,
  'NOT_SUBMITTED'::"BusinessVerificationStatus",
  NOW(),
  NOW()
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "BusinessProfileCompletion" bpc WHERE bpc."organizationId" = o.id
);
