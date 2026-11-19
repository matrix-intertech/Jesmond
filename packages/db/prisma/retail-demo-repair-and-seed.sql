-- ===========================================================================
-- Jesmond 2.0: Retail Business Demo Account Audit, Repair & Idempotent Seed
--
-- Target Account:       shikharshaurya.01@gmail.com
-- Target Organization:  Jesmond Demo Retail Store (14f9a57a-a209-4e8e-b4f6-4ed86d5f86fb)
-- Target Branch:        Jesmond Demo Retail Store - Main Branch (2772e0a5-12d5-4703-85ff-512e4133a02e)
-- Target Terminal:      Demo Cash Register - Counter 1 (DEMO-REG-01)
--
-- Idempotency Guarantee: Safe to run multiple times without data duplication.
-- Transaction Safety:    Wraps all operations in a DO block inside a single transaction.
-- Data Preservation:     Never overwrites live prices, custom permissions, or stock counts.
-- ===========================================================================

BEGIN;

DO $$
DECLARE
  -- User and Org Identifiers
  v_user_email CONSTANT TEXT := 'shikharshaurya.01@gmail.com';
  v_user_id TEXT;
  v_user_role TEXT;
  v_user_status TEXT;
  v_user_count INT;

  v_org_id CONSTANT TEXT := '14f9a57a-a209-4e8e-b4f6-4ed86d5f86fb';
  v_org_name CONSTANT TEXT := 'Jesmond Demo Retail Store';
  v_existing_org_id TEXT;
  v_curr_org_type TEXT;
  v_curr_org_cat TEXT;

  -- Branch and Terminal
  v_branch_id CONSTANT TEXT := '2772e0a5-12d5-4703-85ff-512e4133a02e';
  v_branch_name CONSTANT TEXT := 'Jesmond Demo Retail Store - Main Branch';
  v_branch_count INT;
  v_terminal_id TEXT;
  v_terminal_count INT;

  -- Staff and Permissions
  v_staff_id TEXT;
  v_retail_perms TEXT[];

  -- Category Identifiers
  v_cat_elec TEXT;
  v_cat_home TEXT;
  v_cat_care TEXT;
  v_cat_stat TEXT;
  v_cat_groc TEXT;

  -- Product Cursor
  v_prod_sku TEXT;
  v_product_count INT;
  v_inventory_count INT;
  v_total_stock INT;

BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Starting Jesmond 2.0 Retail Demo Account Audit & Repair';
  RAISE NOTICE '=======================================================';

  -- ---------------------------------------------------------------------------
  -- 1. PRE-CHECK: User Existence, Status & Role
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_user_count
  FROM "User" WHERE LOWER(email) = LOWER(v_user_email);

  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'Pre-check failed: Target user % does not exist in User table.', v_user_email;
  ELSIF v_user_count > 1 THEN
    RAISE EXCEPTION 'Pre-check failed: Ambiguous user identity: % users found with email %.', v_user_count, v_user_email;
  END IF;

  SELECT id, role, "accountStatus" INTO v_user_id, v_user_role, v_user_status
  FROM "User" WHERE LOWER(email) = LOWER(v_user_email);

  IF v_user_status != 'ACTIVE' THEN
    RAISE NOTICE 'User status is "%", updating to "ACTIVE" for demo operations.', v_user_status;
    UPDATE "User" SET "accountStatus" = 'ACTIVE', "emailVerified" = true, "updatedAt" = NOW() WHERE id = v_user_id;
  END IF;

  IF v_user_role != 'ORG_STAFF' THEN
    RAISE NOTICE 'User role is "%", updating to "ORG_STAFF" for retail operations.', v_user_role;
    UPDATE "User" SET role = 'ORG_STAFF', "updatedAt" = NOW() WHERE id = v_user_id;
  END IF;

  RAISE NOTICE '[PRE-CHECK OK] User verified: ID=%, Email=%', v_user_id, v_user_email;

  -- ---------------------------------------------------------------------------
  -- 2. ORGANISATION SETUP & REPAIR
  -- ---------------------------------------------------------------------------
  SELECT type, "businessCategory" INTO v_curr_org_type, v_curr_org_cat
  FROM "Organization" WHERE id = v_org_id;

  IF v_curr_org_type IS NULL THEN
    -- Organization does not exist with deterministic ID: insert it
    INSERT INTO "Organization" (
      id, name, type, "businessCategory", status, "isPubliclyVisible",
      timezone, "createdAt", "updatedAt"
    )
    VALUES (
      v_org_id, v_org_name, 'RETAIL', 'RETAIL', 'VERIFIED', true,
      'Australia/Sydney', NOW(), NOW()
    );
    RAISE NOTICE '[INSERT] Organization created: ID=%, Name=%', v_org_id, v_org_name;
  ELSE
    -- Organization exists: ensure type and businessCategory are strictly RETAIL
    UPDATE "Organization"
    SET type = 'RETAIL',
        "businessCategory" = 'RETAIL',
        status = 'VERIFIED',
        "isPubliclyVisible" = true,
        "updatedAt" = NOW()
    WHERE id = v_org_id;
    RAISE NOTICE '[REPAIR] Organization configuration updated to RETAIL/RETAIL (VERIFIED)';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. RETAIL BRANCH REPAIR / CREATION
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_branch_count FROM "RetailBranch" WHERE id = v_branch_id;

  IF v_branch_count = 0 THEN
    INSERT INTO "RetailBranch" (
      id, "organizationId", name, address, "isActive", "createdAt", "updatedAt"
    )
    VALUES (
      v_branch_id, v_org_id, v_branch_name, 'Shop 1, 12 Blue Gum Road, Jesmond NSW 2299', true, NOW(), NOW()
    );
    RAISE NOTICE '[INSERT] Retail Branch created: ID=%, Name=%', v_branch_id, v_branch_name;
  ELSE
    UPDATE "RetailBranch"
    SET "organizationId" = v_org_id,
        "isActive" = true,
        "updatedAt" = NOW()
    WHERE id = v_branch_id;
    RAISE NOTICE '[EXISTS] Retail Branch verified and active: ID=%', v_branch_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4. ORG STAFF & PERMISSION REPAIR
  -- ---------------------------------------------------------------------------
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
    'POS_MANAGE',
    'TERMINALS_VIEW',
    'TERMINALS_MANAGE',
    'BRANCH_VIEW',
    'BRANCH_MANAGE',
    'EMPLOYEES_VIEW',
    'EMPLOYEES_MANAGE',
    'RETAIL_SETTINGS_VIEW',
    'RETAIL_SETTINGS_MANAGE'
  ]::text[];

  SELECT id INTO v_staff_id
  FROM "OrgStaff"
  WHERE "userId" = v_user_id AND "organizationId" = v_org_id
  LIMIT 1;

  IF v_staff_id IS NULL THEN
    v_staff_id := gen_random_uuid()::text;
    INSERT INTO "OrgStaff" (
      id, "userId", "organizationId", role, permissions, "retailBranchId",
      "createdAt", "updatedAt"
    )
    VALUES (
      v_staff_id, v_user_id, v_org_id, 'ORG_STAFF', v_retail_perms, v_branch_id,
      NOW(), NOW()
    );
    RAISE NOTICE '[INSERT] OrgStaff membership created: ID=%', v_staff_id;
  ELSE
    UPDATE "OrgStaff"
    SET "retailBranchId" = COALESCE("retailBranchId", v_branch_id),
        permissions = v_retail_perms,
        role = 'ORG_STAFF',
        "updatedAt" = NOW()
    WHERE id = v_staff_id;
    RAISE NOTICE '[REPAIR] OrgStaff membership updated with full 20 retail permissions and branch ID';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5. POS TERMINAL REPAIR / CREATION
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_terminal_id
  FROM "PosTerminal"
  WHERE "branchId" = v_branch_id AND "externalId" = 'DEMO-REG-01'
  LIMIT 1;

  IF v_terminal_id IS NULL THEN
    INSERT INTO "PosTerminal" (
      id, "branchId", name, "displayName", status, provider,
      "providerTerminalId", "externalId", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text, v_branch_id, 'Main Counter Register', 'Demo Cash Register',
      'ONLINE', NULL, NULL, 'DEMO-REG-01', NOW(), NOW()
    );
    RAISE NOTICE '[INSERT] POS Terminal created: DEMO-REG-01 (ONLINE)';
  ELSE
    UPDATE "PosTerminal"
    SET status = 'ONLINE', "updatedAt" = NOW()
    WHERE id = v_terminal_id;
    RAISE NOTICE '[EXISTS] POS Terminal verified: ID=%', v_terminal_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 6. PRODUCT CATEGORIES (5 Total)
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_cat_elec FROM "ProductCategory" WHERE "organizationId" = v_org_id AND name = 'Electronics & Accessories' LIMIT 1;
  IF v_cat_elec IS NULL THEN
    v_cat_elec := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_cat_elec, v_org_id, 'Electronics & Accessories', 'Cables, chargers, audio and mobile tech accessories', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_cat_home FROM "ProductCategory" WHERE "organizationId" = v_org_id AND name = 'Home Essentials' LIMIT 1;
  IF v_cat_home IS NULL THEN
    v_cat_home := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_cat_home, v_org_id, 'Home Essentials', 'Household cleaning supplies, kitchenware and home decor', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_cat_care FROM "ProductCategory" WHERE "organizationId" = v_org_id AND name = 'Personal Care' LIMIT 1;
  IF v_cat_care IS NULL THEN
    v_cat_care := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_cat_care, v_org_id, 'Personal Care', 'Everyday grooming, skin care, oral health and wellness', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_cat_stat FROM "ProductCategory" WHERE "organizationId" = v_org_id AND name = 'Stationery & Office' LIMIT 1;
  IF v_cat_stat IS NULL THEN
    v_cat_stat := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_cat_stat, v_org_id, 'Stationery & Office', 'Notebooks, pens, desk organizers and study supplies', true, NOW(), NOW());
  END IF;

  SELECT id INTO v_cat_groc FROM "ProductCategory" WHERE "organizationId" = v_org_id AND name = 'Grocery & Packaged Goods' LIMIT 1;
  IF v_cat_groc IS NULL THEN
    v_cat_groc := gen_random_uuid()::text;
    INSERT INTO "ProductCategory" (id, "organizationId", name, description, "isActive", "createdAt", "updatedAt")
    VALUES (v_cat_groc, v_org_id, 'Grocery & Packaged Goods', 'Snacks, beverages, coffee and shelf-stable pantry items', true, NOW(), NOW());
  END IF;

  RAISE NOTICE '[CATEGORIES OK] 5 Product Categories verified.';

  -- ---------------------------------------------------------------------------
  -- 7. PRODUCT CATALOG & INVENTORY (18 Products, Integer AUD Cents)
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS tmp_repair_products (
    cat_id TEXT, sku TEXT, barcode TEXT, name TEXT, description TEXT,
    selling_price INT, cost_price INT, tax_rate FLOAT, unit TEXT,
    stock_qty INT, reorder_thresh INT, image_url TEXT
  ) ON COMMIT DROP;

  TRUNCATE tmp_repair_products;

  INSERT INTO tmp_repair_products VALUES
    (v_cat_elec, 'ELEC-CBL-001', '9312345001014', 'USB-C to Lightning Braided Cable 1.5m', 'Durable nylon braided high-speed sync and charge cable, MFi certified.', 1999, 850, 0.10, 'piece', 45, 10, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80'),
    (v_cat_elec, 'ELEC-CHG-002', '9312345001021', '65W GaN Dual USB-C Fast Charger', 'Ultra-compact Gallium Nitride wall charger with dual power delivery ports.', 4495, 2200, 0.10, 'piece', 25, 5, 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80'),
    (v_cat_elec, 'ELEC-EAR-003', '9312345001038', 'Wireless Bluetooth Earbuds Pro', 'Active noise-cancelling in-ear headphones with 28-hour battery case.', 8900, 4500, 0.10, 'piece', 15, 5, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'),
    (v_cat_elec, 'ELEC-MNT-004', '9312345001045', 'Magnetic Phone Car Mount Holder', 'Air-vent 360-degree rotating strong magnetic phone holder.', 2450, 1000, 0.10, 'piece', 3, 5, 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=400&q=80'),
    (v_cat_home, 'HOME-BAM-001', '9312345002011', 'Eco Bamboo Fiber Cutting Board Set', 'Organic sustainably sourced bamboo chopping board set of 3 with juice groove.', 2999, 1200, 0.10, 'set', 30, 8, 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=400&q=80'),
    (v_cat_home, 'HOME-BOT-002', '9312345002028', 'Stainless Steel Insulated Water Bottle 750ml', 'Double-wall vacuum insulation keeping drinks cold for 24h or hot for 12h.', 2250, 950, 0.10, 'piece', 40, 10, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80'),
    (v_cat_home, 'HOME-CLO-003', '9312345002035', 'Microfiber Multi-Surface Cleaning Cloths (6-Pack)', 'Lint-free, scratch-free ultra-absorbent reusable cleaning cloths.', 1499, 550, 0.10, 'pack', 50, 15, 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80'),
    (v_cat_home, 'HOME-GLS-004', '9312345002042', 'Glass Meal Prep Containers (4-Pack Airtight)', 'Borosilicate oven-safe glass containers with locking BPA-free lids.', 3800, 1800, 0.10, 'pack', 0, 5, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80'),
    (v_cat_care, 'CARE-WSH-001', '9312345003018', 'Australian Botanical Hand Wash 500ml', 'Gentle natural cleansing formulation with eucalyptus and lavender essential oils.', 1295, 480, 0.10, 'bottle', 35, 10, 'https://images.unsplash.com/photo-1608248597359-5489f7831f24?auto=format&fit=crop&w=400&q=80'),
    (v_cat_care, 'CARE-SHP-002', '9312345003025', 'Organic Tea Tree Shampoo & Conditioner Set', 'Sulphate-free purifying scalp care set with Australian tea tree extract.', 2850, 1250, 0.10, 'set', 20, 5, 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=400&q=80'),
    (v_cat_care, 'CARE-SUN-003', '9312345003032', 'Natural Mineral Sunscreen SPF 50+ 200ml', 'Broad-spectrum zinc oxide sun protection, 4 hours water-resistant, reef-safe.', 1899, 750, 0.10, 'tube', 4, 8, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80'),
    (v_cat_care, 'CARE-TB-004', '9312345003049', 'Bamboo Charcoal Toothbrush (Pack of 4)', 'Biodegradable ergonomic bamboo handle with activated charcoal soft bristles.', 999, 300, 0.10, 'pack', 60, 15, 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80'),
    (v_cat_stat, 'STAT-JRN-001', '9312345004015', 'A5 Hardcover Dotted Journal Notebook', '160gsm bleed-proof paper, lay-flat thread binding, elastic closure, inner pocket.', 1650, 600, 0.10, 'piece', 40, 10, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80'),
    (v_cat_stat, 'STAT-PEN-002', '9312345004022', 'Gel Roller Pens 0.5mm Black (Pack of 5)', 'Quick-drying smudge-resistant pigment ink fine-point pens.', 850, 320, 0.10, 'pack', 55, 12, 'https://images.unsplash.com/photo-1585336261026-c2a41f6c7717?auto=format&fit=crop&w=400&q=80'),
    (v_cat_stat, 'STAT-LPT-003', '9312345004039', 'Aluminum Ergonomic Laptop Stand', 'Foldable portable riser with heat dissipation vents, supports up to 17-inch devices.', 4200, 1900, 0.10, 'piece', 12, 4, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=400&q=80'),
    (v_cat_groc, 'GROC-COF-001', '9312345005012', 'Artisan Roasted Coffee Beans 500g (Jesmond Blend)', 'Locally roasted 100% Arabica specialty blend with notes of chocolate and hazelnut.', 2100, 950, 0.00, 'bag', 30, 8, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=400&q=80'),
    (v_cat_groc, 'GROC-MAC-002', '9312345005029', 'Roasted Salted Australian Macadamias 250g', 'Locally grown Australian macadamia nuts, dry roasted with Murray River pink salt.', 1450, 700, 0.00, 'bag', 2, 6, 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80'),
    (v_cat_groc, 'GROC-WTR-003', '9312345005036', 'Sparkling Natural Mineral Water 750ml', 'Bottled at the source in pristine Australian highlands, crisp effervescence.', 450, 180, 0.10, 'bottle', 80, 20, 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80');

  FOR v_prod_sku IN SELECT sku FROM tmp_repair_products LOOP
    -- Insert ONLY missing products (Preserve existing pricing, description and active status)
    INSERT INTO "Product" (
      id, "organizationId", "categoryId", sku, barcode, name, description,
      "sellingPrice", "costPrice", "taxRate", unit, "imageUrl", "isActive",
      "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid()::text, v_org_id, t.cat_id, t.sku, t.barcode, t.name, t.description,
      t.selling_price, t.cost_price, t.tax_rate, t.unit, t.image_url, true, NOW(), NOW()
    FROM tmp_repair_products t WHERE t.sku = v_prod_sku
    ON CONFLICT ("organizationId", sku) DO NOTHING;

    -- Upsert Inventory: insert ONLY missing records (Preserve live stock quantity and reorder thresholds)
    INSERT INTO "Inventory" (id, "branchId", "productId", quantity, "reorderThreshold", "updatedAt")
    SELECT
      gen_random_uuid()::text, v_branch_id, p.id, t.stock_qty, t.reorder_thresh, NOW()
    FROM "Product" p
    JOIN tmp_repair_products t ON t.sku = p.sku AND p."organizationId" = v_org_id
    WHERE p.sku = v_prod_sku
    ON CONFLICT ("branchId", "productId") DO NOTHING;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 8. POST-CHECK AUDIT & ASSERTIONS
  -- ---------------------------------------------------------------------------
  SELECT count(*) INTO v_product_count FROM "Product" WHERE "organizationId" = v_org_id;
  SELECT count(*), COALESCE(SUM(quantity), 0) INTO v_inventory_count, v_total_stock FROM "Inventory" WHERE "branchId" = v_branch_id;
  SELECT count(*) INTO v_terminal_count FROM "PosTerminal" WHERE "branchId" = v_branch_id;

  IF v_product_count < 18 THEN
    RAISE EXCEPTION 'Post-check assertion failed: Expected >= 18 products, found %.', v_product_count;
  END IF;

  IF v_inventory_count < 18 THEN
    RAISE EXCEPTION 'Post-check assertion failed: Expected >= 18 inventory records, found %.', v_inventory_count;
  END IF;

  IF v_terminal_count < 1 THEN
    RAISE EXCEPTION 'Post-check assertion failed: Expected >= 1 active POS terminal, found %.', v_terminal_count;
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'AUDIT & REPAIR COMPLETE SUCCESS:';
  RAISE NOTICE '  - Organization: % (Type: RETAIL, Category: RETAIL)', v_org_name;
  RAISE NOTICE '  - Active Branch: % (ID: %)', v_branch_name, v_branch_id;
  RAISE NOTICE '  - Active POS Terminals: %', v_terminal_count;
  RAISE NOTICE '  - Product Catalog Items: %', v_product_count;
  RAISE NOTICE '  - Inventory Records: % (% total units in stock)', v_inventory_count, v_total_stock;
  RAISE NOTICE '=======================================================';

END $$;

COMMIT;
