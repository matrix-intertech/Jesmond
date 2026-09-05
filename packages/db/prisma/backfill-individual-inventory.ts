const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for Individual Properties...');

  // Find all INDIVIDUAL properties that currently have 0 RoomTypes
  const propertiesWithoutRooms = await prisma.property.findMany({
    where: {
      listingMode: 'INDIVIDUAL',
      roomTypes: { none: {} }
    },
    select: {
      id: true,
      description: true
    }
  });

  console.log(`Found ${propertiesWithoutRooms.length} INDIVIDUAL properties requiring a default RoomType.`);

  for (const property of propertiesWithoutRooms) {
    await prisma.roomType.create({
      data: {
        propertyId: property.id,
        name: 'Entire Property',
        description: property.description || 'Individual property rental',
        pricePerWeek: 0,
        inventory: 1,
      }
    });
    console.log(`Created default RoomType for Property ID: ${property.id}`);
  }

  console.log('Backfill complete!');
}

main()
  .catch((e) => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
