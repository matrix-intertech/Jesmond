const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const confirmProd = process.env.CONFIRM_PRODUCTION === 'true';

async function seedProperties() {
  console.log("=== PRODUCTION HOST DEMO SEED ===");
  if (!confirmProd) {
    console.error("ABORT: CONFIRM_PRODUCTION=true is required.");
    process.exit(1);
  }
  console.log("DATABASE HOST: " + (process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || "Unknown"));
  console.log("DATABASE NAME: " + (process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || "Unknown"));
  console.log("DATABASE USER: " + (process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || "Unknown"));

  try {
    const org = await prisma.organization.findFirst({ where: { type: 'PROVIDER', staff: { some: { user: { email: 'allienshaurya@gmail.com' } } } } });
    if (!org) {
      console.error("Provider org not found for allienshaurya@gmail.com.");
      process.exit(1);
    }

    const suburb = await prisma.suburb.findFirst({ include: { city: { include: { state: { include: { country: true } } } } } });
    if (!suburb) {
      console.error("No suburb found in DB to attach properties to.");
      process.exit(1);
    }
    
    const properties = [
      { name: 'JES Demo House', type: 'HOUSE', config: { bedrooms: 3, bathrooms: 2, parkingSpaces: 2 }, contact: true, price: 50000 },
      { name: 'JES Demo Apartment', type: 'APARTMENT', config: { bedrooms: 2, bathrooms: 2, parkingSpaces: 1 }, contact: false, price: 45000 },
      { name: 'JES Demo Studio', type: 'STUDIO', config: { bedrooms: 1, bathrooms: 1, parkingSpaces: 0 }, contact: true, price: 30000 },
      { name: 'JES Demo Granny Flat', type: 'GRANNY_FLAT', config: { bedrooms: 1, bathrooms: 1, parkingSpaces: 1 }, contact: false, price: 25000 },
      { name: 'JES Demo Townhouse', type: 'TOWNHOUSE', config: { bedrooms: 3, bathrooms: 2, parkingSpaces: 1 }, contact: true, price: 48000 },
      { name: 'JES Demo Unit', type: 'UNIT', config: { bedrooms: 2, bathrooms: 1, parkingSpaces: 1 }, contact: false, price: 38000 },
      { name: 'JES Demo Duplex', type: 'DUPLEX', config: { bedrooms: 4, bathrooms: 2, parkingSpaces: 2 }, contact: true, price: 55000 },
      { name: 'JES Demo Other Space', type: 'OTHER', config: { bedrooms: 1, bathrooms: 1 }, contact: false, price: 20000 }
    ];

    let lat = suburb.lat || -33.8688;
    let lng = suburb.lng || 151.2093;

    for (let p of properties) {
      const existing = await prisma.property.findFirst({ where: { name: p.name, organizationId: org.id } });
      if (!existing) {
        lat += 0.001;
        lng += 0.001;
        
        await prisma.property.create({
          data: {
            name: p.name,
            organization: { connect: { id: org.id } },
            suburb: { connect: { id: suburb.id } },
            propertyType: p.type,
            configuration: p.config,
            showContactDetails: p.contact,
            description: `A lovely ${p.type} located in ${suburb.name}. Perfect for students and professionals.`,
            status: 'PUBLISHED',
            address: `123 ${suburb.name} St`,
            postcode: suburb.postcode || '2000',
            lat: lat,
            lng: lng,
            minimumStay: 30,
            roomTypes: {
              create: {
                name: 'Standard Room',
                description: 'Default room type',
                pricePerWeek: p.price,
                inventory: 1,
                pricingHistory: {
                  create: {
                    pricePerWeek: p.price,
                    effectiveFrom: new Date()
                  }
                }
              }
            }
          }
        });
        console.log(`Created property: ${p.name}`);
      } else {
        console.log(`Property ${p.name} already exists, skipping.`);
      }
    }
  } catch (err) {
    console.error("Host seed error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
seedProperties();
