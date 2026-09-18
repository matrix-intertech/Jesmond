const { PrismaClient } = require('@prisma/client');
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

async function runPreflight() {
  console.log("=== VPS PREFLIGHT INVENTORY ===");
  try {
    const counts = {
      Users: await prisma.user.count(),
      Organizations: await prisma.organization.count(),
      Properties: await prisma.property.count(),
      RoomTypes: await prisma.roomType.count(),
      Rooms: await prisma.room.count(),
      AvailabilityCalendar: await prisma.availabilityCalendar.count(),
      PricingHistory: await prisma.pricingHistory.count(),
      Enquiries: await prisma.enquiry.count(),
      Residents: await prisma.resident.count(),
      HouseRules: await prisma.houseRule.count(),
      Media: await prisma.media.count(),
      Amenities: await prisma.propertyAmenity.count(),
      Products: await prisma.product.count(),
      RetailBranches: await prisma.retailBranch.count()
    };
    
    console.log("--- COUNTS ---");
    console.table(counts);

    const users = await prisma.user.findMany({
      where: { email: { in: PROTECTED_EMAILS } },
      include: { orgStaffRoles: { include: { organization: true } } }
    });

    console.log("\n--- PROTECTED USERS ---");
    const userFingerprints = {};
    for (const u of users) {
      console.log(`Email: ${u.email} | Role: ${u.role}`);
      userFingerprints[u.email] = getFingerprint(u.password);
      if (u.orgStaffRoles.length > 0) {
        u.orgStaffRoles.forEach(r => console.log(`  -> Staff of: ${r.organization.name} [${r.organization.type}] (Role: ${r.role})`));
      }
    }
    
    // Save inventory & fingerprints
    const inventory = { counts, userFingerprints };
    fs.writeFileSync('scripts/production_demo_refresh_inventory.json', JSON.stringify(inventory, null, 2));

    const hostOrg = await prisma.organization.findFirst({
      where: { name: 'Jesmond Demo Host', type: 'PROVIDER' }
    });

    let canonicalPropertyIds = [];
    if (hostOrg) {
      const canonicalProps = await prisma.property.findMany({
        where: { name: { in: CANONICAL_PROPERTY_NAMES }, organizationId: hostOrg.id },
        select: { id: true, name: true }
      });
      canonicalPropertyIds = canonicalProps.map(p => p.id);
      console.log(`\nCanonical properties KEEP: ${canonicalProps.length}`);
      canonicalProps.forEach(p => console.log(`  KEEP: ${p.id} - ${p.name}`));
    } else {
      console.log("\nJesmond Demo Host organization not found. No canonical properties exist yet.");
    }

    const propertiesToDelete = await prisma.property.findMany({
      where: { id: { notIn: canonicalPropertyIds } },
      select: { id: true, name: true, organizationId: true, organization: { select: { name: true } } }
    });

    console.log(`\nProperties DELETE: ${propertiesToDelete.length}`);
    propertiesToDelete.forEach(p => console.log(`  DELETE: ${p.id} - ${p.name} (Org: ${p.organization?.name})`));

    // Safety check
    const accidentallyTargeted = propertiesToDelete.filter(p => CANONICAL_PROPERTY_NAMES.includes(p.name));
    if (accidentallyTargeted.length > 0) {
      console.error("\nCRITICAL ERROR: A canonical property is scheduled for deletion.");
      process.exit(1);
    }

    if (canonicalPropertyIds.length + propertiesToDelete.length !== counts.Properties) {
      console.error("\nCRITICAL ERROR: Property count reconciliation failed.");
      process.exit(1);
    }

    const retailOrgsToDelete = await prisma.organization.findMany({
      where: { type: 'RETAIL', name: { not: 'Jesmond Demo Retail' } },
      select: { id: true, name: true }
    });

    const cleanupTargets = {
      propertiesToDelete: propertiesToDelete.map(p => ({
        id: p.id, name: p.name, organizationId: p.organizationId, organizationName: p.organization?.name
      })),
      organizationsToDelete: retailOrgsToDelete.map(o => ({
        id: o.id, name: o.name
      }))
    };

    fs.writeFileSync('scripts/production_demo_refresh_targets.json', JSON.stringify(cleanupTargets, null, 2));
    console.log("\nWrote specific UUIDs to scripts/production_demo_refresh_targets.json");

  } catch (err) {
    console.error("Preflight error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPreflight();
