import {
  PrismaClient,
  OrgType,
  OrgStatus,
  BusinessCategory,
  UserRole,
  AccountStatus,
  TerminalStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const RETAIL_ORG_ID = "14f9a57a-a209-4e8e-b4f6-4ed86d5f86fb";
const RETAIL_BRANCH_ID = "2772e0a5-12d5-4703-85ff-512e4133a02e";

const SERVICES_ORG_ID = "17107a98-09a9-4c45-b96f-841f68927873";
const SERVICES_BRANCH_ID = "3f569eb4-c9ab-4fa6-a700-f5f756f59c26";

const MECHANICS_ORG_ID = "f08719e3-a091-43ee-93c7-534a118a9d1b";
const MECHANICS_BRANCH_ID = "78566d7c-f2b5-449b-81a2-640a22db05e1";

const RETAIL_PERMISSIONS = [
  "RETAIL_DASHBOARD_VIEW",
  "ORDERS_VIEW",
  "ORDERS_MANAGE",
  "CUSTOMERS_VIEW",
  "CUSTOMERS_MANAGE",
  "INVENTORY_VIEW",
  "INVENTORY_ADJUST",
  "CATALOG_VIEW",
  "CATALOG_MANAGE",
  "POS_VIEW",
  "POS_USE",
  "TERMINALS_VIEW",
  "BRANCH_VIEW",
  "RETAIL_SETTINGS_VIEW",
  "RETAIL_SETTINGS_MANAGE",
];

const BUSINESS_PERMISSIONS = [
  "APPOINTMENTS_VIEW",
  "APPOINTMENTS_MANAGE",
  "SERVICES_VIEW",
  "SERVICES_MANAGE",
  "AVAILABILITY_VIEW",
  "AVAILABILITY_MANAGE",
  "CUSTOMERS_VIEW",
  "CUSTOMERS_MANAGE",
  "BRANCH_VIEW",
  "BUSINESS_SETTINGS_VIEW",
  "BUSINESS_SETTINGS_MANAGE",
];

export async function seedDemoBusinesses() {
  console.log("=== Seeding Demo Businesses (Idempotent & Data-Preserving) ===");

  // =========================================================================
  // 1. RETAIL: shikharshaurya.01@gmail.com
  // =========================================================================
  console.log("\n[1/3] Configuring Retail Demo Business (shikharshaurya.01@gmail.com)...");

  const matchingRetailUsers = await prisma.user.findMany({
    where: { email: { equals: "shikharshaurya.01@gmail.com", mode: "insensitive" } },
  });
  if (matchingRetailUsers.length === 0) {
    throw new Error("Target user shikharshaurya.01@gmail.com not found!");
  }
  if (matchingRetailUsers.length > 1) {
    throw new Error(`Ambiguous user identity: ${matchingRetailUsers.length} users found with email shikharshaurya.01@gmail.com!`);
  }
  const retailUser = matchingRetailUsers[0];
  if (retailUser.accountStatus !== AccountStatus.ACTIVE) {
    throw new Error(`Target user shikharshaurya.01@gmail.com status is ${retailUser.accountStatus} (expected ACTIVE)!`);
  }
  if (retailUser.role !== UserRole.ORG_STAFF) {
    throw new Error(`Target user shikharshaurya.01@gmail.com role is ${retailUser.role} (expected ORG_STAFF)!`);
  }

  // Conflict check: ensure user is not linked to an unrelated organization (active or soft-deleted)
  const existingRetailStaff = await prisma.orgStaff.findFirst({
    where: {
      userId: retailUser.id,
      organizationId: { not: RETAIL_ORG_ID },
    },
  });
  if (existingRetailStaff) {
    throw new Error(
      `Account shikharshaurya.01@gmail.com is already associated with unrelated organisation ID: ${existingRetailStaff.organizationId}. Aborting.`
    );
  }

  // Verify deterministic Organization ID against expected name, type, and businessCategory
  let retailOrg = await prisma.organization.findUnique({
    where: { id: RETAIL_ORG_ID },
  });

  if (retailOrg) {
    if (
      retailOrg.name !== "Jesmond Demo Retail Store" ||
      retailOrg.type !== OrgType.RETAIL ||
      retailOrg.businessCategory !== BusinessCategory.RETAIL
    ) {
      throw new Error(
        `Deterministic Org ID ${RETAIL_ORG_ID} belongs to unexpected organization (${retailOrg.name}/${retailOrg.type}/${retailOrg.businessCategory})!`
      );
    }
    retailOrg = await prisma.organization.update({
      where: { id: retailOrg.id },
      data: { isPubliclyVisible: true },
    });
    console.log(`  Verified & updated Organization: ${retailOrg.name} (${retailOrg.id})`);
  } else {
    // Check if another org exists with expected name
    const orgByName = await prisma.organization.findFirst({
      where: { name: "Jesmond Demo Retail Store" },
    });
    if (orgByName) {
      throw new Error(`An organization named 'Jesmond Demo Retail Store' already exists with ID ${orgByName.id}!`);
    }

    retailOrg = await prisma.organization.create({
      data: {
        id: RETAIL_ORG_ID,
        name: "Jesmond Demo Retail Store",
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.RETAIL,
        status: OrgStatus.PENDING,
        isPubliclyVisible: true,
        timezone: "Australia/Sydney",
      },
    });
    console.log(`  Created Organization: ${retailOrg.name} (${retailOrg.id})`);
  }

  // Verify branch identity
  let retailBranch = await prisma.retailBranch.findUnique({
    where: { id: RETAIL_BRANCH_ID },
  });

  if (retailBranch) {
    if (retailBranch.organizationId !== retailOrg.id) {
      throw new Error(`Deterministic Branch ID ${RETAIL_BRANCH_ID} belongs to another org: ${retailBranch.organizationId}!`);
    }
  } else {
    const branchesByName = await prisma.retailBranch.findMany({
      where: { organizationId: retailOrg.id, name: "Jesmond Demo Retail Store - Main Branch" },
    });
    if (branchesByName.length > 1) {
      throw new Error(`Ambiguous branch identity: multiple branches found with name 'Jesmond Demo Retail Store - Main Branch'!`);
    } else if (branchesByName.length === 1) {
      retailBranch = branchesByName[0];
    } else {
      const unrelatedBranch = await prisma.retailBranch.findFirst({
        where: { name: "Jesmond Demo Retail Store - Main Branch", organizationId: { not: retailOrg.id } },
      });
      if (unrelatedBranch) {
        throw new Error(`A branch named 'Jesmond Demo Retail Store - Main Branch' belongs to another org!`);
      }

      retailBranch = await prisma.retailBranch.create({
        data: {
          id: RETAIL_BRANCH_ID,
          organizationId: retailOrg.id,
          name: "Jesmond Demo Retail Store - Main Branch",
          address: null,
          isActive: true,
        },
      });
      console.log(`  Created RetailBranch: ${retailBranch.name} (${retailBranch.id})`);
    }
  }

  // Preserve existing OrgStaff permissions if membership exists
  const existingStaffRecord = await prisma.orgStaff.findUnique({
    where: {
      userId_organizationId: {
        userId: retailUser.id,
        organizationId: retailOrg.id,
      },
    },
  });

  if (!existingStaffRecord) {
    await prisma.orgStaff.create({
      data: {
        userId: retailUser.id,
        organizationId: retailOrg.id,
        role: UserRole.ORG_STAFF,
        retailBranchId: retailBranch.id,
        permissions: RETAIL_PERMISSIONS,
      },
    });
    console.log(`  Created OrgStaff with explicit retail permissions`);
  } else {
    await prisma.orgStaff.update({
      where: { id: existingStaffRecord.id },
      data: {
        retailBranchId: existingStaffRecord.retailBranchId ?? retailBranch.id,
      },
    });
    console.log(`  Preserved existing OrgStaff permissions for: ${existingStaffRecord.id}`);
  }

  // PosTerminal Isolation: Ensure DEMO-REG-01 does NOT collide with another branch
  const conflictingTerminal = await prisma.posTerminal.findFirst({
    where: { externalId: "DEMO-REG-01", branchId: { not: retailBranch.id } },
  });
  if (conflictingTerminal) {
    throw new Error(`POS Terminal with externalId DEMO-REG-01 is assigned to another branch: ${conflictingTerminal.branchId}!`);
  }

  // PosTerminal: Create new manual cash register ONLY if dedicated demo terminal does not exist
  let terminal = await prisma.posTerminal.findFirst({
    where: {
      branchId: retailBranch.id,
      OR: [
        { externalId: "DEMO-REG-01" },
        { name: "Demo Cash Register - Counter 1" },
      ],
    },
  });

  if (terminal && (terminal.provider || terminal.providerTerminalId)) {
    throw new Error(`Existing demo terminal ${terminal.id} is configured with payment provider (${terminal.provider}). Aborting.`);
  }

  if (!terminal) {
    terminal = await prisma.posTerminal.create({
      data: {
        branchId: retailBranch.id,
        name: "Demo Cash Register - Counter 1",
        displayName: "Demo Cash Register",
        status: TerminalStatus.ONLINE,
        provider: null,
        providerTerminalId: null,
        externalId: "DEMO-REG-01",
      },
    });
    console.log(`  Created dedicated manual cash PosTerminal: ${terminal.name} (${terminal.id})`);
  } else {
    console.log(`  Preserved existing PosTerminal: ${terminal.name} (${terminal.id})`);
  }

  // Product categories
  const retailCategoriesDef = [
    { name: "Electronics & Accessories", description: "Cables, chargers, audio and mobile tech accessories" },
    { name: "Home Essentials", description: "Household cleaning supplies, kitchenware and home decor" },
    { name: "Personal Care", description: "Everyday grooming, skin care, oral health and wellness" },
    { name: "Stationery & Office", description: "Notebooks, pens, desk organizers and study supplies" },
    { name: "Grocery & Packaged Goods", description: "Snacks, beverages, coffee and shelf-stable pantry items" },
  ];

  const categoryMap = new Map<string, string>();
  for (const catDef of retailCategoriesDef) {
    let cat = await prisma.productCategory.findFirst({
      where: { organizationId: retailOrg.id, name: catDef.name },
    });
    if (!cat) {
      cat = await prisma.productCategory.create({
        data: {
          organizationId: retailOrg.id,
          name: catDef.name,
          description: catDef.description,
          isActive: true,
        },
      });
      console.log(`  Created ProductCategory: ${cat.name}`);
    }
    categoryMap.set(catDef.name, cat.id);
  }

  // Products definition (18 items with prices in AUD cents)
  const retailProductsDef = [
    {
      category: "Electronics & Accessories",
      sku: "ELEC-CBL-001",
      barcode: "9312345001014",
      name: "USB-C to Lightning Braided Cable 1.5m",
      description: "Durable nylon braided high-speed sync and charge cable, MFi certified.",
      sellingPrice: 1999,
      costPrice: 850,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 45,
      reorderThreshold: 10,
      imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Electronics & Accessories",
      sku: "ELEC-CHG-002",
      barcode: "9312345001021",
      name: "65W GaN Dual USB-C Fast Charger",
      description: "Ultra-compact Gallium Nitride wall charger with dual power delivery ports.",
      sellingPrice: 4495,
      costPrice: 2200,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 25,
      reorderThreshold: 5,
      imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Electronics & Accessories",
      sku: "ELEC-EAR-003",
      barcode: "9312345001038",
      name: "Wireless Bluetooth Earbuds Pro",
      description: "Active noise-cancelling in-ear headphones with 28-hour battery case.",
      sellingPrice: 8900,
      costPrice: 4500,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 15,
      reorderThreshold: 5,
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Electronics & Accessories",
      sku: "ELEC-MNT-004",
      barcode: "9312345001045",
      name: "Magnetic Phone Car Mount Holder",
      description: "Air-vent 360-degree rotating strong magnetic phone holder.",
      sellingPrice: 2450,
      costPrice: 1000,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 3,
      reorderThreshold: 5,
      imageUrl: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Home Essentials",
      sku: "HOME-BAM-001",
      barcode: "9312345002011",
      name: "Eco Bamboo Fiber Cutting Board Set",
      description: "Organic sustainably sourced bamboo chopping board set of 3 with juice groove.",
      sellingPrice: 2999,
      costPrice: 1200,
      taxRate: 0.10,
      unit: "set",
      stockQuantity: 30,
      reorderThreshold: 8,
      imageUrl: "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Home Essentials",
      sku: "HOME-BOT-002",
      barcode: "9312345002028",
      name: "Stainless Steel Insulated Water Bottle 750ml",
      description: "Double-wall vacuum insulation keeping drinks cold for 24h or hot for 12h.",
      sellingPrice: 2250,
      costPrice: 950,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 40,
      reorderThreshold: 10,
      imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Home Essentials",
      sku: "HOME-CLO-003",
      barcode: "9312345002035",
      name: "Microfiber Multi-Surface Cleaning Cloths (6-Pack)",
      description: "Lint-free, scratch-free ultra-absorbent reusable cleaning cloths.",
      sellingPrice: 1499,
      costPrice: 550,
      taxRate: 0.10,
      unit: "pack",
      stockQuantity: 50,
      reorderThreshold: 15,
      imageUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Home Essentials",
      sku: "HOME-GLS-004",
      barcode: "9312345002042",
      name: "Glass Meal Prep Containers (4-Pack Airtight)",
      description: "Borosilicate oven-safe glass containers with locking BPA-free lids.",
      sellingPrice: 3800,
      costPrice: 1800,
      taxRate: 0.10,
      unit: "pack",
      stockQuantity: 0,
      reorderThreshold: 5,
      imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Personal Care",
      sku: "CARE-WSH-001",
      barcode: "9312345003018",
      name: "Australian Botanical Hand Wash 500ml",
      description: "Gentle natural cleansing formulation with eucalyptus and lavender essential oils.",
      sellingPrice: 1295,
      costPrice: 480,
      taxRate: 0.10,
      unit: "bottle",
      stockQuantity: 35,
      reorderThreshold: 10,
      imageUrl: "https://images.unsplash.com/photo-1608248597359-5489f7831f24?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Personal Care",
      sku: "CARE-SHP-002",
      barcode: "9312345003025",
      name: "Organic Tea Tree Shampoo & Conditioner Set",
      description: "Sulphate-free purifying scalp care set with Australian tea tree extract.",
      sellingPrice: 2850,
      costPrice: 1250,
      taxRate: 0.10,
      unit: "set",
      stockQuantity: 20,
      reorderThreshold: 5,
      imageUrl: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Personal Care",
      sku: "CARE-SUN-003",
      barcode: "9312345003032",
      name: "Natural Mineral Sunscreen SPF 50+ 200ml",
      description: "Broad-spectrum zinc oxide sun protection, 4 hours water-resistant, reef-safe.",
      sellingPrice: 1899,
      costPrice: 750,
      taxRate: 0.10,
      unit: "tube",
      stockQuantity: 4,
      reorderThreshold: 8,
      imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Personal Care",
      sku: "CARE-TB-004",
      barcode: "9312345003049",
      name: "Bamboo Charcoal Toothbrush (Pack of 4)",
      description: "Biodegradable ergonomic bamboo handle with activated charcoal soft bristles.",
      sellingPrice: 999,
      costPrice: 300,
      taxRate: 0.10,
      unit: "pack",
      stockQuantity: 60,
      reorderThreshold: 15,
      imageUrl: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Stationery & Office",
      sku: "STAT-JRN-001",
      barcode: "9312345004015",
      name: "A5 Hardcover Dotted Journal Notebook",
      description: "160gsm bleed-proof paper, lay-flat thread binding, elastic closure, inner pocket.",
      sellingPrice: 1650,
      costPrice: 600,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 40,
      reorderThreshold: 10,
      imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Stationery & Office",
      sku: "STAT-PEN-002",
      barcode: "9312345004022",
      name: "Gel Roller Pens 0.5mm Black (Pack of 5)",
      description: "Quick-drying smudge-resistant pigment ink fine-point pens.",
      sellingPrice: 850,
      costPrice: 320,
      taxRate: 0.10,
      unit: "pack",
      stockQuantity: 55,
      reorderThreshold: 12,
      imageUrl: "https://images.unsplash.com/photo-1585336261026-c2a41f6c7717?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Stationery & Office",
      sku: "STAT-LPT-003",
      barcode: "9312345004039",
      name: "Aluminum Ergonomic Laptop Stand",
      description: "Foldable portable riser with heat dissipation vents, supports up to 17-inch devices.",
      sellingPrice: 4200,
      costPrice: 1900,
      taxRate: 0.10,
      unit: "piece",
      stockQuantity: 12,
      reorderThreshold: 4,
      imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Grocery & Packaged Goods",
      sku: "GROC-COF-001",
      barcode: "9312345005012",
      name: "Artisan Roasted Coffee Beans 500g (Jesmond Blend)",
      description: "Locally roasted 100% Arabica specialty blend with notes of chocolate and hazelnut.",
      sellingPrice: 2100,
      costPrice: 950,
      taxRate: 0.00,
      unit: "bag",
      stockQuantity: 30,
      reorderThreshold: 8,
      imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Grocery & Packaged Goods",
      sku: "GROC-MAC-002",
      barcode: "9312345005029",
      name: "Roasted Salted Australian Macadamias 250g",
      description: "Locally grown Australian macadamia nuts, dry roasted with Murray River pink salt.",
      sellingPrice: 1450,
      costPrice: 700,
      taxRate: 0.00,
      unit: "bag",
      stockQuantity: 2,
      reorderThreshold: 6,
      imageUrl: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80",
    },
    {
      category: "Grocery & Packaged Goods",
      sku: "GROC-WTR-003",
      barcode: "9312345005036",
      name: "Sparkling Natural Mineral Water 750ml",
      description: "Bottled at the source in pristine Australian highlands, crisp effervescence.",
      sellingPrice: 450,
      costPrice: 180,
      taxRate: 0.10,
      unit: "bottle",
      stockQuantity: 80,
      reorderThreshold: 20,
      imageUrl: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80",
    },
  ];

  for (const prodDef of retailProductsDef) {
    const categoryId = categoryMap.get(prodDef.category);

    const existingProduct = await prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: retailOrg.id,
          sku: prodDef.sku,
        },
      },
    });

    let product = existingProduct;
    if (!existingProduct) {
      product = await prisma.product.create({
        data: {
          organizationId: retailOrg.id,
          categoryId,
          sku: prodDef.sku,
          barcode: prodDef.barcode,
          name: prodDef.name,
          description: prodDef.description,
          sellingPrice: prodDef.sellingPrice,
          costPrice: prodDef.costPrice,
          taxRate: prodDef.taxRate,
          unit: prodDef.unit,
          imageUrl: prodDef.imageUrl,
          isActive: true,
        },
      });
      console.log(`  Created missing Product: ${product.name} [${product.sku}]`);
    } else {
      console.log(`  Preserved existing Product: ${existingProduct.name} [${existingProduct.sku}]`);
    }

    // Insert inventory ONLY if missing
    const existingInv = await prisma.inventory.findUnique({
      where: {
        branchId_productId: {
          branchId: retailBranch.id,
          productId: product!.id,
        },
      },
    });

    if (!existingInv) {
      await prisma.inventory.create({
        data: {
          branchId: retailBranch.id,
          productId: product!.id,
          quantity: prodDef.stockQuantity,
          reorderThreshold: prodDef.reorderThreshold,
        },
      });
    }
  }
  console.log(`  Retail products and inventory verification complete.`);

  // =========================================================================
  // 2. SERVICES: demo.services@jesmond.com.au
  // =========================================================================
  console.log("\n[2/3] Configuring Services Demo Business (demo.services@jesmond.com.au)...");

  const matchingServicesUsers = await prisma.user.findMany({
    where: { email: { equals: "demo.services@jesmond.com.au", mode: "insensitive" } },
  });
  if (matchingServicesUsers.length === 0) {
    throw new Error("Target user demo.services@jesmond.com.au not found!");
  }
  if (matchingServicesUsers.length > 1) {
    throw new Error(`Ambiguous user identity: ${matchingServicesUsers.length} users found with email demo.services@jesmond.com.au!`);
  }
  const servicesUser = matchingServicesUsers[0];
  if (servicesUser.accountStatus !== AccountStatus.ACTIVE) {
    throw new Error(`Target user demo.services@jesmond.com.au status is ${servicesUser.accountStatus} (expected ACTIVE)!`);
  }
  if (servicesUser.role !== UserRole.ORG_STAFF) {
    throw new Error(`Target user demo.services@jesmond.com.au role is ${servicesUser.role} (expected ORG_STAFF)!`);
  }

  const existingServicesStaff = await prisma.orgStaff.findFirst({
    where: {
      userId: servicesUser.id,
      organizationId: { not: SERVICES_ORG_ID },
    },
  });
  if (existingServicesStaff) {
    throw new Error(
      `Account demo.services@jesmond.com.au is already associated with unrelated organisation ID: ${existingServicesStaff.organizationId}. Aborting.`
    );
  }

  let servicesOrg = await prisma.organization.findUnique({
    where: { id: SERVICES_ORG_ID },
  });

  if (servicesOrg) {
    if (
      servicesOrg.name !== "Jesmond Demo Services" ||
      servicesOrg.type !== OrgType.RETAIL ||
      servicesOrg.businessCategory !== BusinessCategory.SERVICES
    ) {
      throw new Error(
        `Deterministic Org ID ${SERVICES_ORG_ID} belongs to unexpected organization (${servicesOrg.name}/${servicesOrg.type}/${servicesOrg.businessCategory})!`
      );
    }
    servicesOrg = await prisma.organization.update({
      where: { id: servicesOrg.id },
      data: { isPubliclyVisible: true },
    });
    console.log(`  Verified & updated Organization: ${servicesOrg.name} (${servicesOrg.id})`);
  } else {
    const orgByName = await prisma.organization.findFirst({
      where: { name: "Jesmond Demo Services" },
    });
    if (orgByName) {
      throw new Error(`An organization named 'Jesmond Demo Services' already exists with ID ${orgByName.id}!`);
    }

    servicesOrg = await prisma.organization.create({
      data: {
        id: SERVICES_ORG_ID,
        name: "Jesmond Demo Services",
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.SERVICES,
        status: OrgStatus.PENDING,
        isPubliclyVisible: true,
        timezone: "Australia/Sydney",
      },
    });
    console.log(`  Created Organization: ${servicesOrg.name} (${servicesOrg.id})`);
  }

  let servicesBranch = await prisma.retailBranch.findUnique({
    where: { id: SERVICES_BRANCH_ID },
  });

  if (servicesBranch) {
    if (servicesBranch.organizationId !== servicesOrg.id) {
      throw new Error(`Deterministic Branch ID ${SERVICES_BRANCH_ID} belongs to another org: ${servicesBranch.organizationId}!`);
    }
  } else {
    const branchesByName = await prisma.retailBranch.findMany({
      where: { organizationId: servicesOrg.id, name: "Jesmond Demo Services - Main Branch" },
    });
    if (branchesByName.length > 1) {
      throw new Error(`Ambiguous branch identity: multiple branches found with name 'Jesmond Demo Services - Main Branch'!`);
    } else if (branchesByName.length === 1) {
      servicesBranch = branchesByName[0];
    } else {
      const unrelatedBranch = await prisma.retailBranch.findFirst({
        where: { name: "Jesmond Demo Services - Main Branch", organizationId: { not: servicesOrg.id } },
      });
      if (unrelatedBranch) {
        throw new Error(`A branch named 'Jesmond Demo Services - Main Branch' belongs to another org!`);
      }

      servicesBranch = await prisma.retailBranch.create({
        data: {
          id: SERVICES_BRANCH_ID,
          organizationId: servicesOrg.id,
          name: "Jesmond Demo Services - Main Branch",
          address: null,
          isActive: true,
        },
      });
      console.log(`  Created RetailBranch: ${servicesBranch.name}`);
    }
  }

  const existingServicesStaffRecord = await prisma.orgStaff.findUnique({
    where: {
      userId_organizationId: {
        userId: servicesUser.id,
        organizationId: servicesOrg.id,
      },
    },
  });

  let servicesStaffId = existingServicesStaffRecord?.id;
  if (!existingServicesStaffRecord) {
    const newStaff = await prisma.orgStaff.create({
      data: {
        userId: servicesUser.id,
        organizationId: servicesOrg.id,
        role: UserRole.ORG_STAFF,
        retailBranchId: servicesBranch.id,
        permissions: BUSINESS_PERMISSIONS,
      },
    });
    servicesStaffId = newStaff.id;
    console.log(`  Created OrgStaff with explicit business permissions`);
  } else {
    await prisma.orgStaff.update({
      where: { id: existingServicesStaffRecord.id },
      data: {
        retailBranchId: existingServicesStaffRecord.retailBranchId ?? servicesBranch.id,
      },
    });
    console.log(`  Preserved existing OrgStaff permissions for: ${existingServicesStaffRecord.id}`);
  }

  // Working hours: Insert ONLY missing schedules
  for (let day = 1; day <= 6; day++) {
    const existing = await prisma.staffWorkingHours.findFirst({
      where: { staffId: servicesStaffId!, dayOfWeek: day },
    });
    if (!existing) {
      await prisma.staffWorkingHours.create({
        data: {
          staffId: servicesStaffId!,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "17:00",
        },
      });
    }
  }

  // Service categories
  const servicesCategoriesDef = [
    { name: "Cleaning & Domestic Services", description: "Professional home and commercial cleaning solutions" },
    { name: "Plumbing & Electrical Maintenance", description: "Certified residential repairs and routine safety compliance" },
    { name: "Assembly & Handyman", description: "Furniture installation, fittings, repairs and wall fixtures" },
  ];

  const serviceCatMap = new Map<string, string>();
  for (const catDef of servicesCategoriesDef) {
    let cat = await prisma.serviceCategory.findFirst({
      where: { organizationId: servicesOrg.id, name: catDef.name },
    });
    if (!cat) {
      cat = await prisma.serviceCategory.create({
        data: {
          organizationId: servicesOrg.id,
          name: catDef.name,
          description: catDef.description,
          isActive: true,
        },
      });
    }
    serviceCatMap.set(catDef.name, cat.id);
  }

  // 9 realistic services (AUD cents)
  const servicesDef = [
    {
      category: "Cleaning & Domestic Services",
      name: "Residential Home Cleaning (Standard)",
      description: "Thorough general cleaning: dusting, vacuuming, mopping, bathroom sanitising, and kitchen surface wipe-down.",
      durationMins: 60,
      price: 8000,
    },
    {
      category: "Cleaning & Domestic Services",
      name: "End of Lease & Deep Cleaning",
      description: "Comprehensive bond cleaning including oven interior, rangehood, skirting boards, windows, and sanitised bathrooms.",
      durationMins: 120,
      price: 18000,
    },
    {
      category: "Cleaning & Domestic Services",
      name: "Carpet Steam Cleaning (2 Rooms)",
      description: "High-pressure hot water extraction and deodorising treatment for up to 2 carpeted rooms.",
      durationMins: 60,
      price: 9500,
    },
    {
      category: "Plumbing & Electrical Maintenance",
      name: "Plumbing Inspection & Minor Leak Repair",
      description: "Inspection of taps, toilets, traps, and flexi-hoses plus replacement of worn washers or valves.",
      durationMins: 45,
      price: 9000,
    },
    {
      category: "Plumbing & Electrical Maintenance",
      name: "Hot Water System & Drain Assessment",
      description: "Pressure relief valve testing, temperature validation, flow rate verification, and drain clearance inspection.",
      durationMins: 60,
      price: 12000,
    },
    {
      category: "Plumbing & Electrical Maintenance",
      name: "Electrical Safety Inspection & Smoke Alarm Testing",
      description: "AS/NZS 3000 compliance check, safety switch RCD trip testing, and interconnected smoke alarm verification.",
      durationMins: 45,
      price: 8500,
    },
    {
      category: "Plumbing & Electrical Maintenance",
      name: "Ceiling Fan & Light Fixture Installation",
      description: "Professional licensed installation or replacement of standard pendant lights, downlights, or ceiling fans.",
      durationMins: 60,
      price: 11000,
    },
    {
      category: "Assembly & Handyman",
      name: "Flat-Pack Furniture Assembly (Up to 2 Items)",
      description: "Precision assembly of flat-pack desks, bed frames, bookcases, or dining tables with anchoring if needed.",
      durationMins: 60,
      price: 7500,
    },
    {
      category: "Assembly & Handyman",
      name: "General Handyman & Wall Mounting Service",
      description: "TV wall mounting, picture hanging, curtain rails, door latch repairs, and minor dry-wall patch touch-ups.",
      durationMins: 45,
      price: 7000,
    },
  ];

  for (const sDef of servicesDef) {
    const categoryId = serviceCatMap.get(sDef.category);

    const existingService = await prisma.businessService.findFirst({
      where: {
        organizationId: servicesOrg.id,
        name: sDef.name,
      },
    });

    let serviceId = existingService?.id;
    if (!existingService) {
      const created = await prisma.businessService.create({
        data: {
          organizationId: servicesOrg.id,
          branchId: servicesBranch.id,
          categoryId,
          name: sDef.name,
          description: sDef.description,
          durationMins: sDef.durationMins,
          price: sDef.price,
          currency: "AUD",
          isActive: true,
        },
      });
      serviceId = created.id;
    }

    // Insert staff assignment ONLY if missing
    const existingAssignment = await prisma.staffServiceAssignment.findUnique({
      where: {
        staffId_serviceId: {
          staffId: servicesStaffId!,
          serviceId: serviceId!,
        },
      },
    });

    if (!existingAssignment) {
      await prisma.staffServiceAssignment.create({
        data: {
          staffId: servicesStaffId!,
          serviceId: serviceId!,
        },
      });
    }
  }
  console.log(`  Services catalogue verification complete.`);

  // =========================================================================
  // 3. MECHANICS: demo.mechanics@jesmond.com.au
  // =========================================================================
  console.log("\n[3/3] Configuring Mechanics Demo Business (demo.mechanics@jesmond.com.au)...");

  const matchingMechanicsUsers = await prisma.user.findMany({
    where: { email: { equals: "demo.mechanics@jesmond.com.au", mode: "insensitive" } },
  });
  if (matchingMechanicsUsers.length === 0) {
    throw new Error("Target user demo.mechanics@jesmond.com.au not found!");
  }
  if (matchingMechanicsUsers.length > 1) {
    throw new Error(`Ambiguous user identity: ${matchingMechanicsUsers.length} users found with email demo.mechanics@jesmond.com.au!`);
  }
  const mechanicsUser = matchingMechanicsUsers[0];
  if (mechanicsUser.accountStatus !== AccountStatus.ACTIVE) {
    throw new Error(`Target user demo.mechanics@jesmond.com.au status is ${mechanicsUser.accountStatus} (expected ACTIVE)!`);
  }
  if (mechanicsUser.role !== UserRole.ORG_STAFF) {
    throw new Error(`Target user demo.mechanics@jesmond.com.au role is ${mechanicsUser.role} (expected ORG_STAFF)!`);
  }

  const existingMechanicsStaff = await prisma.orgStaff.findFirst({
    where: {
      userId: mechanicsUser.id,
      organizationId: { not: MECHANICS_ORG_ID },
    },
  });
  if (existingMechanicsStaff) {
    throw new Error(
      `Account demo.mechanics@jesmond.com.au is already associated with unrelated organisation ID: ${existingMechanicsStaff.organizationId}. Aborting.`
    );
  }

  let mechanicsOrg = await prisma.organization.findUnique({
    where: { id: MECHANICS_ORG_ID },
  });

  if (mechanicsOrg) {
    if (
      mechanicsOrg.name !== "Jesmond Demo Mechanics" ||
      mechanicsOrg.type !== OrgType.RETAIL ||
      mechanicsOrg.businessCategory !== BusinessCategory.MECHANICS
    ) {
      throw new Error(
        `Deterministic Org ID ${MECHANICS_ORG_ID} belongs to unexpected organization (${mechanicsOrg.name}/${mechanicsOrg.type}/${mechanicsOrg.businessCategory})!`
      );
    }
    mechanicsOrg = await prisma.organization.update({
      where: { id: mechanicsOrg.id },
      data: { isPubliclyVisible: true },
    });
    console.log(`  Verified & updated Organization: ${mechanicsOrg.name} (${mechanicsOrg.id})`);
  } else {
    const orgByName = await prisma.organization.findFirst({
      where: { name: "Jesmond Demo Mechanics" },
    });
    if (orgByName) {
      throw new Error(`An organization named 'Jesmond Demo Mechanics' already exists with ID ${orgByName.id}!`);
    }

    mechanicsOrg = await prisma.organization.create({
      data: {
        id: MECHANICS_ORG_ID,
        name: "Jesmond Demo Mechanics",
        type: OrgType.RETAIL,
        businessCategory: BusinessCategory.MECHANICS,
        status: OrgStatus.PENDING,
        isPubliclyVisible: true,
        timezone: "Australia/Sydney",
      },
    });
    console.log(`  Created Organization: ${mechanicsOrg.name} (${mechanicsOrg.id})`);
  }

  let mechanicsBranch = await prisma.retailBranch.findUnique({
    where: { id: MECHANICS_BRANCH_ID },
  });

  if (mechanicsBranch) {
    if (mechanicsBranch.organizationId !== mechanicsOrg.id) {
      throw new Error(`Deterministic Branch ID ${MECHANICS_BRANCH_ID} belongs to another org: ${mechanicsBranch.organizationId}!`);
    }
  } else {
    const branchesByName = await prisma.retailBranch.findMany({
      where: { organizationId: mechanicsOrg.id, name: "Jesmond Demo Mechanics - Workshop" },
    });
    if (branchesByName.length > 1) {
      throw new Error(`Ambiguous branch identity: multiple branches found with name 'Jesmond Demo Mechanics - Workshop'!`);
    } else if (branchesByName.length === 1) {
      mechanicsBranch = branchesByName[0];
    } else {
      const unrelatedBranch = await prisma.retailBranch.findFirst({
        where: { name: "Jesmond Demo Mechanics - Workshop", organizationId: { not: mechanicsOrg.id } },
      });
      if (unrelatedBranch) {
        throw new Error(`A branch named 'Jesmond Demo Mechanics - Workshop' belongs to another org!`);
      }

      mechanicsBranch = await prisma.retailBranch.create({
        data: {
          id: MECHANICS_BRANCH_ID,
          organizationId: mechanicsOrg.id,
          name: "Jesmond Demo Mechanics - Workshop",
          address: null,
          isActive: true,
        },
      });
      console.log(`  Created RetailBranch: ${mechanicsBranch.name}`);
    }
  }

  const existingMechanicsStaffRecord = await prisma.orgStaff.findUnique({
    where: {
      userId_organizationId: {
        userId: mechanicsUser.id,
        organizationId: mechanicsOrg.id,
      },
    },
  });

  let mechanicsStaffId = existingMechanicsStaffRecord?.id;
  if (!existingMechanicsStaffRecord) {
    const newStaff = await prisma.orgStaff.create({
      data: {
        userId: mechanicsUser.id,
        organizationId: mechanicsOrg.id,
        role: UserRole.ORG_STAFF,
        retailBranchId: mechanicsBranch.id,
        permissions: BUSINESS_PERMISSIONS,
      },
    });
    mechanicsStaffId = newStaff.id;
    console.log(`  Created OrgStaff with explicit business permissions`);
  } else {
    await prisma.orgStaff.update({
      where: { id: existingMechanicsStaffRecord.id },
      data: {
        retailBranchId: existingMechanicsStaffRecord.retailBranchId ?? mechanicsBranch.id,
      },
    });
    console.log(`  Preserved existing OrgStaff permissions for: ${existingMechanicsStaffRecord.id}`);
  }

  // Working hours: Insert ONLY missing schedules
  for (let day = 1; day <= 6; day++) {
    const existing = await prisma.staffWorkingHours.findFirst({
      where: { staffId: mechanicsStaffId!, dayOfWeek: day },
    });
    if (!existing) {
      await prisma.staffWorkingHours.create({
        data: {
          staffId: mechanicsStaffId!,
          dayOfWeek: day,
          startTime: "08:00",
          endTime: "17:00",
        },
      });
    }
  }

  // Service categories
  const mechanicsCategoriesDef = [
    { name: "Diagnostics & Roadworthy Inspections", description: "Computerised diagnostics, safety audits, and roadworthy testing" },
    { name: "Brakes, Tyres & Suspension", description: "Braking system overhaul, precision alignment, tyre rotation and shocks" },
    { name: "Engine Maintenance & Scheduled Servicing", description: "Full synthetic oil services, manufacturer logbook maintenance and tune-ups" },
  ];

  const mechanicsCatMap = new Map<string, string>();
  for (const catDef of mechanicsCategoriesDef) {
    let cat = await prisma.serviceCategory.findFirst({
      where: { organizationId: mechanicsOrg.id, name: catDef.name },
    });
    if (!cat) {
      cat = await prisma.serviceCategory.create({
        data: {
          organizationId: mechanicsOrg.id,
          name: catDef.name,
          description: catDef.description,
          isActive: true,
        },
      });
    }
    mechanicsCatMap.set(catDef.name, cat.id);
  }

  // 11 realistic workshop services (AUD cents)
  const mechanicsServicesDef = [
    {
      category: "Diagnostics & Roadworthy Inspections",
      name: "Comprehensive Vehicle Safety Inspection",
      description: "60-point mechanical safety audit: brakes, tyres, steering, suspension, fluids, hoses, belts, battery, lights and underbody visual check with full report.",
      durationMins: 45,
      price: 8900,
    },
    {
      category: "Diagnostics & Roadworthy Inspections",
      name: "Engine Diagnostic & Fault Code Scan",
      description: "OBD-II computer scanning, error code readout, sensor live data verification, clear stored trouble codes, and mechanic diagnostic consultation.",
      durationMins: 30,
      price: 7900,
    },
    {
      category: "Diagnostics & Roadworthy Inspections",
      name: "Pre-Purchase Vehicle Mechanical Inspection",
      description: "Independent multi-system assessment for prospective car buyers: chassis alignment, rust check, road test, engine compression, and electronic health report.",
      durationMins: 60,
      price: 14900,
    },
    {
      category: "Brakes, Tyres & Suspension",
      name: "Front or Rear Brake Pad Replacement",
      description: "Installation of premium low-dust ceramic brake pads, rotor thickness measurement, caliper pin lubrication, and road deceleration test (labour & pads included).",
      durationMins: 60,
      price: 18900,
    },
    {
      category: "Brakes, Tyres & Suspension",
      name: "Complete Brake Fluid Flush & Hydraulic Bleed",
      description: "Pressure flush of contaminated hydraulic fluid, refill with premium DOT 4 brake fluid, four-corner power bleed and pedal firmness test.",
      durationMins: 45,
      price: 9900,
    },
    {
      category: "Brakes, Tyres & Suspension",
      name: "Four-Wheel Computerised Laser Alignment",
      description: "Precision laser measurement and adjustment of camber, caster, and toe to factory specifications to eliminate tyre feathering and steering drift.",
      durationMins: 45,
      price: 8500,
    },
    {
      category: "Brakes, Tyres & Suspension",
      name: "Tyre Rotation, Balance & Pressure Optimization",
      description: "Cross-rotation of 4 tyres, high-speed dynamic wheel balancing, tread depth inspection, valve check, and nitrogen-level pressure calibration.",
      durationMins: 30,
      price: 5500,
    },
    {
      category: "Engine Maintenance & Scheduled Servicing",
      name: "Essential Engine Oil & Filter Service",
      description: "Up to 5L premium full-synthetic motor oil, OEM-grade spin-on/cartridge oil filter, sump washer replacement, 25-point safety check, and fluid level top-ups.",
      durationMins: 45,
      price: 14900,
    },
    {
      category: "Engine Maintenance & Scheduled Servicing",
      name: "Major Scheduled Logbook Service",
      description: "Full manufacturer logbook warranty service: full-synthetic oil, oil filter, engine air filter, cabin pollen filter, spark plug check, brake fluid check, battery test, tyre rotation and logbook stamping.",
      durationMins: 90,
      price: 29900,
    },
    {
      category: "Engine Maintenance & Scheduled Servicing",
      name: "Automotive Battery Test & Replacement",
      description: "Digital battery conductance test, starter load test, alternator output check, supply and fitting of high-CCA maintenance-free battery with 2-year warranty.",
      durationMins: 30,
      price: 16500,
    },
    {
      category: "Engine Maintenance & Scheduled Servicing",
      name: "Air Conditioning System Service & Regas",
      description: "Refrigerant recovery, deep vacuum moisture dehydration, system leak test, fresh PAG oil addition, precise R134a refrigerant regas and vent temp verification.",
      durationMins: 60,
      price: 17900,
    },
  ];

  for (const mDef of mechanicsServicesDef) {
    const categoryId = mechanicsCatMap.get(mDef.category);

    const existingService = await prisma.businessService.findFirst({
      where: {
        organizationId: mechanicsOrg.id,
        name: mDef.name,
      },
    });

    let serviceId = existingService?.id;
    if (!existingService) {
      const created = await prisma.businessService.create({
        data: {
          organizationId: mechanicsOrg.id,
          branchId: mechanicsBranch.id,
          categoryId,
          name: mDef.name,
          description: mDef.description,
          durationMins: mDef.durationMins,
          price: mDef.price,
          currency: "AUD",
          isActive: true,
        },
      });
      serviceId = created.id;
    }

    // Insert staff assignment ONLY if missing
    const existingAssignment = await prisma.staffServiceAssignment.findUnique({
      where: {
        staffId_serviceId: {
          staffId: mechanicsStaffId!,
          serviceId: serviceId!,
        },
      },
    });

    if (!existingAssignment) {
      await prisma.staffServiceAssignment.create({
        data: {
          staffId: mechanicsStaffId!,
          serviceId: serviceId!,
        },
      });
    }
  }
  console.log(`  Mechanics workshop services verification complete.`);

  console.log("\n=== Demo Businesses Seeding Completed Successfully! ===");
}

if (require.main === module) {
  seedDemoBusinesses()
    .catch((err) => {
      console.error("Error seeding demo businesses:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
