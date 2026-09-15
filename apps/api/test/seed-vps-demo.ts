import { PrismaClient, OrgType, UserRole, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo retail user...');

  const email = 'demo-retail@matrixspaces.com';
  const password = 'Password123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Clean up if already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log('User already exists, deleting for clean seed...');
    await prisma.orgStaff.deleteMany({ where: { userId: existingUser.id } });
    await prisma.session.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // Create Org
  const org = await prisma.organization.create({
    data: {
      name: '[TEST] Retail Demo Org',
      type: OrgType.RETAIL,
      status: 'ACTIVE',
    },
  });

  // Create User
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Retail',
      role: UserRole.ORG_STAFF,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true,
    },
  });

  // Assign to Org
  await prisma.orgStaff.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: UserRole.ORG_STAFF,
      permissions: ['*'],
    },
  });

  // Create Retail Branch
  const branch = await prisma.retailBranch.create({
    data: {
      name: 'Sydney CBD Flagship',
      address: '100 George St, Sydney NSW 2000',
      phone: '+61 2 9000 1000',
      organizationId: org.id,
    },
  });

  // Assign user to branch
  await prisma.orgStaff.updateMany({
    where: { userId: user.id, organizationId: org.id },
    data: { retailBranchId: branch.id },
  });

  // Create Product Category
  const category = await prisma.productCategory.create({
    data: {
      name: 'Electronics',
      description: 'Laptops, Phones, and Accessories',
      organizationId: org.id,
    },
  });

  // Create Product
  const product = await prisma.product.create({
    data: {
      name: 'Jesmond Pro Laptop 14"',
      sku: 'JES-PRO-14-BLK',
      barcode: '9300000000123',
      description: 'High performance laptop for students and professionals.',
      sellingPrice: 199900, // $1999.00
      costPrice: 150000,
      taxRate: 0.10,
      unit: 'piece',
      organizationId: org.id,
      categoryId: category.id,
    },
  });

  // Create Inventory
  await prisma.inventory.create({
    data: {
      branchId: branch.id,
      productId: product.id,
      quantity: 50,
      reservedQuantity: 5,
      reorderThreshold: 10,
    },
  });

  console.log(`Ã¢Å“â€¦ Demo user and catalog seeded successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Organization ID: ${org.id}`);
}

main()
  .catch((e) => {
    console.error('Failed to seed user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
