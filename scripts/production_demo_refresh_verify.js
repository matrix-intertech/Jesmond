const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const prisma = new PrismaClient();

const PROTECTED_EMAILS = ['shikharshaurya.01@gmail.com', 'allienshaurya@gmail.com', 'ssmnvi012@gmail.com'];

function getFingerprint(hash) {
  if (!hash) return null;
  return crypto.createHash('sha256').update(hash).digest('hex');
}

async function verify() {
  console.log("=== VERIFY DEMO REFRESH ===");
  try {
    let failed = false;

    // USERS
    const users = await prisma.user.findMany({ where: { email: { in: PROTECTED_EMAILS } } });
    if (users.length !== 3) {
      console.error("FAIL: Expected 3 protected users, found " + users.length);
      failed = true;
    }

    // Check roles
    const shikhar = users.find(u => u.email === 'shikharshaurya.01@gmail.com');
    const allien = users.find(u => u.email === 'allienshaurya@gmail.com');
    const ssmnvi = users.find(u => u.email === 'ssmnvi012@gmail.com');

    if (!shikhar || shikhar.role !== 'ORG_STAFF') { console.error("FAIL: shikhar missing or bad role"); failed = true; }
    if (!allien || allien.role !== 'ORG_STAFF') { console.error("FAIL: allien missing or bad role"); failed = true; }
    if (!ssmnvi || ssmnvi.role !== 'STUDENT') { console.error("FAIL: ssmnvi missing or bad role"); failed = true; }

    // HASH CHECK
    if (fs.existsSync('scripts/production_demo_refresh_inventory.json')) {
      const inventory = JSON.parse(fs.readFileSync('scripts/production_demo_refresh_inventory.json', 'utf8'));
      if (inventory.userFingerprints) {
        for (const u of users) {
          if (inventory.userFingerprints[u.email] !== getFingerprint(u.password)) {
            console.error(`FAIL: Hash mismatch for ${u.email}`);
            failed = true;
          }
        }
      }
    }

    // PROPERTIES
    const hostOrg = await prisma.organization.findFirst({ where: { type: 'PROVIDER', name: 'Jesmond Demo Host' }});
    const properties = await prisma.property.findMany({ where: { organizationId: hostOrg?.id } });
    if (properties.length !== 8) {
      console.error(`FAIL: Expected 8 canonical properties, found ${properties.length}`);
      failed = true;
    }

    // TARGETS
    if (fs.existsSync('scripts/production_demo_refresh_targets.json')) {
      const targets = JSON.parse(fs.readFileSync('scripts/production_demo_refresh_targets.json', 'utf8'));
      if (targets.propertiesToDelete?.length > 0) {
        const remaining = await prisma.property.count({ where: { id: { in: targets.propertiesToDelete.map(t => t.id) } } });
        if (remaining > 0) {
          console.error(`FAIL: ${remaining} targeted properties were NOT deleted.`);
          failed = true;
        }
      }
    }

    // RETAIL
    const retailOrg = await prisma.organization.findFirst({ where: { type: 'RETAIL', name: 'Jesmond Demo Retail' }});
    const products = await prisma.product.count({ where: { organizationId: retailOrg?.id }});
    if (products !== 8) {
      console.error(`FAIL: Expected 8 retail products, found ${products}`);
      failed = true;
    }

    if (failed) {
      console.error("\nVERIFICATION FAILED.");
      process.exit(1);
    } else {
      console.log("\nVERIFICATION PASSED: Demo dataset is perfect and secure.");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
verify();
