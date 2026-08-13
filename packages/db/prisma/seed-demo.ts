import { PrismaClient, UserRole, AccountStatus, OrgType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Demo Seed...');

  // Hash the standard demo password
  const passwordHash = await bcrypt.hash('Jesmond@Demo2026!', 10);

  // 1. Upsert Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@jesmond.demo' },
    update: {
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    },
    create: {
      email: 'superadmin@jesmond.demo',
      password: passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    }
  });
  console.log(`Upserted Super Admin: ${superAdmin.id}`);

  // 2. Upsert Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jesmond.demo' },
    update: {
      password: passwordHash,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    },
    create: {
      email: 'admin@jesmond.demo',
      password: passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    }
  });
  console.log(`Upserted Admin: ${admin.id}`);

  // 3. Upsert Student
  const student = await prisma.user.upsert({
    where: { email: 'student@jesmond.demo' },
    update: {
      password: passwordHash,
      role: UserRole.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    },
    create: {
      email: 'student@jesmond.demo',
      password: passwordHash,
      firstName: 'Demo',
      lastName: 'Student',
      role: UserRole.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    }
  });
  console.log(`Upserted Student: ${student.id}`);

  // 4. Upsert Provider and Organization
  const provider = await prisma.user.upsert({
    where: { email: 'provider@jesmond.demo' },
    update: {
      password: passwordHash,
      role: UserRole.ORG_STAFF,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    },
    create: {
      email: 'provider@jesmond.demo',
      password: passwordHash,
      firstName: 'Demo',
      lastName: 'Provider',
      role: UserRole.ORG_STAFF,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: true
    }
  });
  console.log(`Upserted Provider: ${provider.id}`);

  let organization = await prisma.organization.findFirst({
    where: { name: 'Jesmond Demo Accommodation' }
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Jesmond Demo Accommodation',
        type: OrgType.PROVIDER,
        status: 'VERIFIED'
      }
    });
  }
  console.log(`Upserted Organization: ${organization.id}`);

  const orgStaff = await prisma.orgStaff.upsert({
    where: {
      userId_organizationId: {
        userId: provider.id,
        organizationId: organization.id
      }
    },
    update: {
      role: UserRole.ORG_STAFF,
      permissions: ['*']
    },
    create: {
      userId: provider.id,
      organizationId: organization.id,
      role: UserRole.ORG_STAFF,
      permissions: ['*']
    }
  });
  console.log(`Linked Provider to Organization via OrgStaff: ${orgStaff.id}`);

  // 5. Upsert Provider Demo Properties
  const suburb = await prisma.suburb.findFirst();
  if (suburb) {
    const demoProperties = [
      { name: 'Jesmond Central Studios', status: 'PUBLISHED', type: 'STUDIO', price: 350 },
      { name: 'Newcastle Uni Village', status: 'PUBLISHED', type: 'SHARED_ROOM', price: 250 },
      { name: 'Hunter Street Apartments', status: 'PUBLISHED', type: 'ENTIRE_PLACE', price: 450 },
      { name: 'Callaghan Campus Lodge', status: 'PENDING_APPROVAL', type: 'PRIVATE_ROOM', price: 280 },
      { name: 'Jesmond Park View', status: 'PENDING_APPROVAL', type: 'SHARED_ROOM', price: 220 },
      { name: 'Shortland Heights', status: 'PENDING_APPROVAL', type: 'STUDIO', price: 320 },
      { name: 'Waratah Student Housing', status: 'DRAFT', type: 'ENTIRE_PLACE', price: 500 },
      { name: 'Lambton Co-Living', status: 'DRAFT', type: 'PRIVATE_ROOM', price: 270 },
      { name: 'Broadmeadow Transit Hub', status: 'DRAFT', type: 'SHARED_ROOM', price: 210 },
      { name: 'Islington Historic Stay', status: 'ARCHIVED', type: 'PRIVATE_ROOM', price: 290 },
    ];

    let propertyIds: string[] = [];
    for (const p of demoProperties) {
      let property = await prisma.property.findFirst({
        where: { organizationId: organization.id, name: p.name }
      });
      if (!property) {
        property = await prisma.property.create({
          data: {
            name: p.name,
            address: `Demo Address for ${p.name}`,
            suburbId: suburb.id,
            postcode: suburb.postcode,
            lat: suburb.lat,
            lng: suburb.lng,
            description: `A dedicated mock property for provider testing. Type: ${p.type}.`,
            status: p.status as any,
            organizationId: organization.id
          }
        });
        
        // Add room type
        await prisma.roomType.create({
          data: {
            propertyId: property.id,
            name: p.type,
            description: `A ${p.type} room`,
            pricePerWeek: p.price,
            inventory: 5
          }
        });
        console.log(`Created Demo Provider Property: ${property.name} (${property.status})`);
      } else {
        console.log(`Demo Provider Property already exists: ${property.name}`);
      }
      propertyIds.push(property.id);
    }

    // 6. Demo Applications and Saved Properties
    const publishedProperties = propertyIds.slice(0, 3); // The first 3 are PUBLISHED
    const pendingProperties = propertyIds.slice(3, 6); // The next 3 are PENDING

    // Applications for the Student
    if (publishedProperties.length > 0) {
      const rt1 = await prisma.roomType.findFirst({ where: { propertyId: publishedProperties[0] } });
      if (rt1) {
        const app1 = await prisma.application.findFirst({ where: { studentId: student.id, roomTypeId: rt1.id } });
        if (!app1) {
          await prisma.application.create({
            data: {
              studentId: student.id,
              roomTypeId: rt1.id,
              status: 'PENDING',
              moveInDate: new Date(),
              durationMonths: 6,
              lockedPrice: rt1.pricePerWeek
            }
          });
          console.log('Created Student Application (PENDING)');
        }
      }

      if (publishedProperties.length > 1) {
        const rt2 = await prisma.roomType.findFirst({ where: { propertyId: publishedProperties[1] } });
        if (rt2) {
          const app2 = await prisma.application.findFirst({ where: { studentId: student.id, roomTypeId: rt2.id } });
          if (!app2) {
            await prisma.application.create({
              data: {
                studentId: student.id,
                roomTypeId: rt2.id,
                status: 'APPROVED',
                moveInDate: new Date(),
                durationMonths: 12,
                lockedPrice: rt2.pricePerWeek
              }
            });
            console.log('Created Student Application (APPROVED)');
          }
        }
      }

      if (publishedProperties.length > 2) {
        const rt3 = await prisma.roomType.findFirst({ where: { propertyId: publishedProperties[2] } });
        if (rt3) {
          const app3 = await prisma.application.findFirst({ where: { studentId: student.id, roomTypeId: rt3.id } });
          if (!app3) {
            await prisma.application.create({
              data: {
                studentId: student.id,
                roomTypeId: rt3.id,
                status: 'REJECTED',
                moveInDate: new Date(),
                durationMonths: 12,
                lockedPrice: rt3.pricePerWeek
              }
            });
            console.log('Created Student Application (REJECTED)');
          }
        }
      }
    }

    // Saved Properties
    for (const pid of [...publishedProperties, ...pendingProperties]) {
      const saved = await prisma.savedProperty.findUnique({
        where: {
          studentId_propertyId: {
            studentId: student.id,
            propertyId: pid
          }
        }
      });
      if (!saved) {
        await prisma.savedProperty.create({
          data: {
            studentId: student.id,
            propertyId: pid
          }
        });
        console.log(`Saved property ${pid} for demo student.`);
      }
    }

  } else {
    console.warn('No suburbs found. Skipping demo property creation. Run Phase 4 seed first.');
  }

  // Ensure feature flag PAYMENTS_BOOKING is set
  const flag = await prisma.featureFlag.findUnique({ where: { key: 'PAYMENTS_BOOKING' } });
  if (!flag) {
    await prisma.featureFlag.create({
      data: {
        key: 'PAYMENTS_BOOKING',
        enabled: true,
        description: 'Enable payment booking functionality'
      }
    });
    console.log('Created feature flag PAYMENTS_BOOKING');
  } else {
    console.log('Feature flag PAYMENTS_BOOKING already exists');
  }

  console.log('Demo Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
