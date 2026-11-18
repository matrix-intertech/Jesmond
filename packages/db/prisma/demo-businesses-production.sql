-- =============================================================================
-- Jesmond 2.0 — Production Demo Businesses Data Migration
-- Safe, Hardened, Idempotent Seeding for Production Accounts
--
-- TARGET ACCOUNTS:
-- 1. shikharshaurya.01@gmail.com -> RETAIL    -> /portal/retail
-- 2. demo.services@jesmond.com.au -> SERVICES  -> /portal/business/appointments
-- 3. demo.mechanics@jesmond.com.au -> MECHANICS -> /portal/business/appointments
--
-- EXECUTION SAFETY & DATA PRESERVATION RULES:
-- 1. Organisation Identity:
--    - Verifies deterministic IDs against expected name, type, and business category.
--    - Aborts if an existing ID belongs to an unexpected organisation.
--    - Aborts if another organisation with the demo name exists under a different ID.
-- 2. Branch Identity & Address Hygiene:
--    - Verifies branch IDs belong strictly to the expected organisation.
--    - Aborts if a branch ID belongs to another organisation.
--    - Aborts on ambiguous branch identity (multiple matches or conflicting orgs).
--    - Never reuses a branch belonging to another organisation.
--    - Leaves public addresses unset (NULL) to prevent fictitious physical addresses.
--    - Preserves existing branch active/inactive status (does NOT reactivate inactive branches).
-- 3. Accounts & Memberships:
--    - Verifies exactly one matching User record exists per target email; aborts on duplicate users.
--    - Verifies account role is ORG_STAFF and accountStatus is ACTIVE.
--    - Checks both active AND soft-deleted OrgStaff memberships for unrelated orgs (aborts on conflict).
--    - Never silently reactivates or reassigns an unrelated membership.
--    - Preserves existing credentials, account status, email verification, tokens, and custom permissions.
-- 4. Retail Products & Inventory:
--    - Inserts only missing products (ON CONFLICT DO NOTHING).
--    - Never overwrites existing product prices, tax rates, descriptions, active status or categories.
--    - Never reactivates intentionally disabled products.
--    - Preserves existing inventory quantities and reorder thresholds (ON CONFLICT DO NOTHING).
-- 5. Branches & Terminals:
--    - Dedicated manual cash-only register (provider: NULL, providerTerminalId: NULL, status: ONLINE).
--    - Guarantees DEMO-REG-01 is unique and does not collide with terminals on other branches.
--    - Aborts if a terminal is linked to a real payment gateway (Stripe/Tyro/Square/Zeller).
--    - Never modifies existing terminal provider, status, or external ID.
-- 6. Services & Mechanics:
--    - Inserts only missing demo services (never overwrites existing prices or durations).
--    - Never reactivates soft-deleted services (preserves deletedAt).
--    - Never reactivates intentionally disabled services (preserves isActive).
--    - Preserves existing staff working hours and service assignments.
--    - Explicit least-privilege permission model without wildcards (*).
-- =============================================================================

DO $$
DECLARE
  -- Verification helpers
  v_org_name TEXT;
  v_org_type "OrgType";
  v_org_cat "BusinessCategory";
  v_branch_org_id TEXT;
  v_branch_name TEXT;
  v_branch_count INT;
  v_found_branch_id TEXT;
  v_existing_org_id TEXT;
  v_user_count INT;
  v_user_role "UserRole";
  v_user_status "AccountStatus";
  v_terminal_id TEXT;
  v_terminal_provider TEXT;
  v_terminal_prov_id TEXT;

  -- 1. Retail
  v_retail_user_id TEXT;
  v_retail_org_id CONSTANT TEXT := '14f9a57a-a209-4e8e-b4f6-4ed86d5f86fb';
  v_retail_branch_id TEXT := '2772e0a5-12d5-4703-85ff-512e4133a02e';
  v_retail_staff_id TEXT;
  v_retail_perms TEXT[];
  v_retail_cat_elec TEXT;
  v_retail_cat_home TEXT;
  v_retail_cat_care TEXT;
  v_retail_cat_stat TEXT;
  v_retail_cat_groc TEXT;
  v_prod_id TEXT;

  -- 2. Services
  v_services_user_id TEXT;
  v_services_org_id CONSTANT TEXT := '17107a98-09a9-4c45-b96f-841f68927873';
  v_services_branch_id TEXT := '3f569eb4-c9ab-4fa6-a700-f5f756f59c26';
  v_services_staff_id TEXT;
  v_business_perms TEXT[];
  v_serv_cat_clean TEXT;
  v_serv_cat_plumb TEXT;
  v_serv_cat_handy TEXT;
  v_serv_id TEXT;

  -- 3. Mechanics
  v_mechanics_user_id TEXT;
  v_mechanics_org_id CONSTANT TEXT := 'f08719e3-a091-43ee-93c7-534a118a9d1b';
  v_mechanics_branch_id TEXT := '78566d7c-f2b5-449b-81a2-640a22db05e1';
  v_mechanics_staff_id TEXT;
  v_mech_cat_diag TEXT;
  v_mech_cat_brake TEXT;
  v_mech_cat_eng TEXT;
  v_mech_id TEXT;

  v_day INT;
BEGIN
  RAISE NOTICE 'Starting Jesmond 2.0 Hardened Demo Businesses Production Seeding...';

  -- Least-privilege permission sets:
  -- Strictly operational permissions. Unnecessary employee, branch, or terminal management omitted. Zero wildcards.
  v_retail_perms := ARRAY[
    'RETAIL_DASHBOARD_VIEW',
    'ORDERS_VIEW',
    'ORDERS_MANAGE',
    'CUSTOMERS_VIEW',
    'CUSTOMERS_MANAGE',
    'INVENTORY_VIEW',
    'INVENTORY_ADJUST',
    'CATALOG_VIEW',
    'CATALOG_MANAGE',
    'POS_VIEW',
    'POS_USE',
    'TERMINALS_VIEW',
    'BRANCH_VIEW',
    'RETAIL_SETTINGS_VIEW',
    'RETAIL_SETTINGS_MANAGE'
  ]::text[];

  v_business_perms := ARRAY[
    'APPOINTMENTS_VIEW',
    'APPOINTMENTS_MANAGE',
    'SERVICES_VIEW',
    'SERVICES_MANAGE',
    'AVAILABILITY_VIEW',
    'AVAILABILITY_MANAGE',
    'CUSTOMERS_VIEW',
    'CUSTOMERS_MANAGE',
    'BRANCH_VIEW',
    'BUSINESS_SETTINGS_VIEW',
    'BUSINESS_SETTINGS_MANAGE'
  ]::text[];

  -- ===========================================================================
  -- 1. RETAIL STORE: shikharshaurya.01@gmail.com
  -- ===========================================================================
  -- Require exactly one matching User record; abort on duplicate or ambiguous users
  SELECT count(*) INTO v_user_count
  FROM "User" WHERE LOWER(email) = LOWER('shikharshaurya.01@gmail.com');

  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'Target user % does not exist in User table.', 'shikharshaurya.01@gmail.com';
  ELSIF v_user_count > 1 THEN
    RAISE EXCEPTION 'Ambiguous user identity: % users found with email %. Aborting to prevent security breach.',
      v_user_count, 'shikharshaurya.01@gmail.com';
  END IF;

  SELECT id, role, "accountStatus" INTO v_retail_user_id, v_user_role, v_user_status
  FROM "User" WHERE LOWER(email) = LOWER('shikharshaurya.01@gmail.com');

  IF v_user_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Target user % account status is "%" (expected "ACTIVE").', 'shikharshaurya.01@gmail.com', v_user_status;
  END IF;

  IF v_user_role != 'ORG_STAFF' THEN
    RAISE EXCEPTION 'Target user % account role is "%" (expected "ORG_STAFF").', 'shikharshaurya.01@gmail.com', v_user_role;
  END IF;

  RAISE NOTICE 'Verified Retail user: % (%)', v_retail_user_id, v_user_status;

  -- Check both active and soft-deleted OrgStaff memberships for unrelated organizations
  SELECT "organizationId" INTO v_existing_org_id
  FROM "OrgStaff"
  WHERE "userId" = v_retail_user_id AND "organizationId" != v_retail_org_id
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Account % is associated with unrelated organisation ID: % (active or soft-deleted). Aborting to prevent data corruption.',
      'shikharshaurya.01@gmail.com', v_existing_org_id;
  END IF;

  -- Verify deterministic organisation ID against expected organisation name, type and business category
  SELECT name, type, "businessCategory" INTO v_org_name, v_org_type, v_org_cat
  FROM "Organization" WHERE id = v_retail_org_id;

  IF v_org_name IS NOT NULL THEN
    IF v_org_name != 'Jesmond Demo Retail Store' OR v_org_type != 'RETAIL' OR v_org_cat != 'RETAIL' THEN
      RAISE EXCEPTION 'Deterministic Organization ID % belongs to unexpected organization (name: "%", type: %, category: %). Expected "Jesmond Demo Retail Store"/RETAIL/RETAIL.',
        v_retail_org_id, v_org_name, v_org_type, v_org_cat;
    END IF;

    -- Ensure public visibility is enabled; preserve existing approval/verification status
    UPDATE "Organization"
    SET "isPubliclyVisible" = true,
        "updatedAt" = NOW()
    WHERE id = v_retail_org_id;
  ELSE
    IF EXISTS (SELECT 1 FROM "Organization" WHERE name = 'Jesmond Demo Retail Store' AND id != v_retail_org_id) THEN
      RAISE EXCEPTION 'An organization named "Jesmond Demo Retail Store" exists with a different ID. Aborting.';
    END IF;

    INSERT INTO "Organization" (id, name, type, "businessCategory", status, "isPubliclyVisible", timezone, "createdAt", "updatedAt")
    VALUES (v_retail_org_id, 'Jesmond Demo Retail Store', 'RETAIL', 'RETAIL', 'PENDING', true, 'Australia/Sydney', NOW(), NOW());
  END IF;

  -- Verify deterministic branch ID and ensure no ambiguous identity
  SELECT "organizationId", name INTO v_branch_org_id, v_branch_name
  FROM "RetailBranch" WHERE id = v_retail_branch_id;

  IF v_branch_org_id IS NOT NULL THEN
    IF v_branch_org_id != v_retail_org_id THEN
      RAISE EXCEPTION 'Deterministic Branch ID % belongs to unrelated organization %. Expected %.',
        v_retail_branch_id, v_branch_org_id, v_retail_org_id;
    END IF;
  ELSE
    SELECT count(*) INTO v_branch_count
    FROM "RetailBranch"
    WHERE "organizationId" = v_retail_org_id AND name = 'Jesmond Demo Retail Store - Main Branch';

    IF v_branch_count > 1 THEN
      RAISE EXCEPTION 'Ambiguous branch identity: % branches found with name "Jesmond Demo Retail Store - Main Branch" under organization %.',
        v_branch_count, v_retail_org_id;
    ELSIF v_branch_count = 1 THEN
      SELECT id INTO v_found_branch_id
      FROM "RetailBranch"
      WHERE "organizationId" = v_retail_org_id AND name = 'Jesmond Demo Retail Store - Main Branch';
      v_retail_branch_id := v_found_branch_id;
    ELSE
      IF EXISTS (SELECT 1 FROM "RetailBranch" WHERE name = 'Jesmond Demo Retail Store - Main Branch' AND "organizationId" != v_retail_org_id) THEN
        RAISE EXCEPTION 'A branch named "Jesmond Demo Retail Store - Main Branch" belongs to another organisation. Never reuse a branch belonging to another organisation.';
      END IF;

      -- Insert missing branch: address left unset (NULL) to avoid unverified physical addresses
      INSERT INTO "RetailBranch" (id, "organizationId", name, address, "isActive", "createdAt", "updatedAt")
      VALUES (v_retail_branch_id, v_retail_org_id, 'Jesmond Demo Retail Store - Main Branch', NULL, true, NOW(), NOW());
    END IF;
  END IF;

  -- Preserve existing branch active status (do NOT reactivate an inactive branch; leave address unchanged)
  UPDATE "RetailBranch"
  SET "updatedAt" = NOW()
  WHERE id = v_retail_branch_id;

  -- Upsert OrgStaff: Preserve existing permissions if membership already exists
  SELECT id INTO v_retail_staff_id FROM "OrgStaff" WHERE "userId" = v_retail_user_id AND "organizationId" = v_retail_org_id LIMIT 1;
  IF v_retail_staff_id IS NULL THEN
    v_retail_staff_id := gen_random_uuid()::text;
    INSERT INTO "OrgStaff" (id, "userId", "organizationId", role, permissions, "retailBranchId", "createdAt", "updatedAt")
    VALUES (
      v_retail_staff_id,
      v_retail_user_id,
      v_retail_org_id,
      'ORG_STAFF',
      v_retail_perms,
      v_retail_branch_id,
      NOW(),
      NOW()
    );
  ELSE
    -- Preserve existing permissions on existing membership; update branch link only if null
    UPDATE "OrgStaff"
    SET "retailBranchId" = COALESCE("retailBranchId", v_retail_branch_id),
        "updatedAt" = NOW()
    WHERE id = v_retail_staff_id;
  END IF;

  -- PosTerminal Isolation: Ensure DEMO-REG-01 does NOT collide with another branch
  IF EXISTS (SELECT 1 FROM "PosTerminal" WHERE "externalId" = 'DEMO-REG-01' AND "branchId" != v_retail_branch_id) THEN
    RAISE EXCEPTION 'POS Terminal externalId "DEMO-REG-01" belongs to an unrelated branch. Aborting to prevent terminal collision.';
  END IF;

  -- Check existing terminal configuration on target branch
  SELECT id, provider, "providerTerminalId" INTO v_terminal_id, v_terminal_provider, v_terminal_prov_id
  FROM "PosTerminal"
  WHERE "branchId" = v_retail_branch_id
    AND ("externalId" = 'DEMO-REG-01' OR name = 'Demo Cash Register - Counter 1');

  IF v_terminal_id IS NOT NULL AND (v_terminal_provider IS NOT NULL OR v_terminal_prov_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Existing demo terminal ID % is configured with a real payment provider (%). Aborting to prevent tampering with payment gateway.',
      v_terminal_id, v_terminal_provider;
  END IF;

  IF v_terminal_id IS NULL THEN
    INSERT INTO "PosTerminal" (id, "branchId", name, "displayName", status, provider, "providerTerminalId", "externalId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, v_retail_branch_id, 'Demo Cash Register - Counter 1', 'Demo Cash Register', 'ONLINE', NULL, NULL, 'DEMO-REG-01', NOW(), NOW());
    RAISE NOTICE 'Created new dedicated manual cash register terminal.';
  ELSE
    RAISE NOTICE 'Demo manual cash terminal already exists (ID: %). Preserving configuration.', v_terminal_id;
  END IF;

  -- Product Categories (Insert only missing categories)
  SELECT id INTO v_retail_cat_elec FROM "ProductCategory" WHERE "organizationId" = v_retail_org_id AND name = 'Electronics & Accessories' LIMIT 1;
  IF v_retail_cat_elec IS NULL THEN
    v_retail_cat_elec := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_retail_cat_elec, v_retail_org_id, 'Electronics & Accessories', 'Cables, chargers, audio and mobile tech accessories', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_retail_cat_home FROM "ProductCategory" WHERE "organizationId" = v_retail_org_id AND name = 'Home Essentials' LIMIT 1;
  IF v_retail_cat_home IS NULL THEN
    v_retail_cat_home := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_retail_cat_home, v_retail_org_id, 'Home Essentials', 'Household cleaning supplies, kitchenware and home decor', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_retail_cat_care FROM "ProductCategory" WHERE "organizationId" = v_retail_org_id AND name = 'Personal Care' LIMIT 1;
  IF v_retail_cat_care IS NULL THEN
    v_retail_cat_care := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_retail_cat_care, v_retail_org_id, 'Personal Care', 'Everyday grooming, skin care, oral health and wellness', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_retail_cat_stat FROM "ProductCategory" WHERE "organizationId" = v_retail_org_id AND name = 'Stationery & Office' LIMIT 1;
  IF v_retail_cat_stat IS NULL THEN
    v_retail_cat_stat := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_retail_cat_stat, v_retail_org_id, 'Stationery & Office', 'Notebooks, pens, desk organizers and study supplies', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_retail_cat_groc FROM "ProductCategory" WHERE "organizationId" = v_retail_org_id AND name = 'Grocery & Packaged Goods' LIMIT 1;
  IF v_retail_cat_groc IS NULL THEN
    v_retail_cat_groc := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_retail_cat_groc, v_retail_org_id, 'Grocery & Packaged Goods', 'Snacks, beverages, coffee and shelf-stable pantry items', true, NOW(), NOW());
  END IF;

  -- Products Helper Block
  CREATE TEMP TABLE IF NOT EXISTS tmp_retail_products (
    cat_id TEXT, sku TEXT, barcode TEXT, name TEXT, description TEXT,
    selling_price INT, cost_price INT, tax_rate FLOAT, unit TEXT,
    stock_qty INT, reorder_thresh INT, image_url TEXT
  ) ON COMMIT DROP;

  TRUNCATE tmp_retail_products;

  INSERT INTO tmp_retail_products VALUES
    (v_retail_cat_elec, 'ELEC-CBL-001', '9312345001014', 'USB-C to Lightning Braided Cable 1.5m', 'Durable nylon braided high-speed sync and charge cable, MFi certified.', 1999, 850, 0.10, 'piece', 45, 10, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_elec, 'ELEC-CHG-002', '9312345001021', '65W GaN Dual USB-C Fast Charger', 'Ultra-compact Gallium Nitride wall charger with dual power delivery ports.', 4495, 2200, 0.10, 'piece', 25, 5, 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_elec, 'ELEC-EAR-003', '9312345001038', 'Wireless Bluetooth Earbuds Pro', 'Active noise-cancelling in-ear headphones with 28-hour battery case.', 8900, 4500, 0.10, 'piece', 15, 5, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_elec, 'ELEC-MNT-004', '9312345001045', 'Magnetic Phone Car Mount Holder', 'Air-vent 360-degree rotating strong magnetic phone holder.', 2450, 1000, 0.10, 'piece', 3, 5, 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_home, 'HOME-BAM-001', '9312345002011', 'Eco Bamboo Fiber Cutting Board Set', 'Organic sustainably sourced bamboo chopping board set of 3 with juice groove.', 2999, 1200, 0.10, 'set', 30, 8, 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_home, 'HOME-BOT-002', '9312345002028', 'Stainless Steel Insulated Water Bottle 750ml', 'Double-wall vacuum insulation keeping drinks cold for 24h or hot for 12h.', 2250, 950, 0.10, 'piece', 40, 10, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_home, 'HOME-CLO-003', '9312345002035', 'Microfiber Multi-Surface Cleaning Cloths (6-Pack)', 'Lint-free, scratch-free ultra-absorbent reusable cleaning cloths.', 1499, 550, 0.10, 'pack', 50, 15, 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_home, 'HOME-GLS-004', '9312345002042', 'Glass Meal Prep Containers (4-Pack Airtight)', 'Borosilicate oven-safe glass containers with locking BPA-free lids.', 3800, 1800, 0.10, 'pack', 0, 5, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_care, 'CARE-WSH-001', '9312345003018', 'Australian Botanical Hand Wash 500ml', 'Gentle natural cleansing formulation with eucalyptus and lavender essential oils.', 1295, 480, 0.10, 'bottle', 35, 10, 'https://images.unsplash.com/photo-1608248597359-5489f7831f24?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_care, 'CARE-SHP-002', '9312345003025', 'Organic Tea Tree Shampoo & Conditioner Set', 'Sulphate-free purifying scalp care set with Australian tea tree extract.', 2850, 1250, 0.10, 'set', 20, 5, 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_care, 'CARE-SUN-003', '9312345003032', 'Natural Mineral Sunscreen SPF 50+ 200ml', 'Broad-spectrum zinc oxide sun protection, 4 hours water-resistant, reef-safe.', 1899, 750, 0.10, 'tube', 4, 8, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_care, 'CARE-TB-004', '9312345003049', 'Bamboo Charcoal Toothbrush (Pack of 4)', 'Biodegradable ergonomic bamboo handle with activated charcoal soft bristles.', 999, 300, 0.10, 'pack', 60, 15, 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_stat, 'STAT-JRN-001', '9312345004015', 'A5 Hardcover Dotted Journal Notebook', '160gsm bleed-proof paper, lay-flat thread binding, elastic closure, inner pocket.', 1650, 600, 0.10, 'piece', 40, 10, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_stat, 'STAT-PEN-002', '9312345004022', 'Gel Roller Pens 0.5mm Black (Pack of 5)', 'Quick-drying smudge-resistant pigment ink fine-point pens.', 850, 320, 0.10, 'pack', 55, 12, 'https://images.unsplash.com/photo-1585336261026-c2a41f6c7717?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_stat, 'STAT-LPT-003', '9312345004039', 'Aluminum Ergonomic Laptop Stand', 'Foldable portable riser with heat dissipation vents, supports up to 17-inch devices.', 4200, 1900, 0.10, 'piece', 12, 4, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_groc, 'GROC-COF-001', '9312345005012', 'Artisan Roasted Coffee Beans 500g (Jesmond Blend)', 'Locally roasted 100% Arabica specialty blend with notes of chocolate and hazelnut.', 2100, 950, 0.00, 'bag', 30, 8, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_groc, 'GROC-MAC-002', '9312345005029', 'Roasted Salted Australian Macadamias 250g', 'Locally grown Australian macadamia nuts, dry roasted with Murray River pink salt.', 1450, 700, 0.00, 'bag', 2, 6, 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80'),
    (v_retail_cat_groc, 'GROC-WTR-003', '9312345005036', 'Sparkling Natural Mineral Water 750ml', 'Bottled at the source in pristine Australian highlands, crisp effervescence.', 450, 180, 0.10, 'bottle', 80, 20, 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80');

  FOR v_prod_id IN SELECT sku FROM tmp_retail_products LOOP
    -- Insert ONLY missing demo products (DO NOT overwrite existing price, description, active status, taxRate, or category)
    INSERT INTO "Product" (
      id, "organizationId", "categoryId", sku, barcode, name, description,
      "sellingPrice", "costPrice", "taxRate", unit, "imageUrl", "isActive",
      "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid()::text, v_retail_org_id, t.cat_id, t.sku, t.barcode, t.name, t.description,
      t.selling_price, t.cost_price, t.tax_rate, t.unit, t.image_url, true, NOW(), NOW()
    FROM tmp_retail_products t WHERE t.sku = v_prod_id
    ON CONFLICT ("organizationId", sku) DO NOTHING;

    -- Upsert Inventory: insert ONLY missing records (DO NOT overwrite live inventory quantity or reorder threshold)
    INSERT INTO "Inventory" (id, "branchId", "productId", quantity, "reorderThreshold", "updatedAt")
    SELECT
      gen_random_uuid()::text, v_retail_branch_id, p.id, t.stock_qty, t.reorder_thresh, NOW()
    FROM "Product" p
    JOIN tmp_retail_products t ON t.sku = p.sku AND p."organizationId" = v_retail_org_id
    WHERE p.sku = v_prod_id
    ON CONFLICT ("branchId", "productId") DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Retail products and inventory verified.';

  -- ===========================================================================
  -- 2. SERVICES: demo.services@jesmond.com.au
  -- ===========================================================================
  SELECT count(*) INTO v_user_count
  FROM "User" WHERE LOWER(email) = LOWER('demo.services@jesmond.com.au');

  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'Target user % does not exist in User table.', 'demo.services@jesmond.com.au';
  ELSIF v_user_count > 1 THEN
    RAISE EXCEPTION 'Ambiguous user identity: % users found with email %. Aborting to prevent security breach.',
      v_user_count, 'demo.services@jesmond.com.au';
  END IF;

  SELECT id, role, "accountStatus" INTO v_services_user_id, v_user_role, v_user_status
  FROM "User" WHERE LOWER(email) = LOWER('demo.services@jesmond.com.au');

  IF v_user_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Target user % account status is "%" (expected "ACTIVE").', 'demo.services@jesmond.com.au', v_user_status;
  END IF;

  IF v_user_role != 'ORG_STAFF' THEN
    RAISE EXCEPTION 'Target user % account role is "%" (expected "ORG_STAFF").', 'demo.services@jesmond.com.au', v_user_role;
  END IF;

  RAISE NOTICE 'Verified Services user: % (%)', v_services_user_id, v_user_status;

  -- Check both active and soft-deleted OrgStaff memberships for unrelated organizations
  SELECT "organizationId" INTO v_existing_org_id
  FROM "OrgStaff"
  WHERE "userId" = v_services_user_id AND "organizationId" != v_services_org_id
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Account % is associated with unrelated organisation ID: % (active or soft-deleted). Aborting to prevent data corruption.',
      'demo.services@jesmond.com.au', v_existing_org_id;
  END IF;

  -- Verify deterministic organisation ID against expected organisation name, type and business category
  SELECT name, type, "businessCategory" INTO v_org_name, v_org_type, v_org_cat
  FROM "Organization" WHERE id = v_services_org_id;

  IF v_org_name IS NOT NULL THEN
    IF v_org_name != 'Jesmond Demo Services' OR v_org_type != 'RETAIL' OR v_org_cat != 'SERVICES' THEN
      RAISE EXCEPTION 'Deterministic Organization ID % belongs to unexpected organization (name: "%", type: %, category: %). Expected "Jesmond Demo Services"/RETAIL/SERVICES.',
        v_services_org_id, v_org_name, v_org_type, v_org_cat;
    END IF;

    UPDATE "Organization"
    SET "isPubliclyVisible" = true,
        "updatedAt" = NOW()
    WHERE id = v_services_org_id;
  ELSE
    IF EXISTS (SELECT 1 FROM "Organization" WHERE name = 'Jesmond Demo Services' AND id != v_services_org_id) THEN
      RAISE EXCEPTION 'An organization named "Jesmond Demo Services" exists with a different ID. Aborting.';
    END IF;

    INSERT INTO "Organization" (id, name, type, "businessCategory", status, "isPubliclyVisible", timezone, "createdAt", "updatedAt")
    VALUES (v_services_org_id, 'Jesmond Demo Services', 'RETAIL', 'SERVICES', 'PENDING', true, 'Australia/Sydney', NOW(), NOW());
  END IF;

  -- Verify deterministic branch ID and ensure no ambiguous identity
  SELECT "organizationId", name INTO v_branch_org_id, v_branch_name
  FROM "RetailBranch" WHERE id = v_services_branch_id;

  IF v_branch_org_id IS NOT NULL THEN
    IF v_branch_org_id != v_services_org_id THEN
      RAISE EXCEPTION 'Deterministic Branch ID % belongs to unrelated organization %. Expected %.',
        v_services_branch_id, v_branch_org_id, v_services_org_id;
    END IF;
  ELSE
    SELECT count(*) INTO v_branch_count
    FROM "RetailBranch"
    WHERE "organizationId" = v_services_org_id AND name = 'Jesmond Demo Services - Main Branch';

    IF v_branch_count > 1 THEN
      RAISE EXCEPTION 'Ambiguous branch identity: % branches found with name "Jesmond Demo Services - Main Branch" under organization %.',
        v_branch_count, v_services_org_id;
    ELSIF v_branch_count = 1 THEN
      SELECT id INTO v_found_branch_id
      FROM "RetailBranch"
      WHERE "organizationId" = v_services_org_id AND name = 'Jesmond Demo Services - Main Branch';
      v_services_branch_id := v_found_branch_id;
    ELSE
      IF EXISTS (SELECT 1 FROM "RetailBranch" WHERE name = 'Jesmond Demo Services - Main Branch' AND "organizationId" != v_services_org_id) THEN
        RAISE EXCEPTION 'A branch named "Jesmond Demo Services - Main Branch" belongs to another organisation. Never reuse a branch belonging to another organisation.';
      END IF;

      -- Insert missing branch: address left unset (NULL) to avoid unverified physical addresses
      INSERT INTO "RetailBranch" (id, "organizationId", name, address, "isActive", "createdAt", "updatedAt")
      VALUES (v_services_branch_id, v_services_org_id, 'Jesmond Demo Services - Main Branch', NULL, true, NOW(), NOW());
    END IF;
  END IF;

  -- Preserve existing branch active status (do NOT reactivate an inactive branch; leave address unchanged)
  UPDATE "RetailBranch"
  SET "updatedAt" = NOW()
  WHERE id = v_services_branch_id;

  -- Upsert OrgStaff: Preserve existing permissions if membership already exists
  SELECT id INTO v_services_staff_id FROM "OrgStaff" WHERE "userId" = v_services_user_id AND "organizationId" = v_services_org_id LIMIT 1;
  IF v_services_staff_id IS NULL THEN
    v_services_staff_id := gen_random_uuid()::text;
    INSERT INTO "OrgStaff" (id, "userId", "organizationId", role, permissions, "retailBranchId", "createdAt", "updatedAt")
    VALUES (v_services_staff_id, v_services_user_id, v_services_org_id, 'ORG_STAFF', v_business_perms, v_services_branch_id, NOW(), NOW());
  ELSE
    UPDATE "OrgStaff"
    SET "retailBranchId" = COALESCE("retailBranchId", v_services_branch_id),
        "updatedAt" = NOW()
    WHERE id = v_services_staff_id;
  END IF;

  -- Working Hours (Mon-Sat 09:00 - 17:00): Insert only missing working hours
  FOR v_day IN 1..6 LOOP
    IF NOT EXISTS (SELECT 1 FROM "StaffWorkingHours" WHERE "staffId" = v_services_staff_id AND "dayOfWeek" = v_day) THEN
      INSERT INTO "StaffWorkingHours" (id, "staffId", "dayOfWeek", "startTime", "endTime", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_services_staff_id, v_day, '09:00', '17:00', NOW(), NOW());
    END IF;
  END LOOP;

  -- Service Categories (Insert only missing categories)
  SELECT id INTO v_serv_cat_clean FROM "ServiceCategory" WHERE "organizationId" = v_services_org_id AND name = 'Cleaning & Domestic Services' LIMIT 1;
  IF v_serv_cat_clean IS NULL THEN
    v_serv_cat_clean := gen_random_uuid()::text;
    INSERT INTO "ServiceCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_serv_cat_clean, v_services_org_id, 'Cleaning & Domestic Services', 'Professional home and commercial cleaning solutions', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_serv_cat_plumb FROM "ServiceCategory" WHERE "organizationId" = v_services_org_id AND name = 'Plumbing & Electrical Maintenance' LIMIT 1;
  IF v_serv_cat_plumb IS NULL THEN
    v_serv_cat_plumb := gen_random_uuid()::text;
    INSERT INTO "ServiceCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_serv_cat_plumb, v_services_org_id, 'Plumbing & Electrical Maintenance', 'Certified residential repairs and routine safety compliance', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_serv_cat_handy FROM "ServiceCategory" WHERE "organizationId" = v_services_org_id AND name = 'Assembly & Handyman' LIMIT 1;
  IF v_serv_cat_handy IS NULL THEN
    v_serv_cat_handy := gen_random_uuid()::text;
    INSERT INTO "ServiceCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_serv_cat_handy, v_services_org_id, 'Assembly & Handyman', 'Furniture installation, fittings, repairs and wall fixtures', true, NOW(), NOW());
  END IF;

  -- Services Helper Table
  CREATE TEMP TABLE IF NOT EXISTS tmp_services (
    cat_id TEXT, name TEXT, description TEXT, duration INT, price INT
  ) ON COMMIT DROP;

  TRUNCATE tmp_services;

  INSERT INTO tmp_services VALUES
    (v_serv_cat_clean, 'Residential Home Cleaning (Standard)', 'Thorough general cleaning: dusting, vacuuming, mopping, bathroom sanitising, and kitchen surface wipe-down.', 60, 8000),
    (v_serv_cat_clean, 'End of Lease & Deep Cleaning', 'Comprehensive bond cleaning including oven interior, rangehood, skirting boards, windows, and sanitised bathrooms.', 120, 18000),
    (v_serv_cat_clean, 'Carpet Steam Cleaning (2 Rooms)', 'High-pressure hot water extraction and deodorising treatment for up to 2 carpeted rooms.', 60, 9500),
    (v_serv_cat_plumb, 'Plumbing Inspection & Minor Leak Repair', 'Inspection of taps, toilets, traps, and flexi-hoses plus replacement of worn washers or valves.', 45, 9000),
    (v_serv_cat_plumb, 'Hot Water System & Drain Assessment', 'Pressure relief valve testing, temperature validation, flow rate verification, and drain clearance inspection.', 60, 12000),
    (v_serv_cat_plumb, 'Electrical Safety Inspection & Smoke Alarm Testing', 'AS/NZS 3000 compliance check, safety switch RCD trip testing, and interconnected smoke alarm verification.', 45, 8500),
    (v_serv_cat_plumb, 'Ceiling Fan & Light Fixture Installation', 'Professional licensed installation or replacement of standard pendant lights, downlights, or ceiling fans.', 60, 11000),
    (v_serv_cat_handy, 'Flat-Pack Furniture Assembly (Up to 2 Items)', 'Precision assembly of flat-pack desks, bed frames, bookcases, or dining tables with anchoring if needed.', 60, 7500),
    (v_serv_cat_handy, 'General Handyman & Wall Mounting Service', 'TV wall mounting, picture hanging, curtain rails, door latch repairs, and minor dry-wall patch touch-ups.', 45, 7000);

  FOR v_serv_id IN SELECT name FROM tmp_services LOOP
    -- Insert ONLY if missing: Do NOT overwrite price, duration, isActive, or deletedAt on existing records!
    SELECT id INTO v_prod_id FROM "BusinessService" WHERE "organizationId" = v_services_org_id AND name = v_serv_id LIMIT 1;
    IF v_prod_id IS NULL THEN
      v_prod_id := gen_random_uuid()::text;
      INSERT INTO "BusinessService" (
        id, "organizationId", "branchId", "categoryId", name, description, "durationMins", price, currency, "isActive", "createdAt", "updatedAt"
      )
      SELECT v_prod_id, v_services_org_id, v_services_branch_id, t.cat_id, t.name, t.description, t.duration, t.price, 'AUD', true, NOW(), NOW()
      FROM tmp_services t WHERE t.name = v_serv_id;
    END IF;

    -- Upsert Staff Assignment: insert ONLY if missing
    IF NOT EXISTS (SELECT 1 FROM "StaffServiceAssignment" WHERE "staffId" = v_services_staff_id AND "serviceId" = v_prod_id) THEN
      INSERT INTO "StaffServiceAssignment" (id, "staffId", "serviceId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_services_staff_id, v_prod_id, NOW(), NOW());
    END IF;
  END LOOP;
  RAISE NOTICE 'Services catalogue verified.';

  -- ===========================================================================
  -- 3. MECHANICS: demo.mechanics@jesmond.com.au
  -- ===========================================================================
  SELECT count(*) INTO v_user_count
  FROM "User" WHERE LOWER(email) = LOWER('demo.mechanics@jesmond.com.au');

  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'Target user % does not exist in User table.', 'demo.mechanics@jesmond.com.au';
  ELSIF v_user_count > 1 THEN
    RAISE EXCEPTION 'Ambiguous user identity: % users found with email %. Aborting to prevent security breach.',
      v_user_count, 'demo.mechanics@jesmond.com.au';
  END IF;

  SELECT id, role, "accountStatus" INTO v_mechanics_user_id, v_user_role, v_user_status
  FROM "User" WHERE LOWER(email) = LOWER('demo.mechanics@jesmond.com.au');

  IF v_user_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Target user % account status is "%" (expected "ACTIVE").', 'demo.mechanics@jesmond.com.au', v_user_status;
  END IF;

  IF v_user_role != 'ORG_STAFF' THEN
    RAISE EXCEPTION 'Target user % account role is "%" (expected "ORG_STAFF").', 'demo.mechanics@jesmond.com.au', v_user_role;
  END IF;

  RAISE NOTICE 'Verified Mechanics user: % (%)', v_mechanics_user_id, v_user_status;

  -- Check both active and soft-deleted OrgStaff memberships for unrelated organizations
  SELECT "organizationId" INTO v_existing_org_id
  FROM "OrgStaff"
  WHERE "userId" = v_mechanics_user_id AND "organizationId" != v_mechanics_org_id
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Account % is associated with unrelated organisation ID: % (active or soft-deleted). Aborting to prevent data corruption.',
      'demo.mechanics@jesmond.com.au', v_existing_org_id;
  END IF;

  -- Verify deterministic organisation ID against expected organisation name, type and business category
  SELECT name, type, "businessCategory" INTO v_org_name, v_org_type, v_org_cat
  FROM "Organization" WHERE id = v_mechanics_org_id;

  IF v_org_name IS NOT NULL THEN
    IF v_org_name != 'Jesmond Demo Mechanics' OR v_org_type != 'RETAIL' OR v_org_cat != 'MECHANICS' THEN
      RAISE EXCEPTION 'Deterministic Organization ID % belongs to unexpected organization (name: "%", type: %, category: %). Expected "Jesmond Demo Mechanics"/RETAIL/MECHANICS.',
        v_mechanics_org_id, v_org_name, v_org_type, v_org_cat;
    END IF;

    UPDATE "Organization"
    SET "isPubliclyVisible" = true,
        "updatedAt" = NOW()
    WHERE id = v_mechanics_org_id;
  ELSE
    IF EXISTS (SELECT 1 FROM "Organization" WHERE name = 'Jesmond Demo Mechanics' AND id != v_mechanics_org_id) THEN
      RAISE EXCEPTION 'An organization named "Jesmond Demo Mechanics" exists with a different ID. Aborting.';
    END IF;

    INSERT INTO "Organization" (id, name, type, "businessCategory", status, "isPubliclyVisible", timezone, "createdAt", "updatedAt")
    VALUES (v_mechanics_org_id, 'Jesmond Demo Mechanics', 'RETAIL', 'MECHANICS', 'PENDING', true, 'Australia/Sydney', NOW(), NOW());
  END IF;

  -- Verify deterministic branch ID and ensure no ambiguous identity
  SELECT "organizationId", name INTO v_branch_org_id, v_branch_name
  FROM "RetailBranch" WHERE id = v_mechanics_branch_id;

  IF v_branch_org_id IS NOT NULL THEN
    IF v_branch_org_id != v_mechanics_org_id THEN
      RAISE EXCEPTION 'Deterministic Branch ID % belongs to unrelated organization %. Expected %.',
        v_mechanics_branch_id, v_branch_org_id, v_mechanics_org_id;
    END IF;
  ELSE
    SELECT count(*) INTO v_branch_count
    FROM "RetailBranch"
    WHERE "organizationId" = v_mechanics_org_id AND name = 'Jesmond Demo Mechanics - Workshop';

    IF v_branch_count > 1 THEN
      RAISE EXCEPTION 'Ambiguous branch identity: % branches found with name "Jesmond Demo Mechanics - Workshop" under organization %.',
        v_branch_count, v_mechanics_org_id;
    ELSIF v_branch_count = 1 THEN
      SELECT id INTO v_found_branch_id
      FROM "RetailBranch"
      WHERE "organizationId" = v_mechanics_org_id AND name = 'Jesmond Demo Mechanics - Workshop';
      v_mechanics_branch_id := v_found_branch_id;
    ELSE
      IF EXISTS (SELECT 1 FROM "RetailBranch" WHERE name = 'Jesmond Demo Mechanics - Workshop' AND "organizationId" != v_mechanics_org_id) THEN
        RAISE EXCEPTION 'A branch named "Jesmond Demo Mechanics - Workshop" belongs to another organisation. Never reuse a branch belonging to another organisation.';
      END IF;

      -- Insert missing branch: address left unset (NULL) to avoid unverified physical addresses
      INSERT INTO "RetailBranch" (id, "organizationId", name, address, "isActive", "createdAt", "updatedAt")
      VALUES (v_mechanics_branch_id, v_mechanics_org_id, 'Jesmond Demo Mechanics - Workshop', NULL, true, NOW(), NOW());
    END IF;
  END IF;

  -- Preserve existing branch active status (do NOT reactivate an inactive branch; leave address unchanged)
  UPDATE "RetailBranch"
  SET "updatedAt" = NOW()
  WHERE id = v_mechanics_branch_id;

  -- Upsert OrgStaff: Preserve existing permissions if membership already exists
  SELECT id INTO v_mechanics_staff_id FROM "OrgStaff" WHERE "userId" = v_mechanics_user_id AND "organizationId" = v_mechanics_org_id LIMIT 1;
  IF v_mechanics_staff_id IS NULL THEN
    v_mechanics_staff_id := gen_random_uuid()::text;
    INSERT INTO "OrgStaff" (id, "userId", "organizationId", role, permissions, "retailBranchId", "createdAt", "updatedAt")
    VALUES (v_mechanics_staff_id, v_mechanics_user_id, v_mechanics_org_id, 'ORG_STAFF', v_business_perms, v_mechanics_branch_id, NOW(), NOW());
  ELSE
    UPDATE "OrgStaff"
    SET "retailBranchId" = COALESCE("retailBranchId", v_mechanics_branch_id),
        "updatedAt" = NOW()
    WHERE id = v_mechanics_staff_id;
  END IF;

  -- Working Hours (Mon-Sat 08:00 - 17:00): Insert only missing working hours
  FOR v_day IN 1..6 LOOP
    IF NOT EXISTS (SELECT 1 FROM "StaffWorkingHours" WHERE "staffId" = v_mechanics_staff_id AND "dayOfWeek" = v_day) THEN
      INSERT INTO "StaffWorkingHours" (id, "staffId", "dayOfWeek", "startTime", "endTime", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_mechanics_staff_id, v_day, '08:00', '17:00', NOW(), NOW());
    END IF;
  END LOOP;

  -- Service Categories (Insert only missing categories)
  SELECT id INTO v_mech_cat_diag FROM "ServiceCategory" WHERE "organizationId" = v_mechanics_org_id AND name = 'Diagnostics & Roadworthy Inspections' LIMIT 1;
  IF v_mech_cat_diag IS NULL THEN
    v_mech_cat_diag := gen_random_uuid()::text;
    INSERT INTO "ServiceCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_mech_cat_diag, v_mechanics_org_id, 'Diagnostics & Roadworthy Inspections', 'Computerised diagnostics, safety audits, and roadworthy testing', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_mech_cat_brake FROM "ServiceCategory" WHERE "organizationId" = v_mechanics_org_id AND name = 'Brakes, Tyres & Suspension' LIMIT 1;
  IF v_mech_cat_brake IS NULL THEN
    v_mech_cat_brake := gen_random_uuid()::text;
    INSERT INTO "ServiceCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_mech_cat_brake, v_mechanics_org_id, 'Brakes, Tyres & Suspension', 'Braking system overhaul, precision alignment, tyre rotation and shocks', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_mech_cat_eng FROM "ServiceCategory" WHERE "organizationId" = v_mechanics_org_id AND name = 'Engine Maintenance & Scheduled Servicing' LIMIT 1;
  IF v_mech_cat_eng IS NULL THEN
    v_mech_cat_eng := gen_random_uuid()::text;
    INSERT INTO "ServiceCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_mech_cat_eng, v_mechanics_org_id, 'Engine Maintenance & Scheduled Servicing', 'Full synthetic oil services, manufacturer logbook maintenance and tune-ups', true, NOW(), NOW());
  END IF;

  -- Mechanics Services Helper Table
  CREATE TEMP TABLE IF NOT EXISTS tmp_mech_services (
    cat_id TEXT, name TEXT, description TEXT, duration INT, price INT
  ) ON COMMIT DROP;

  TRUNCATE tmp_mech_services;

  INSERT INTO tmp_mech_services VALUES
    (v_mech_cat_diag, 'Comprehensive Vehicle Safety Inspection', '60-point mechanical safety audit: brakes, tyres, steering, suspension, fluids, hoses, belts, battery, lights and underbody visual check with full report.', 45, 8900),
    (v_mech_cat_diag, 'Engine Diagnostic & Fault Code Scan', 'OBD-II computer scanning, error code readout, sensor live data verification, clear stored trouble codes, and mechanic diagnostic consultation.', 30, 7900),
    (v_mech_cat_diag, 'Pre-Purchase Vehicle Mechanical Inspection', 'Independent multi-system assessment for prospective car buyers: chassis alignment, rust check, road test, engine compression, and electronic health report.', 60, 14900),
    (v_mech_cat_brake, 'Front or Rear Brake Pad Replacement', 'Installation of premium low-dust ceramic brake pads, rotor thickness measurement, caliper pin lubrication, and road deceleration test (labour & pads included).', 60, 18900),
    (v_mech_cat_brake, 'Complete Brake Fluid Flush & Hydraulic Bleed', 'Pressure flush of contaminated hydraulic fluid, refill with premium DOT 4 brake fluid, four-corner power bleed and pedal firmness test.', 45, 9900),
    (v_mech_cat_brake, 'Four-Wheel Computerised Laser Alignment', 'Precision laser measurement and adjustment of camber, caster, and toe to factory specifications to eliminate tyre feathering and steering drift.', 45, 8500),
    (v_mech_cat_brake, 'Tyre Rotation, Balance & Pressure Optimization', 'Cross-rotation of 4 tyres, high-speed dynamic wheel balancing, tread depth inspection, valve check, and nitrogen-level pressure calibration.', 30, 5500),
    (v_mech_cat_eng, 'Essential Engine Oil & Filter Service', 'Up to 5L premium full-synthetic motor oil, OEM-grade spin-on/cartridge oil filter, sump washer replacement, 25-point safety check, and fluid level top-ups.', 45, 14900),
    (v_mech_cat_eng, 'Major Scheduled Logbook Service', 'Full manufacturer logbook warranty service: full-synthetic oil, oil filter, engine air filter, cabin pollen filter, spark plug check, brake fluid check, battery test, tyre rotation and logbook stamping.', 90, 29900),
    (v_mech_cat_eng, 'Automotive Battery Test & Replacement', 'Digital battery conductance test, starter load test, alternator output check, supply and fitting of high-CCA maintenance-free battery with 2-year warranty.', 30, 16500),
    (v_mech_cat_eng, 'Air Conditioning System Service & Regas', 'Refrigerant recovery, deep vacuum moisture dehydration, system leak test, fresh PAG oil addition, precise R134a refrigerant regas and vent temp verification.', 60, 17900);

  FOR v_mech_id IN SELECT name FROM tmp_mech_services LOOP
    -- Insert ONLY if missing: Do NOT overwrite price, duration, isActive, or deletedAt on existing records!
    SELECT id INTO v_prod_id FROM "BusinessService" WHERE "organizationId" = v_mechanics_org_id AND name = v_mech_id LIMIT 1;
    IF v_prod_id IS NULL THEN
      v_prod_id := gen_random_uuid()::text;
      INSERT INTO "BusinessService" (
        id, "organizationId", "branchId", "categoryId", name, description, "durationMins", price, currency, "isActive", "createdAt", "updatedAt"
      )
      SELECT v_prod_id, v_mechanics_org_id, v_mechanics_branch_id, t.cat_id, t.name, t.description, t.duration, t.price, 'AUD', true, NOW(), NOW()
      FROM tmp_mech_services t WHERE t.name = v_mech_id;
    END IF;

    -- Upsert Staff Assignment: insert ONLY if missing
    IF NOT EXISTS (SELECT 1 FROM "StaffServiceAssignment" WHERE "staffId" = v_mechanics_staff_id AND "serviceId" = v_prod_id) THEN
      INSERT INTO "StaffServiceAssignment" (id, "staffId", "serviceId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_mechanics_staff_id, v_prod_id, NOW(), NOW());
    END IF;
  END LOOP;
  RAISE NOTICE 'Mechanics workshop services verified.';

  RAISE NOTICE '=== Demo Businesses Seeding Complete ===';
END $$;
