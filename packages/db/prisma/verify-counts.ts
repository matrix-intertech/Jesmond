import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const orgs = await prisma.organization.count();
  const staff = await prisma.orgStaff.count();
  const props = await prisma.property.count();
  console.log(`Users: ${users}, Orgs: ${orgs}, Staff: ${staff}, Properties: ${props}`);
}

main().finally(() => prisma.$disconnect());
