const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const confirmProd = process.env.CONFIRM_PRODUCTION === 'true';

async function seedRetail() {
  console.log("=== PRODUCTION RETAIL DEMO SEED ===");
  if (!confirmProd) {
    console.error("ABORT: CONFIRM_PRODUCTION=true is required.");
    process.exit(1);
  }
  console.log("DATABASE HOST: " + (process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || "Unknown"));
  console.log("DATABASE NAME: " + (process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || "Unknown"));
  console.log("DATABASE USER: " + (process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || "Unknown"));

  try {
    const org = await prisma.organization.findFirst({ where: { type: 'RETAIL', staff: { some: { user: { email: 'shikharshaurya.01@gmail.com' } } } } });
    if (!org) {
      console.error("Retail org not found for shikharshaurya.01@gmail.com. Run user setup first.");
      process.exit(1);
    }

    const products = [
      { sku: 'JES-DEMO-001', name: 'Premium Coffee Beans', description: '250g Arabica dark roast', price: 1500, stock: 40 },
      { sku: 'JES-DEMO-002', name: 'Notebook A5', description: 'Ruled 100 pages', price: 500, stock: 150 },
      { sku: 'JES-DEMO-003', name: 'Ergonomic Chair', description: 'Office desk chair with lumbar support', price: 12000, stock: 10 },
      { sku: 'JES-DEMO-004', name: 'Wireless Mouse', description: 'Bluetooth rechargeable mouse', price: 2500, stock: 35 },
      { sku: 'JES-DEMO-005', name: 'Desk Lamp', description: 'LED adjustable brightness', price: 3500, stock: 25 },
      { sku: 'JES-DEMO-006', name: 'Water Bottle 1L', description: 'Stainless steel insulated', price: 2000, stock: 80 },
      { sku: 'JES-DEMO-007', name: 'Backpack', description: 'Laptop backpack 15 inch', price: 5000, stock: 20 },
      { sku: 'JES-DEMO-008', name: 'Mechanical Keyboard', description: 'Blue switches TKL', price: 7500, stock: 15 }
    ];

    for (let p of products) {
      const existing = await prisma.product.findFirst({
        where: { sku: p.sku, organizationId: org.id }
      });
      if (!existing) {
        await prisma.product.create({
          data: {
            organizationId: org.id,
            sku: p.sku,
            name: p.name,
            description: p.description,
            sellingPrice: p.price,
            unit: 'piece',
            isActive: true
          }
        });
        console.log(`Created product: ${p.sku}`);
      } else {
        console.log(`Product ${p.sku} already exists, skipping.`);
      }
    }

    let branch = await prisma.retailBranch.findFirst({ where: { organizationId: org.id, name: 'Demo Store Main' } });
    if (!branch) {
      branch = await prisma.retailBranch.create({
        data: { organizationId: org.id, name: 'Demo Store Main', location: 'Sydney CBD', isActive: true }
      });
      console.log("Created branch: Demo Store Main.");
    } else {
      console.log("Branch already exists.");
    }

    let terminal = await prisma.posTerminal.findFirst({ where: { branchId: branch.id, name: 'Terminal-Alpha' } });
    if (!terminal) {
      terminal = await prisma.posTerminal.create({
        data: { branchId: branch.id, name: 'Terminal-Alpha', isActive: true, status: 'ONLINE' }
      });
      console.log("Created POS Terminal: Terminal-Alpha.");
    } else {
      console.log("Terminal already exists.");
    }

  } catch (err) {
    console.error("Retail seed error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
seedRetail();
