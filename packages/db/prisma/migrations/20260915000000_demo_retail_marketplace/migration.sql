-- Migration to seed Demo Retail Marketplace Data safely

DO $$
DECLARE
    v_org_id TEXT;
    v_branch_id TEXT;
    v_cat_id TEXT;
    v_prod_milk TEXT;
    v_prod_bread TEXT;
    v_prod_eggs TEXT;
    v_prod_rice TEXT;
    v_prod_oil TEXT;
    v_prod_biscuits TEXT;
    v_prod_drink TEXT;
    v_prod_snacks TEXT;
    v_prod_soap TEXT;
    v_prod_shampoo TEXT;
BEGIN
    -- Only create if it doesn't already exist
    SELECT id INTO v_org_id FROM "Organization" WHERE name = 'Jesmond Demo Retail' AND type = 'RETAIL' LIMIT 1;

    IF v_org_id IS NULL THEN
        v_org_id := gen_random_uuid();
        INSERT INTO "Organization" ("id", "name", "type", "status", "updatedAt")
        VALUES (v_org_id, 'Jesmond Demo Retail', 'RETAIL', 'VERIFIED', NOW());
    END IF;

    SELECT id INTO v_branch_id FROM "RetailBranch" WHERE name = 'Jesmond Demo Store' AND "organizationId" = v_org_id LIMIT 1;

    IF v_branch_id IS NULL THEN
        v_branch_id := gen_random_uuid();
        INSERT INTO "RetailBranch" ("id", "organizationId", "name", "address", "phone", "isActive", "deliveryEnabled", "takeawayEnabled", "updatedAt")
        VALUES (v_branch_id, v_org_id, 'Jesmond Demo Store', '123 Demo St, Jesmond', '0400000000', true, true, true, NOW());
    END IF;

    -- Ensure category exists
    SELECT id INTO v_cat_id FROM "ProductCategory" WHERE name = 'Groceries' AND "organizationId" = v_org_id LIMIT 1;
    IF v_cat_id IS NULL THEN
        v_cat_id := gen_random_uuid();
        INSERT INTO "ProductCategory" ("id", "organizationId", "name", "isActive", "updatedAt")
        VALUES (v_cat_id, v_org_id, 'Groceries', true, NOW());
    END IF;

    -- Product: Milk
    SELECT id INTO v_prod_milk FROM "Product" WHERE sku = 'DEMO-MILK-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_milk IS NULL THEN
        v_prod_milk := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_milk, v_org_id, v_cat_id, 'DEMO-MILK-001', 'Full Cream Milk 2L', 350, 'https://images.unsplash.com/photo-1550583724-b2692b85b150', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_milk, 100, NOW());
    END IF;

    -- Product: Bread
    SELECT id INTO v_prod_bread FROM "Product" WHERE sku = 'DEMO-BREAD-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_bread IS NULL THEN
        v_prod_bread := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_bread, v_org_id, v_cat_id, 'DEMO-BREAD-001', 'Wholemeal Bread 700g', 420, 'https://images.unsplash.com/photo-1595535873420-a599195b3f4a', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_bread, 50, NOW());
    END IF;

    -- Product: Eggs
    SELECT id INTO v_prod_eggs FROM "Product" WHERE sku = 'DEMO-EGGS-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_eggs IS NULL THEN
        v_prod_eggs := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_eggs, v_org_id, v_cat_id, 'DEMO-EGGS-001', 'Free Range Eggs 12pk', 600, 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_eggs, 80, NOW());
    END IF;

    -- Product: Rice
    SELECT id INTO v_prod_rice FROM "Product" WHERE sku = 'DEMO-RICE-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_rice IS NULL THEN
        v_prod_rice := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_rice, v_org_id, v_cat_id, 'DEMO-RICE-001', 'Basmati Rice 1kg', 850, 'https://images.unsplash.com/photo-1586201375761-83865001e8ac', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_rice, 40, NOW());
    END IF;

    -- Product: Cooking Oil
    SELECT id INTO v_prod_oil FROM "Product" WHERE sku = 'DEMO-OIL-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_oil IS NULL THEN
        v_prod_oil := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_oil, v_org_id, v_cat_id, 'DEMO-OIL-001', 'Olive Oil 500ml', 900, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_oil, 30, NOW());
    END IF;

    -- Product: Biscuits
    SELECT id INTO v_prod_biscuits FROM "Product" WHERE sku = 'DEMO-BISC-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_biscuits IS NULL THEN
        v_prod_biscuits := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_biscuits, v_org_id, v_cat_id, 'DEMO-BISC-001', 'Chocolate Chip Biscuits', 350, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_biscuits, 60, NOW());
    END IF;

    -- Product: Soft Drink
    SELECT id INTO v_prod_drink FROM "Product" WHERE sku = 'DEMO-DRINK-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_drink IS NULL THEN
        v_prod_drink := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_drink, v_org_id, v_cat_id, 'DEMO-DRINK-001', 'Cola 1.25L', 280, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_drink, 120, NOW());
    END IF;

    -- Product: Snacks
    SELECT id INTO v_prod_snacks FROM "Product" WHERE sku = 'DEMO-SNACK-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_snacks IS NULL THEN
        v_prod_snacks := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_snacks, v_org_id, v_cat_id, 'DEMO-SNACK-001', 'Potato Chips 150g', 400, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_snacks, 70, NOW());
    END IF;

    -- Product: Soap
    SELECT id INTO v_prod_soap FROM "Product" WHERE sku = 'DEMO-SOAP-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_soap IS NULL THEN
        v_prod_soap := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_soap, v_org_id, v_cat_id, 'DEMO-SOAP-001', 'Body Wash 400ml', 650, 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_soap, 40, NOW());
    END IF;

    -- Product: Shampoo
    SELECT id INTO v_prod_shampoo FROM "Product" WHERE sku = 'DEMO-SHAMPOO-001' AND "organizationId" = v_org_id LIMIT 1;
    IF v_prod_shampoo IS NULL THEN
        v_prod_shampoo := gen_random_uuid();
        INSERT INTO "Product" ("id", "organizationId", "categoryId", "sku", "name", "sellingPrice", "imageUrl", "isActive", "updatedAt")
        VALUES (v_prod_shampoo, v_org_id, v_cat_id, 'DEMO-SHAMPOO-001', 'Anti-Dandruff Shampoo', 800, 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d', true, NOW());

        INSERT INTO "Inventory" ("id", "branchId", "productId", "quantity", "updatedAt") VALUES (gen_random_uuid(), v_branch_id, v_prod_shampoo, 35, NOW());
    END IF;

END $$;
