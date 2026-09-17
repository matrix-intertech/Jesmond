const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runInventory() {
  try {
    console.log("=== PRODUCTION INVENTORY REPORT ===");
    const users = await prisma.user.findMany({
      include: {
        orgStaffRoles: { include: { organization: true } }
      }
    });
    console.log(`\nUSERS (Total: ${users.length})`);
    users.filter(u => ['shikharshaurya.01@gmail.com', 'allienshaurya@gmail.com', 'ssmnvi012@gmail.com'].includes(u.email))
         .forEach(u => {
           console.log(`- ${u.email} [${u.role}]`);
           if (u.orgStaffRoles.length > 0) {
             u.orgStaffRoles.forEach(r => console.log(`  -> Staff of: ${r.organization.name} [${r.organization.type}]`));
           }
         });

    const properties = await prisma.property.findMany({ include: { organization: true } });
    console.log(`\nPROPERTIES (Total: ${properties.length})`);
    properties.forEach(p => {
      console.log(`- ${p.name} [${p.propertyType}] - Org: ${p.organization?.name} - Created: ${p.createdAt}`);
    });

    const retailOrgs = await prisma.organization.findMany({
      where: { type: 'RETAIL' },
      include: { Product: true, staff: true }
    });
    console.log(`\nRETAIL ORGANIZATIONS (Total: ${retailOrgs.length})`);
    retailOrgs.forEach(o => {
      console.log(`- ${o.name} - Products: ${o.Product.length} - Staff: ${o.staff.length}`);
    });

    const products = await prisma.product.findMany({ include: { organization: true } });
    console.log(`\nPRODUCTS (Total: ${products.length})`);
    products.forEach(p => {
      console.log(`- ${p.name} - Org: ${p.organization?.name} - Created: ${p.createdAt}`);
    });
  } catch (err) {
    console.error("Inventory error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
runInventory();
