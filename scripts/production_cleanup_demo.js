const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

const args = process.argv.slice(2);
const isConfirm = args.includes('--confirm');
const isDryRun = args.includes('--dry-run');
const confirmProd = process.env.CONFIRM_PRODUCTION === 'true';

const PROTECTED_EMAILS = ['shikharshaurya.01@gmail.com', 'allienshaurya@gmail.com', 'ssmnvi012@gmail.com'];

async function cleanupDemo() {
  console.log("=== PRODUCTION DEMO CLEANUP ===");
  console.log("DATABASE HOST: " + (process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || "Unknown"));
  console.log("DATABASE NAME: " + (process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || "Unknown"));
  console.log("DATABASE USER: " + (process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || "Unknown"));

  if (isConfirm && !confirmProd) {
    console.error("\nABORT: CONFIRM_PRODUCTION=true is required to execute deletion.");
    process.exit(1);
  }

  try {
    let targets = { properties: [], retailOrganizations: [] };
    if (fs.existsSync('scripts/production_cleanup_targets.json')) {
      targets = JSON.parse(fs.readFileSync('scripts/production_cleanup_targets.json', 'utf8'));
    }

    if (!isDryRun && !isConfirm) {
      console.log("\nPHASE A - DISCOVERY MODE (No deletion)");
      const properties = await prisma.property.findMany({
        where: { OR: [{ name: { contains: 'test', mode: 'insensitive' } }, { name: { contains: 'demo', mode: 'insensitive' } }] },
        include: { organization: { include: { staff: { include: { user: true } } } } }
      });
      console.log(`Found ${properties.length} candidate properties.`);
      properties.forEach(p => console.log(`- [PROP] ID: ${p.id} | Name: ${p.name} | Org: ${p.organization?.name} | Created: ${p.createdAt}`));

      const retail = await prisma.organization.findMany({
        where: { type: 'RETAIL', OR: [{ name: { contains: 'test', mode: 'insensitive' } }, { name: { contains: 'demo', mode: 'insensitive' } }] },
        include: { staff: { include: { user: true } } }
      });
      console.log(`Found ${retail.length} candidate retail orgs.`);
      retail.forEach(o => console.log(`- [ORG] ID: ${o.id} | Name: ${o.name} | Created: ${o.createdAt}`));
      console.log("\nTo delete, add IDs to scripts/production_cleanup_targets.json and run with --dry-run then --confirm.");
      return;
    }

    console.log("\nPHASE C/D - DRY RUN / CONFIRM MODE");
    if (targets.properties.length === 0 && targets.retailOrganizations.length === 0) {
      console.log("No targets specified in production_cleanup_targets.json. Exiting.");
      return;
    }

    // Verify targets
    const propsToDelete = await prisma.property.findMany({
      where: { id: { in: targets.properties } },
      include: { organization: { include: { staff: { include: { user: true } } } } }
    });
    
    const orgsToDelete = await prisma.organization.findMany({
      where: { id: { in: targets.retailOrganizations } },
      include: { staff: { include: { user: true } } }
    });

    if (propsToDelete.length !== targets.properties.length) console.warn("Some property IDs not found.");
    if (orgsToDelete.length !== targets.retailOrganizations.length) console.warn("Some organization IDs not found.");

    let abort = false;
    [...propsToDelete, ...orgsToDelete].forEach(record => {
      const staff = record.staff || record.organization?.staff || [];
      const hasProtected = staff.some(s => PROTECTED_EMAILS.includes(s.user.email));
      if (hasProtected) {
        console.error(`ABORT: Target ${record.id} (${record.name}) belongs to a protected user!`);
        abort = true;
      }
    });

    if (abort) process.exit(1);

    console.log(`\nTargets verified safe to delete: ${propsToDelete.length} properties, ${orgsToDelete.length} organizations.`);

    if (isDryRun) {
      console.log("\nDRY RUN - The following will be deleted:");
      propsToDelete.forEach(p => console.log(`[PROP] ${p.name} (${p.id})`));
      orgsToDelete.forEach(o => console.log(`[ORG] ${o.name} (${o.id})`));
      return;
    }

    if (isConfirm) {
      console.log("\nExecuting deletion...");
      for (const p of propsToDelete) {
        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM "PricingHistory" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "Room" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" = ${p.id})`,
          prisma.$executeRaw`DELETE FROM "RoomType" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Enquiry" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Media" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "HouseRule" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "PropertyAmenity" WHERE "propertyId" = ${p.id}`,
          prisma.$executeRaw`DELETE FROM "Property" WHERE "id" = ${p.id}`
        ]);
        console.log(`Deleted property ${p.id}`);
      }

      for (const o of orgsToDelete) {
        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM "SalesOrderItem" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "InventoryMovement" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "Inventory" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "Product" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "PosTerminal" WHERE "branchId" IN (SELECT id FROM "RetailBranch" WHERE "organizationId" = ${o.id})`,
          prisma.$executeRaw`DELETE FROM "RetailBranch" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "ProductCategory" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "OrgStaff" WHERE "organizationId" = ${o.id}`,
          prisma.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${o.id}`
        ]);
        console.log(`Deleted organization ${o.id}`);
      }
      console.log("Cleanup complete.");
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
cleanupDemo();
