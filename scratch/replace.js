const fs = require('fs');

const path = 'apps/api/src/modules/properties/core/properties.service.ts';
let content = fs.readFileSync(path, 'utf8');

const target1 = `        organization: {
          select: {
            name: true,
            abn: true,
            settings: true,
            staff: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              select: {
                role: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    countryCode: true,
                  },
                },
              },
            },
          },
        },
        suburb: { select: { name: true, city: { select: { name: true } }, state: { select: { name: true, code: true } } } },
        media: { orderBy: { displayOrder: 'asc' } },
        roomTypes: {
          include: {
            availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
            pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
          }
        },`;

const replacement1 = `        organization: {
          select: {
            id: true,
            name: true,
            abn: true,
            settings: true,
          },
        },
        suburb: { select: { name: true, city: { select: { name: true } }, state: { select: { name: true, code: true } } } },
        media: { orderBy: { displayOrder: 'asc' } },
        roomTypes: true,`;

const target2 = `      const settings: any = pubProperty.organization.settings || {};
      const contactStaff =
        pubProperty.organization.staff.find((staff: any) => staff.role === 'ADMIN')?.user ??
        pubProperty.organization.staff[0]?.user;
      const profilePhone = contactStaff?.phone`;

const replacement2 = `      const settings: any = pubProperty.organization.settings || {};
      
      const staffMembers = await this.prisma.orgStaff.findMany({
        where: { organizationId: pubProperty.organization.id, deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true, phone: true, countryCode: true }
          }
        }
      });
      const contactStaff = staffMembers[0]?.user;
      
      const profilePhone = contactStaff?.phone`;

// Handle CRLF vs LF
content = content.replace(target1.replace(/\n/g, '\r\n'), replacement1.replace(/\n/g, '\r\n'));
content = content.replace(target1, replacement1);

content = content.replace(target2.replace(/\n/g, '\r\n'), replacement2.replace(/\n/g, '\r\n'));
content = content.replace(target2, replacement2);

fs.writeFileSync(path, content, 'utf8');
console.log("Replaced successfully!");
