import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const flag = await prisma.featureFlag.findUnique({ where: { key: 'PAYMENTS_BOOKING' } });
  console.log('PAYMENTS_BOOKING:', flag?.enabled ?? false);
}
main().finally(() => prisma.$disconnect());
