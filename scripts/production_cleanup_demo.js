const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

const args = process.argv.slice(2);
const isConfirm = args.includes('--confirm');
const isDryRun = args.includes('--dry-run');
const confirmProd = process.env.CONFIRM_PRODUCTION === 'true';

const PROTECTED_EMAILS = ['shikharshaurya.01@gmail.com', 'allienshaurya@gmail.com', 'ssmnvi012@gmail.com'];
const PROTECTED_ORG_IDS = [
  'e509b81a-d2f1-49b4-a973-6413abdf0cfe',
  '0e8b1d5c-51cf-47e8-989b-826f29db6b2a',
  '14d5f9ae-13f8-47d6-a586-66111f56ac1c',
  'b9adbf05-2978-4391-9f6d-10b0a8f2a172',
  'e228eb36-4160-46e1-90ed-cfd32f5c1448',
  'ec92b968-db29-4b33-87d3-19adb4f235e5',
  '797c367d-c47a-4cba-9c5e-ef66230a4bb9',
  'cd26bfab-a846-4b09-9db6-d2a2014508ac'
];

async function cleanupDemo() {
  console.log("=== PRODUCTION DEMO CLEANUP (EXPLICIT ID ONLY) ===");
  // NOTE: This script operates strictly on explicit IDs to prevent accidental
  // deletion of legitimate production records. Protected IDs exist to safeguard
  // core demo/test accounts that the business relies on.

  if (!isDryRun && (!isConfirm || !confirmProd)) {
    console.error("ABORT: Both CONFIRM_PRODUCTION=true and --confirm are required for deletion.");
    process.exit(1);
  }

  let targets = { properties: [], retailOrganizations: [] };
  try {
    if (fs.existsSync('scripts/production_cleanup_targets.json')) {
      targets = JSON.parse(fs.readFileSync('scripts/production_cleanup_targets.json', 'utf8'));
    }
  } catch (err) {
    console.error("ABORT: Failed to parse targets file.", err);
    process.exit(1);
  }

  if ((!targets.properties || targets.properties.length === 0) && 
      (!targets.retailOrganizations || targets.retailOrganizations.length === 0)) {
    console.error("ABORT: No targets specified in production_cleanup_targets.json.");
    process.exit(1);
  }

  // 1. Validation Phase
  console.log("\n[1] VALIDATION PHASE");

  // Abort if any protected ORG ID is targeted
  const targetedOrgs = new Set(targets.retailOrganizations || []);
  for (const orgId of targetedOrgs) {
    if (PROTECTED_ORG_IDS.includes(orgId)) {
      console.error(`ABORT: Targeted organization ${orgId} is protected!`);
      process.exit(1);
    }
  }

  // Fetch actual records to ensure they exist and check for protected staff
  const propsToDelete = await prisma.property.findMany({
    where: { id: { in: targets.properties || [] } },
    include: { organization: { include: { staff: { include: { user: true } } } } }
  });

  const orgsToDelete = await prisma.organization.findMany({
    where: { id: { in: targets.retailOrganizations || [] } },
    include: { staff: { include: { user: true } } }
  });

  if (propsToDelete.length !== (targets.properties?.length || 0)) {
    console.error("ABORT: Some specified property IDs were not found in the database.");
    process.exit(1);
  }
  if (orgsToDelete.length !== (targets.retailOrganizations?.length || 0)) {
    console.error("ABORT: Some specified organization IDs were not found in the database.");
    process.exit(1);
  }

  let hasProtectedUser = false;
  [...propsToDelete, ...orgsToDelete].forEach(record => {
    const staff = record.staff || record.organization?.staff || [];
    if (staff.some(s => s.user && PROTECTED_EMAILS.includes(s.user.email))) {
      console.error(`ABORT: Target ${record.id} (${record.name}) belongs to a protected user!`);
      hasProtectedUser = true;
    }
  });

  if (hasProtectedUser) {
    console.error("ABORT: Protected user found in target records.");
    process.exit(1);
  }

  console.log(`Targets verified safe to delete: ${propsToDelete.length} properties, ${orgsToDelete.length} organizations.`);

  if (isDryRun) {
    console.log("\nDRY RUN - Validated safe to delete (NO DELETION PERFORMED):");
    propsToDelete.forEach(p => console.log(`[PROP] ${p.name} (${p.id})`));
    orgsToDelete.forEach(o => console.log(`[ORG] ${o.name} (${o.id})`));
    await prisma.$disconnect();
    return;
  }

  // 2. Execution Phase
  console.log("\n[2] EXECUTION PHASE");
  
  let deletedProps = 0;
  for (const p of propsToDelete) {
    try {
      console.log(`Deleting property: ${p.id}`);
      await prisma.$transaction([
        // Deepest dependencies first
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

  let deletedOrgs = 0;
  for (const o of orgsToDelete) {
    try {
        // ProductCategory arbitrary-depth deletion
        // We determine the leaf nodes level-by-level to safely delete bottom-up without FK errors
        const categories = await prisma.productCategory.findMany({
          where: { organizationId: o.id },
          select: { id: true, parentId: true }
        });
        
        let currentCategories = [...categories];
        const categoryDeletionQueries = [];
        
        while (currentCategories.length > 0) {
          const parentIds = new Set(currentCategories.map(c => c.parentId).filter(id => id != null));
          const leaves = currentCategories.filter(c => !parentIds.has(c.id));
          
          if (leaves.length === 0) {
            throw new Error("Cycle detected in ProductCategory hierarchy for organization " + o.id);
          }
          
          const leafIds = leaves.map(l => l.id);
          categoryDeletionQueries.push(
            prisma.$executeRaw`DELETE FROM "ProductCategory" WHERE "id" IN (${Prisma.join(leafIds)})`
          );
          
          currentCategories = currentCategories.filter(c => !leafIds.includes(c.id));
        }

      console.log(`Deleting organization: ${o.id}`);
      await prisma.$transaction([
        // PROPERTY DEPENDENCIES FOR THIS ORGANIZATION
        prisma.$executeRaw`DELETE FROM "Invoice" WHERE "leaseId" IN (SELECT id FROM "Lease" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))))`,
        prisma.$executeRaw`DELETE FROM "Document" WHERE "leaseId" IN (SELECT id FROM "Lease" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))))`,
        prisma.$executeRaw`DELETE FROM "Document" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})))`,
        prisma.$executeRaw`DELETE FROM "Lease" WHERE "applicationId" IN (SELECT id FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})))`,
        prisma.$executeRaw`DELETE FROM "Application" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))`,
        
        prisma.$executeRaw`DELETE FROM "AvailabilityCalendar" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))`,
        prisma.$executeRaw`DELETE FROM "PricingHistory" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))`,
        prisma.$executeRaw`DELETE FROM "Room" WHERE "roomTypeId" IN (SELECT id FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))`,
        prisma.$executeRaw`DELETE FROM "RoomType" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "Floor" WHERE "buildingId" IN (SELECT id FROM "Building" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id}))`,
        prisma.$executeRaw`DELETE FROM "Building" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        
        prisma.$executeRaw`DELETE FROM "Resident" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "MaintenanceRequest" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "Media" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "PropertyAmenity" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "RecentlyViewed" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "PropertyVersion" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "SavedProperty" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "Enquiry" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "HouseRule" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE "organizationId" = ${o.id})`,
        
        prisma.$executeRaw`DELETE FROM "Property" WHERE "organizationId" = ${o.id}`,

        // RETAIL / ORG DEPENDENCIES
        prisma.$executeRaw`DELETE FROM "RetailPayment" WHERE "orderId" IN (SELECT id FROM "SalesOrder" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "SalesOrderItem" WHERE "orderId" IN (SELECT id FROM "SalesOrder" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "SalesOrder" WHERE "organizationId" = ${o.id}`,
        prisma.$executeRaw`DELETE FROM "RetailCustomer" WHERE "organizationId" = ${o.id}`,
        
        prisma.$executeRaw`DELETE FROM "PosSyncJob" WHERE "organizationId" = ${o.id}`,
        prisma.$executeRaw`DELETE FROM "PosWebhookEvent" WHERE "organizationId" = ${o.id}`,
        
        prisma.$executeRaw`DELETE FROM "InventoryMovement" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "Inventory" WHERE "productId" IN (SELECT id FROM "Product" WHERE "organizationId" = ${o.id})`,
        prisma.$executeRaw`DELETE FROM "Product" WHERE "organizationId" = ${o.id}`,
        
        // Append all the dynamically computed category deletion queries here
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
      console.error(`ERROR: Failed to delete organization ${o.id}:`, err.message);
      process.exit(1);
    }
  }

  // 3. Verification Phase
  console.log("\n[3] VERIFICATION PHASE");
  let verificationFailed = false;

  const remainingProps = await prisma.property.count({ where: { id: { in: targets.properties || [] } } });
  if (remainingProps > 0) {
    console.error(`VERIFICATION FAILED: ${remainingProps} explicitly targeted properties still exist.`);
    verificationFailed = true;
  }

  const remainingOrgs = await prisma.organization.count({ where: { id: { in: targets.retailOrganizations || [] } } });
  if (remainingOrgs > 0) {
    console.error(`VERIFICATION FAILED: ${remainingOrgs} explicitly targeted organizations still exist.`);
    verificationFailed = true;
  }
  
  const remainingProducts = await prisma.product.count({ where: { organizationId: { in: targets.retailOrganizations || [] } } });
  if (remainingProducts > 0) {
    console.error(`VERIFICATION FAILED: ${remainingProducts} dependent products still exist.`);
    verificationFailed = true;
  }

  const remainingBranches = await prisma.retailBranch.count({ where: { organizationId: { in: targets.retailOrganizations || [] } } });
  if (remainingBranches > 0) {
    console.error(`VERIFICATION FAILED: ${remainingBranches} dependent branches still exist.`);
    verificationFailed = true;
  }

  if (verificationFailed) {
    console.error("ABORT: Post-deletion verification failed.");
    process.exit(1);
  }

  console.log(`\nCleanup complete! Verified absence of ${deletedProps} properties and ${deletedOrgs} organizations, including their dependent records.`);
  await prisma.$disconnect();
}

cleanupDemo().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

