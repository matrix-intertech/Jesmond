import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding feature flags...');

  const features = [
    { key: 'STATES', enabled: true },
    { key: 'UNIVERSITIES', enabled: true },
  ];

  for (const feature of features) {
    await prisma.featureFlag.upsert({
      where: { key: feature.key },
      update: {}, // Don't overwrite existing value if it's already there
      create: {
        key: feature.key,
        enabled: feature.enabled,
        updatedBy: 'system',
      },
    });
    console.log(`Upserted feature flag: ${feature.key}`);
  }

  console.log('Feature flags seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
