const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function seedPublishedProperty() {
  const orgStaff = await prisma.orgStaff.findFirst({ include: { user: true } });
  const suburb = await prisma.suburb.findFirst();

  const property = await prisma.property.create({
    data: {
      name: `E2E Test Property ${crypto.randomBytes(4).toString('hex')}`,
      description: 'E2E Testing',
      address: '456 Test Ave',
      postcode: '3000',
      lat: -37.8136,
      lng: 144.9631,
      status: 'PUBLISHED',
      organizationId: orgStaff.organizationId,
      suburbId: suburb.id,
      roomTypes: {
        create: [
          {
            name: 'E2E Test Room',
            description: 'Room for testing',
            pricePerWeek: 45000,
            inventory: 10
          }
        ]
      }
    }
  });
  console.log("Seeded published property:", property.id);
}

seedPublishedProperty().catch(console.error).finally(() => prisma.$disconnect());
