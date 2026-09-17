const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assert(condition, message) {
  if (!condition) {
    console.error(`? FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`? PASSED: ${message}`);
  }
}

async function verify() {
  console.log("=== PRODUCTION DEMO VERIFICATION ===");
  try {
    const shikhar = await prisma.user.findUnique({ where: { email: 'shikharshaurya.01@gmail.com' }, include: { orgStaffRoles: { include: { organization: true } } }});
    const allien = await prisma.user.findUnique({ where: { email: 'allienshaurya@gmail.com' }, include: { orgStaffRoles: { include: { organization: true } } }});
    const ssmnvi = await prisma.user.findUnique({ where: { email: 'ssmnvi012@gmail.com' }});
    
    await assert(shikhar && shikhar.role === 'ORG_STAFF', 'Shikhar exists with ORG_STAFF role');
    await assert(allien && allien.role === 'ORG_STAFF', 'Allien exists with ORG_STAFF role');
    await assert(ssmnvi && ssmnvi.role === 'STUDENT', 'Ssmnvi exists with STUDENT role');

    const retailOrgs = shikhar.orgStaffRoles.filter(r => r.organization.type === 'RETAIL');
    await assert(retailOrgs.length === 1, 'Shikhar has exactly 1 Retail organization');
    const retailOrgId = retailOrgs[0].organizationId;

    const providerOrgs = allien.orgStaffRoles.filter(r => r.organization.type === 'PROVIDER');
    await assert(providerOrgs.length === 1, 'Allien has exactly 1 Provider organization');
    const hostOrgId = providerOrgs[0].organizationId;

    const products = await prisma.product.findMany({ where: { organizationId: retailOrgId, sku: { startsWith: 'JES-DEMO-' } } });
    await assert(products.length === 8, 'Exactly 8 JES-DEMO products exist for Retailer');
    
    const uniqueSkus = new Set(products.map(p => p.sku));
    await assert(uniqueSkus.size === 8, 'All 8 JES-DEMO SKUs are unique');

    const branch = await prisma.retailBranch.findFirst({ where: { organizationId: retailOrgId, name: 'Demo Store Main' }, include: { PosTerminal: true } });
    await assert(!!branch, 'Retail branch "Demo Store Main" exists');
    await assert(branch.PosTerminal.some(t => t.name === 'Terminal-Alpha'), 'POS Terminal "Terminal-Alpha" exists');

    const properties = await prisma.property.findMany({ where: { organizationId: hostOrgId, name: { startsWith: 'JES Demo' } }, include: { roomTypes: { include: { pricingHistory: true } } } });
    await assert(properties.length === 8, 'Exactly 8 JES Demo properties exist for Host');

    const types = new Set(properties.map(p => p.propertyType));
    await assert(types.size === 8, 'Exactly 1 of each property type exists among the 8 properties');

    let visibleContact = 0, hiddenContact = 0;
    let allHavePricing = true;
    properties.forEach(p => {
      p.showContactDetails ? visibleContact++ : hiddenContact++;
      if (p.roomTypes.length === 0 || p.roomTypes[0].pricingHistory.length === 0) allHavePricing = false;
    });
    await assert(visibleContact === 4 && hiddenContact === 4, 'Contact visibility is exactly 4 true, 4 false');
    await assert(allHavePricing, 'All properties have RoomType and PricingHistory initialized');

    console.log("\n?? ALL PRODUCTION CHECKS PASSED.");
  } catch (err) {
    console.error("Verification error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
verify();
