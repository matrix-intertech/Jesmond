const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');
const crypto = require('crypto');
const prisma = new PrismaClient();

const CANONICAL_PROPERTY_NAMES = [
  'JES Demo House', 'JES Demo Apartment', 'JES Demo Studio', 'JES Demo Granny Flat',
  'JES Demo Townhouse', 'JES Demo Unit', 'JES Demo Duplex', 'JES Demo Other Space'
];
const PROTECTED_EMAILS = ['shikharshaurya.01@gmail.com', 'allienshaurya@gmail.com', 'ssmnvi012@gmail.com'];

function getFingerprint(hash) {
  if (!hash) return null;
  return crypto.createHash('sha256').update(hash).digest('hex');
}

async function runRefresh() {
  console.log("=== PRODUCTION DEMO DATA REFRESH ===");
  const confirmProd = process.env.CONFIRM_PRODUCTION === 'true';
  const isConfirm = process.argv.includes('--confirm');

  if (!confirmProd || !isConfirm) {
    console.error("ABORT: Both CONFIRM_PRODUCTION=true and --confirm flags are strictly required to execute mutation.");
    process.exit(1);
  }

  try {
    // 1. PRE-MUTATION VERIFICATION & HASH CAPTURE
    console.log("[1] Pre-mutation checks...");
    const users = await prisma.user.findMany({ where: { email: { in: PROTECTED_EMAILS } } });
    if (users.length !== 3) {
      console.error("CRITICAL: Expected 3 protected users, found " + users.length);
      process.exit(1);
    }
    
    const preHashes = {};
    for (const u of users) {
      preHashes[u.email] = getFingerprint(u.password);
    }

    const targets = JSON.parse(fs.readFileSync('scripts/production_demo_refresh_targets.json', 'utf8'));
    if (!targets.propertiesToDelete || !targets.organizationsToDelete) {
      console.error("CRITICAL: Targets JSON is malformed.");
      process.exit(1);
    }

    if (targets.propertiesToDelete.length === 0 && targets.organizationsToDelete.length === 0) {
      console.log("WARNING: Target list is empty. Proceeding with role patching and seed only.");
    }

    const accidentallyTargeted = targets.propertiesToDelete.filter(p => CANONICAL_PROPERTY_NAMES.includes(p.name));
    if (accidentallyTargeted.length > 0) {
      console.error("CRITICAL ERROR: A canonical property is in the deletion list!");
      process.exit(1);
    }

    console.log(`\nDeleting ${targets.propertiesToDelete.length} properties and ${targets.organizationsToDelete.length} organizations.`);

    // 2. CLEANUP PROPERTIES
    console.log("\n[2] Executing explicit property cleanup...");
    let deletedProps = 0;
    for (const p of targets.propertiesToDelete) {
      try {
        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM "Invoice" WHERE "leaseId" IN (SELECT id FROM "Lease" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})))`,
          prisma.$executeRaw`DELETE FROM "Document" WHERE "leaseId" IN (SELECT id FROM "Lease" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})))`,
          prisma.$executeRaw`DELETE FROM "Document" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id}))`,
          prisma.$executeRaw`DELETE FROM "Lease" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id}))`,
          prisma.$executeRaw`DELETE FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "AvailabilityCalendar" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "PricingHistory" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "Room" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "RoomType" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Floor" WHERE "buildingId" IN (SELECT id FROM "Building" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "Building" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Resident" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "MaintenanceRequest" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Media" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "PropertyAmenity" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "RecentlyViewed" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "PropertyVersion" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "SavedProperty" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Enquiry" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "HouseRule" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Property" WHERE "id" = ${p.id}`
        ]);
        deletedProps++;
      } catch (err) {
        console.error(`ERROR: Failed to delete property ${p.id}:`, err.message);
        process.exit(1);
      }
    }

    // 3. CLEANUP ORGANIZATIONS
    console.log("\n[3] Executing explicit organization cleanup...");
    let deletedOrgs = 0;
    for (const o of targets.organizationsToDelete) {
      try {
        const categories = await prisma.productCategory.findMany({
          where: { organizationId: o.id },
          select: { id: true, parentId: true }
        });
        
        let currentCategories = [...categories];
        const categoryDeletionQueries = [];
        
        while (currentCategories.length > 0) {
          const parentIds = new Set(currentCategories.map(c => c.parentId).filter(id => id != null));
          const leaves = currentCategories.filter(c => !parentIds.has(c.id));
          if (leaves.length === 0) throw new Error("Cycle detected");
          const leafIds = leaves.map(l => l.id);
          categoryDeletionQueries.push(
            prisma.$executeRaw`DELETE FROM "ProductCategory" WHERE "id" IN (${Prisma.join(leafIds)})`
          );
          currentCategories = currentCategories.filter(c => !leafIds.includes(c.id));
        }

        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM "RetailPayment" WHERE "orderId" IN (SELECT id FROM "SalesOrder" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "SalesOrderItem" WHERE "orderId" IN (SELECT id FROM "SalesOrder" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "SalesOrder" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "RetailCustomer" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "PosSyncJob" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "PosWebhookEvent" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "InventoryMovement" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "Inventory" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "Product" WHERE "organizationId" = ${o.id}`,
          ...categoryDeletionQueries,
          prisma.$executeRaw`DELETE FROM "PosTerminal" WHERE "branchId" IN (SELECT id FROM "RetailBranch" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "RetailBranch" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "ApiKey" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "OrgStaff" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "Office" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${o.id}`
        ]);
        deletedOrgs++;
      } catch (err) {
        console.error(`ERROR: Failed to delete org ${o.id}:`, err.message);
        process.exit(1);
      }
    }

    // 4. ROLE CORRECTION
    console.log("\n[4] Role correction...");
    await prisma.user.update({ where: { email: 'shikharshaurya.01@gmail.com' }, data: { role: 'ORG_STAFF' } });
    await prisma.user.update({ where: { email: 'allienshaurya@gmail.com' }, data: { role: 'ORG_STAFF' } });
    await prisma.user.update({ where: { email: 'ssmnvi012@gmail.com' }, data: { role: 'STUDENT' } });

    // 5. CANONICAL HOST SEED
    console.log("\n[5] Canonical Host Seed...");
    const hostUser = await prisma.user.findUnique({ where: { email: 'allienshaurya@gmail.com' } });
    let hostOrg = await prisma.organization.findFirst({ where: { type: 'PROVIDER', name: 'Jesmond Demo Host' }});
    if (!hostOrg) {
      hostOrg = await prisma.organization.create({
        data: { name: 'Jesmond Demo Host', type: 'PROVIDER', status: 'VERIFIED' }
      });
      await prisma.orgStaff.create({ data: { userId: hostUser.id, organizationId: hostOrg.id, role: 'ADMIN' }});
    }

    const suburb = await prisma.suburb.findFirst();
    if (!suburb) {
      console.error("CRITICAL: No suburb found for property assignment.");
      process.exit(1);
    }
    
    const canonicalHostProps = [
      { name: 'JES Demo House', type: 'HOUSE', config: { bedrooms: 3, bathrooms: 2, parkingSpaces: 2 }, contact: true, price: 50000 },
      { name: 'JES Demo Apartment', type: 'APARTMENT', config: { bedrooms: 2, bathrooms: 2, parkingSpaces: 1 }, contact: false, price: 45000 },
      { name: 'JES Demo Studio', type: 'STUDIO', config: { bedrooms: 1, bathrooms: 1, parkingSpaces: 0 }, contact: true, price: 30000 },
      { name: 'JES Demo Granny Flat', type: 'GRANNY_FLAT', config: { bedrooms: 1, bathrooms: 1, parkingSpaces: 1 }, contact: false, price: 25000 },
      { name: 'JES Demo Townhouse', type: 'TOWNHOUSE', config: { bedrooms: 3, bathrooms: 2, parkingSpaces: 1 }, contact: true, price: 48000 },
      { name: 'JES Demo Unit', type: 'UNIT', config: { bedrooms: 2, bathrooms: 1, parkingSpaces: 1 }, contact: false, price: 38000 },
      { name: 'JES Demo Duplex', type: 'DUPLEX', config: { bedrooms: 4, bathrooms: 2, parkingSpaces: 2 }, contact: true, price: 55000 },
      { name: 'JES Demo Other Space', type: 'OTHER', config: { bedrooms: 1, bathrooms: 1 }, contact: false, price: 20000 }
    ];

    let lat = suburb.lat || -33.8688;
    let lng = suburb.lng || 151.2093;

    for (let p of canonicalHostProps) {
      const existing = await prisma.property.findFirst({ where: { name: p.name, organizationId: hostOrg.id } });
      if (!existing) {
        lat += 0.001; lng += 0.001;
        await prisma.property.create({
          data: {
            name: p.name,
            organization: { connect: { id: hostOrg.id } },
            suburb: { connect: { id: suburb.id } },
            propertyType: p.type,
            configuration: p.config,
            showContactDetails: p.contact,
            description: `A lovely ${p.type} located in ${suburb.name}. Perfect for students and professionals.`,
            status: 'PUBLISHED',
            address: `123 ${suburb.name} St`,
            postcode: suburb.postcode || '2000',
            lat, lng, minimumStay: 30,
            roomTypes: {
              create: {
                name: 'Standard Room',
                description: 'Default room type',
                pricePerWeek: p.price,
                inventory: 1,
                pricingHistory: {
                  create: { pricePerWeek: p.price, effectiveFrom: new Date() }
                }
              }
            }
          }
        });
        console.log(`Seeded property: ${p.name}`);
      }
    }

    // 6. CANONICAL RETAIL SEED
    console.log("\n[6] Canonical Retail Seed...");
    const retailUser = await prisma.user.findUnique({ where: { email: 'shikharshaurya.01@gmail.com' } });
    let retailOrg = await prisma.organization.findFirst({ where: { type: 'RETAIL', name: 'Jesmond Demo Retail' }});
    if (!retailOrg) {
      retailOrg = await prisma.organization.create({
        data: { name: 'Jesmond Demo Retail', type: 'RETAIL', status: 'VERIFIED' }
      });
      await prisma.orgStaff.create({ data: { userId: retailUser.id, organizationId: retailOrg.id, role: 'ADMIN' }});
    }

    const retailProducts = [
      { sku: 'JES-DEMO-001', name: 'Premium Coffee Beans', description: '250g Arabica dark roast', price: 1500, stock: 40 },
      { sku: 'JES-DEMO-002', name: 'Notebook A5', description: 'Ruled 100 pages', price: 500, stock: 150 },
      { sku: 'JES-DEMO-003', name: 'Ergonomic Chair', description: 'Office desk chair with lumbar support', price: 12000, stock: 10 },
      { sku: 'JES-DEMO-004', name: 'Wireless Mouse', description: 'Bluetooth rechargeable mouse', price: 2500, stock: 35 },
      { sku: 'JES-DEMO-005', name: 'Desk Lamp', description: 'LED adjustable brightness', price: 3500, stock: 25 },
      { sku: 'JES-DEMO-006', name: 'Water Bottle 1L', description: 'Stainless steel insulated', price: 2000, stock: 80 },
      { sku: 'JES-DEMO-007', name: 'Backpack', description: 'Laptop backpack 15 inch', price: 5000, stock: 20 },
      { sku: 'JES-DEMO-008', name: 'Mechanical Keyboard', description: 'Blue switches TKL', price: 7500, stock: 15 }
    ];

    for (let p of retailProducts) {
      const existing = await prisma.product.findFirst({ where: { sku: p.sku, organizationId: retailOrg.id } });
      if (!existing) {
        await prisma.product.create({
          data: {
            organizationId: retailOrg.id, sku: p.sku, name: p.name,
            description: p.description, sellingPrice: p.price, unit: 'piece', isActive: true
          }
        });
        console.log(`Seeded product: ${p.sku}`);
      }
    }

    let branch = await prisma.retailBranch.findFirst({ where: { organizationId: retailOrg.id, name: 'Demo Store Main' } });
    if (!branch) {
      branch = await prisma.retailBranch.create({
        data: { organizationId: retailOrg.id, name: 'Demo Store Main', location: 'Sydney CBD', isActive: true }
      });
    }

    let terminal = await prisma.posTerminal.findFirst({ where: { branchId: branch.id, name: 'Terminal-Alpha' } });
    if (!terminal) {
      terminal = await prisma.posTerminal.create({
        data: { branchId: branch.id, name: 'Terminal-Alpha', isActive: true, status: 'ONLINE' }
      });
    }

    // 7. CO-LIVING / STUDENT
    console.log("\n[7] Co-living / Student processing...");
    console.log("No co-living/resident seed data defined in canonical scripts. Skipping.");

    // 8. FINAL HASH CHECK
    console.log("\n[8] Final Password Integrity Check...");
    const postUsers = await prisma.user.findMany({ where: { email: { in: PROTECTED_EMAILS } } });
    for (const u of postUsers) {
      const postHash = getFingerprint(u.password);
      if (preHashes[u.email] !== postHash) {
        console.error(`CRITICAL INTEGRITY FAILURE: Password hash changed for ${u.email}!`);
        process.exit(1);
      }
    }
    console.log("SUCCESS: All protected password hashes are untouched.");
    console.log("Refresh completed.");

  } catch (err) {
    console.error("Refresh error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRefresh();

