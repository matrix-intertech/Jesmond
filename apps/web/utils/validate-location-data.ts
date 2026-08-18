import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runValidation() {
  console.log('--- Location Master-Data Validation ---');

  const states = await prisma.state.count();
  const cities = await prisma.city.count();
  const suburbs = await prisma.suburb.count();
  const suburbsWithCity = await prisma.suburb.count({ where: { cityId: { not: null } } });
  const suburbsWithoutCity = await prisma.suburb.count({ where: { cityId: null } });

  console.log(`States: ${states}`);
  console.log(`Cities: ${cities}`);
  console.log(`Suburbs: ${suburbs}`);
  console.log(`Suburbs with City: ${suburbsWithCity}`);
  console.log(`Suburbs without City: ${suburbsWithoutCity}`);

  // Check for orphan cities or suburbs (without state)
  const orphanCities = await prisma.city.count({ where: { stateId: null } as any }); // If applicable
  const orphanSuburbs = await prisma.suburb.count({ where: { stateId: null } as any }); // If applicable

  console.log(`Orphan Cities (missing state): ${orphanCities}`);
  console.log(`Orphan Suburbs (missing state): ${orphanSuburbs}`);

  console.log('--- Validation Complete ---');
}

runValidation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
