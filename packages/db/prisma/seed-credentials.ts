import { PrismaClient, BusinessCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Credential Types ---');
  const credentialTypes = [
    {
      code: 'ABN',
      name: 'Australian Business Number',
      description: 'Official 11-digit Australian Business Number registered with the Australian Business Register (ABR)',
      category: null,
      issuer: 'Australian Business Register',
      jurisdiction: 'ALL',
      requiresDocument: false,
      requiresExpiryDate: false,
      requiresNumber: true,
      numberPattern: '^\\d{11}$',
      isPublic: true,
    },
    {
      code: 'NSW_MVRL',
      name: 'Motor Vehicle Repairer Licence',
      description: 'Statutory repairer licence issued by NSW Fair Trading under the Motor Dealers and Repairers Act 2013',
      category: BusinessCategory.MECHANICS,
      issuer: 'NSW Fair Trading',
      jurisdiction: 'NSW',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^(MVRL\\d{4,6}|\\d{5,8})$',
      isPublic: true,
    },
    {
      code: 'VIC_LVT',
      name: 'Licensed Vehicle Tester Licence',
      description: 'Authorisation to issue Certificates of Roadworthiness under VicRoads',
      category: BusinessCategory.MECHANICS,
      issuer: 'VicRoads',
      jurisdiction: 'VIC',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,12}$',
      isPublic: true,
    },
    {
      code: 'QLD_AIS',
      name: 'Approved Inspection Station Approval',
      description: 'Approval to conduct safety inspections and issue Safety Certificates under Queensland Department of Transport and Main Roads',
      category: BusinessCategory.MECHANICS,
      issuer: 'Queensland Department of Transport and Main Roads',
      jurisdiction: 'QLD',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,12}$',
      isPublic: true,
    },
    {
      code: 'WA_MRB',
      name: 'Motor Vehicle Repair Business Licence',
      description: 'Business licence issued under the Motor Vehicle Repairers Act 2003 by WA Consumer Protection',
      category: BusinessCategory.MECHANICS,
      issuer: 'WA Department of Mines, Industry Regulation and Safety',
      jurisdiction: 'WA',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^MRB\\d{3,6}$',
      isPublic: true,
    },
    {
      code: 'ARCTICK',
      name: 'ARCtick Refrigerant Handling Licence',
      description: 'National refrigerant trading authorisation or handling licence under the Ozone Protection and Synthetic Greenhouse Gas Management Act 1989',
      category: BusinessCategory.MECHANICS,
      issuer: 'Australian Refrigeration Council (ARC)',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^(L|AU)\\d{5,8}$',
      isPublic: true,
    },
    {
      code: 'ECL_CONTRACTOR',
      name: 'Electrical Contractor Licence',
      description: 'State-issued contractor licence permitting electrical wiring and installation services',
      category: BusinessCategory.SERVICES,
      issuer: 'State Electrical Safety Authority',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,12}$',
      isPublic: true,
    },
    {
      code: 'PLUMBING_CONTRACTOR',
      name: 'Plumbing Contractor Licence',
      description: 'State-issued licence permitting plumbing, drainage and gasfitting services',
      category: BusinessCategory.SERVICES,
      issuer: 'State Plumbing Licensing Board',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,12}$',
      isPublic: true,
    },
    {
      code: 'FOOD_NOTIF',
      name: 'Council Food Business Notification',
      description: 'Notification or registration of food premises under the relevant State Food Act with the local municipal council',
      category: BusinessCategory.FOOD,
      issuer: 'Local Municipal Council',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: false,
      requiresNumber: false,
      numberPattern: null,
      isPublic: false,
    },
    {
      code: 'FOOD_FSS',
      name: 'Food Safety Supervisor Certificate',
      description: 'Statement of Attainment from an approved RTO for food safety supervision in hospitality / food processing',
      category: BusinessCategory.FOOD,
      issuer: 'State Food Authority / Registered Training Organisation',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,20}$',
      isPublic: false,
    },
    {
      code: 'SECOND_HAND_DEALER',
      name: 'Pawnbrokers & Second-Hand Dealers Licence',
      description: 'Statutory licence for businesses purchasing or selling second-hand goods',
      category: BusinessCategory.RETAIL,
      issuer: 'State Fair Trading / Police Licensing',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,12}$',
      isPublic: true,
    },
    {
      code: 'REAL_ESTATE_CORP',
      name: 'Real Estate Corporation Licence',
      description: 'Corporation licence to conduct real estate agency, leasing and property management',
      category: BusinessCategory.RENTALS,
      issuer: 'State Fair Trading / Consumer Affairs',
      jurisdiction: 'ALL',
      requiresDocument: true,
      requiresExpiryDate: true,
      requiresNumber: true,
      numberPattern: '^[A-Z0-9-]{4,12}$',
      isPublic: true,
    },
  ];

  const typeMap = new Map<string, string>();
  for (const ct of credentialTypes) {
    const record = await prisma.credentialType.upsert({
      where: { code: ct.code },
      update: ct,
      create: ct,
    });
    typeMap.set(ct.code, record.id);
  }
  console.log(`✓ Upserted ${typeMap.size} Credential Types.`);

  console.log('--- Seeding Credential Requirements ---');
  const requirements = [
    // Universal ABN across all 5 business categories
    { code: 'ABN', category: BusinessCategory.RETAIL, service: null, state: null, mandatory: true },
    { code: 'ABN', category: BusinessCategory.FOOD, service: null, state: null, mandatory: true },
    { code: 'ABN', category: BusinessCategory.MECHANICS, service: null, state: null, mandatory: true },
    { code: 'ABN', category: BusinessCategory.SERVICES, service: null, state: null, mandatory: true },
    { code: 'ABN', category: BusinessCategory.RENTALS, service: null, state: null, mandatory: true },

    // Mechanics Specific Requirements
    { code: 'NSW_MVRL', category: BusinessCategory.MECHANICS, service: null, state: 'NSW', mandatory: true },
    { code: 'VIC_LVT', category: BusinessCategory.MECHANICS, service: 'roadworthy-inspection', state: 'VIC', mandatory: true },
    { code: 'QLD_AIS', category: BusinessCategory.MECHANICS, service: 'safety-certificate', state: 'QLD', mandatory: true },
    { code: 'WA_MRB', category: BusinessCategory.MECHANICS, service: null, state: 'WA', mandatory: true },
    { code: 'ARCTICK', category: BusinessCategory.MECHANICS, service: 'air-conditioning', state: null, mandatory: true },

    // Services / Tradies Specific Requirements
    { code: 'ECL_CONTRACTOR', category: BusinessCategory.SERVICES, service: 'electrical', state: null, mandatory: true },
    { code: 'PLUMBING_CONTRACTOR', category: BusinessCategory.SERVICES, service: 'plumbing', state: null, mandatory: true },

    // Food Requirements
    { code: 'FOOD_NOTIF', category: BusinessCategory.FOOD, service: null, state: null, mandatory: true },
    { code: 'FOOD_FSS', category: BusinessCategory.FOOD, service: 'ready-to-eat', state: null, mandatory: true },

    // Retail Regulated
    { code: 'SECOND_HAND_DEALER', category: BusinessCategory.RETAIL, service: 'second-hand', state: null, mandatory: true },

    // Rentals Regulated
    { code: 'REAL_ESTATE_CORP', category: BusinessCategory.RENTALS, service: 'property-management', state: null, mandatory: true },
  ];

  let reqCount = 0;
  for (const req of requirements) {
    const typeId = typeMap.get(req.code);
    if (!typeId) continue;

    // We check existing requirement by matching fields
    const existing = await prisma.credentialRequirement.findFirst({
      where: {
        credentialTypeId: typeId,
        businessCategory: req.category,
        serviceName: req.service,
        state: req.state,
      },
    });

    if (existing) {
      await prisma.credentialRequirement.update({
        where: { id: existing.id },
        data: { isMandatory: req.mandatory },
      });
    } else {
      await prisma.credentialRequirement.create({
        data: {
          credentialTypeId: typeId,
          businessCategory: req.category,
          serviceName: req.service,
          state: req.state,
          isMandatory: req.mandatory,
        },
      });
    }
    reqCount++;
  }
  console.log(`✓ Configured ${reqCount} Credential Requirements.`);

  console.log('--- Backfilling BusinessProfileCompletion for Existing Organizations ---');
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, businessCategory: true },
  });

  let backfillCount = 0;
  for (const org of organizations) {
    const existing = await prisma.businessProfileCompletion.findUnique({
      where: { organizationId: org.id },
    });
    if (!existing) {
      await prisma.businessProfileCompletion.create({
        data: {
          organizationId: org.id,
          isCompleted: false,
          currentStep: 1,
          overallStatus: 'NOT_SUBMITTED',
        },
      });
      backfillCount++;
    }
  }
  console.log(`✓ Backfilled BusinessProfileCompletion for ${backfillCount} / ${organizations.length} organizations.`);

  console.log('=== Phase 1 Database & Seed Completed Successfully ===');
}

main()
  .catch((err) => {
    console.error('Migration / Seed Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
