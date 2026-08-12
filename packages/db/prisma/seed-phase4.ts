import { PrismaClient, OrgType, PropertyStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Phase 4 DB Seed...');

  // 1. Clean existing data in correct dependency order
  console.log('Cleaning existing data...');
  
  await prisma.notificationTrigger.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.recentSearch.deleteMany();
  await prisma.recentlyViewed.deleteMany();
  await prisma.searchAnalytics.deleteMany();
  
  // Application depends on User and RoomType
  await prisma.application.deleteMany();
  
  await prisma.pricingHistory.deleteMany();
  await prisma.availabilityCalendar.deleteMany();
  await prisma.roomType.deleteMany();
  
  await prisma.propertyAmenity.deleteMany();
  await prisma.media.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.propertyVersion.deleteMany();
  await prisma.property.deleteMany();
  
  await prisma.amenity.deleteMany();
  
  await prisma.campus.deleteMany();
  await prisma.university.deleteMany();
  await prisma.suburb.deleteMany();
  await prisma.city.deleteMany();
  await prisma.state.deleteMany();
  await prisma.country.deleteMany();
  
  await prisma.orgStaff.deleteMany();
  await prisma.office.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Base Data
  console.log('Creating Base Organization and Location data...');
  
  const providerOrg = await prisma.organization.create({
    data: {
      name: 'Jesmond Verified Providers',
      type: OrgType.PROVIDER,
      status: 'VERIFIED',
    }
  });

  const country = await prisma.country.create({
    data: { isoCode: 'AU', name: 'Australia' }
  });

  const stateVic = await prisma.state.create({
    data: { countryId: country.id, code: 'VIC', name: 'Victoria' }
  });
  const stateNsw = await prisma.state.create({
    data: { countryId: country.id, code: 'NSW', name: 'New South Wales' }
  });
  const stateQld = await prisma.state.create({
    data: { countryId: country.id, code: 'QLD', name: 'Queensland' }
  });

  const cityMelb = await prisma.city.create({
    data: { stateId: stateVic.id, name: 'Melbourne' }
  });
  const citySyd = await prisma.city.create({
    data: { stateId: stateNsw.id, name: 'Sydney' }
  });
  const cityBris = await prisma.city.create({
    data: { stateId: stateQld.id, name: 'Brisbane' }
  });

  const subMelbCBD = await prisma.suburb.create({
    data: { cityId: cityMelb.id, name: 'Melbourne CBD', postcode: '3000', lat: -37.8136, lng: 144.9631 }
  });
  const subClayton = await prisma.suburb.create({
    data: { cityId: cityMelb.id, name: 'Clayton', postcode: '3168', lat: -37.9150, lng: 145.1300 }
  });
  const subRedfern = await prisma.suburb.create({
    data: { cityId: citySyd.id, name: 'Redfern', postcode: '2016', lat: -33.8930, lng: 151.2050 }
  });

  const uniMelb = await prisma.university.create({
    data: { name: 'University of Melbourne', slug: 'unimelb' }
  });
  const uniMonash = await prisma.university.create({
    data: { name: 'Monash University', slug: 'monash' }
  });
  const uniUsyd = await prisma.university.create({
    data: { name: 'University of Sydney', slug: 'usyd' }
  });

  await prisma.campus.create({
    data: { universityId: uniMelb.id, name: 'Parkville', lat: -37.7983, lng: 144.9610, suburbId: subMelbCBD.id }
  });
  await prisma.campus.create({
    data: { universityId: uniMonash.id, name: 'Clayton', lat: -37.9105, lng: 145.1362, suburbId: subClayton.id }
  });
  await prisma.campus.create({
    data: { universityId: uniUsyd.id, name: 'Camperdown', lat: -33.8886, lng: 151.1873, suburbId: subRedfern.id }
  });

  const aWifi = await prisma.amenity.create({ data: { name: 'High-speed WiFi', category: 'General' } });
  const aGym = await prisma.amenity.create({ data: { name: 'Gym', category: 'Wellness' } });
  const aStudy = await prisma.amenity.create({ data: { name: 'Study Hub', category: 'Academic' } });
  const aPool = await prisma.amenity.create({ data: { name: 'Swimming Pool', category: 'Wellness' } });

  console.log('Generating Properties...');
  
  const propertiesToCreate = [];
  
  // 25 Melbourne CBD
  for(let i=1; i<=25; i++) {
    propertiesToCreate.push({
      organizationId: providerOrg.id,
      name: `Scape Swanston Tier ${i}`,
      address: `${i * 10} Swanston St`,
      suburbId: subMelbCBD.id,
      postcode: '3000',
      lat: -37.8100 + ((i % 10) * 0.001 - 0.005),
      lng: 144.9600 + ((i % 10) * 0.001 - 0.005),
      description: 'Premium student living in the heart of Melbourne.',
      status: PropertyStatus.PUBLISHED,
      _index: i
    });
  }

  // 15 Clayton
  for(let i=1; i<=15; i++) {
    propertiesToCreate.push({
      organizationId: providerOrg.id,
      name: `Monash Village ${i}`,
      address: `${i * 5} Wellington Rd`,
      suburbId: subClayton.id,
      postcode: '3168',
      lat: -37.9150 + ((i % 10) * 0.001 - 0.005),
      lng: 145.1300 + ((i % 10) * 0.001 - 0.005),
      description: 'Convenient living right next to Monash Clayton campus.',
      status: PropertyStatus.PUBLISHED,
      _index: 25 + i
    });
  }

  // 10 Redfern
  for(let i=1; i<=10; i++) {
    propertiesToCreate.push({
      organizationId: providerOrg.id,
      name: `Iglu Redfern Block ${i}`,
      address: `${i * 12} Regent St`,
      suburbId: subRedfern.id,
      postcode: '2016',
      lat: -33.8930 + ((i % 10) * 0.001 - 0.005),
      lng: 151.2050 + ((i % 10) * 0.001 - 0.005),
      description: 'Boutique student accommodation in vibrant Redfern.',
      status: PropertyStatus.PUBLISHED,
      _index: 40 + i
    });
  }

  const now = new Date();
  let propCount = 0;
  let mediaCount = 0;
  let roomCount = 0;
  let priceRecords = 0;
  let availabilityRecords = 0;

  for (const p of propertiesToCreate) {
    const propIndex = p._index;
    const { _index, ...propertyData } = p;
    
    const prop = await prisma.property.create({
      data: propertyData
    });
    propCount++;

    // Deterministic amenities: Every property gets Wifi, Gym, Study. Even indexed properties get Pool.
    const amenitiesToConnect = [
      { propertyId: prop.id, amenityId: aWifi.id },
      { propertyId: prop.id, amenityId: aGym.id },
      { propertyId: prop.id, amenityId: aStudy.id }
    ];
    if (propIndex % 2 === 0) {
      amenitiesToConnect.push({ propertyId: prop.id, amenityId: aPool.id });
    }
    
    await prisma.propertyAmenity.createMany({ data: amenitiesToConnect });

    // 5 Media records per property
    const mediaData = [];
    for (let m = 1; m <= 5; m++) {
      const paddedProp = String(propIndex).padStart(2, '0');
      const paddedMedia = String(m).padStart(2, '0');
      mediaData.push({
        propertyId: prop.id, 
        url: `/assets/properties/property-${paddedProp}-${paddedMedia}.jpg`, 
        type: 'IMAGE', 
        displayOrder: m 
      });
      mediaCount++;
    }
    await prisma.media.createMany({ data: mediaData });

    // Room Types
    const studioPrice = 45000 + (propIndex % 10) * 1000;
    const studio = await prisma.roomType.create({
      data: {
        propertyId: prop.id,
        name: 'Private Studio',
        description: 'Fully self-contained studio.',
        pricePerWeek: studioPrice,
        inventory: 10,
      }
    });
    roomCount++;

    const sharedPrice = 35000 + (propIndex % 5) * 1000;
    const shared = await prisma.roomType.create({
      data: {
        propertyId: prop.id,
        name: 'Shared En-suite',
        description: 'Private bedroom with shared kitchen.',
        pricePerWeek: sharedPrice,
        inventory: 20,
      }
    });
    roomCount++;

    // Pricing History
    await prisma.pricingHistory.create({
      data: { roomTypeId: studio.id, pricePerWeek: studioPrice, effectiveFrom: now }
    });
    priceRecords++;
    await prisma.pricingHistory.create({
      data: { roomTypeId: shared.id, pricePerWeek: sharedPrice, effectiveFrom: now }
    });
    priceRecords++;

    // Availability Calendar (90 days)
    const studioAvail = [];
    const sharedAvail = [];
    for (let day = 0; day < 90; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      date.setHours(0, 0, 0, 0); // normalize time

      // Deterministic variations in availability
      const sAvail = day % 7 === 0 ? 8 : 10;
      const shAvail = day % 5 === 0 ? 15 : 20;

      studioAvail.push({ roomTypeId: studio.id, date, available: sAvail });
      sharedAvail.push({ roomTypeId: shared.id, date, available: shAvail });
      availabilityRecords += 2;
    }
    await prisma.availabilityCalendar.createMany({ data: studioAvail });
    await prisma.availabilityCalendar.createMany({ data: sharedAvail });
  }

  console.log('----------------------------------------------------');
  console.log('Seed completed successfully!');
  console.log(`- Properties: ${propCount}`);
  console.log(`- Media records: ${mediaCount}`);
  console.log(`- Room Types: ${roomCount}`);
  console.log(`- Pricing History: ${priceRecords}`);
  console.log(`- Availability Calendar: ${availabilityRecords}`);
  console.log('Seed execution was deterministic.');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
