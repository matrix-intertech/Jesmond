import { RequirementsEngineService } from '../../src/modules/credentials/services/requirements-engine.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import {
  BusinessCategory,
  CredentialStatus,
  AbnExemptionStatus,
} from '@prisma/client';

describe('RequirementsEngineService - Dynamic Resolution', () => {
  let service: RequirementsEngineService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findUnique: jest.fn(),
      },
      credentialRequirement: {
        findMany: jest.fn(),
      },
    };
    service = new RequirementsEngineService(mockPrisma as PrismaService);
  });

  it('should dynamically resolve NSW_MVRL for Mechanics located in NSW', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: 'org-mech-nsw',
      businessCategory: BusinessCategory.MECHANICS,
      abn: '51824753556',
      RetailBranch: [{ address: '100 Main St, Newcastle NSW 2300' }],
      businessServices: [{ id: 's1', name: 'Standard Logbook Service' }],
      profileCompletion: {
        isCompleted: false,
        abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED,
      },
      credentials: [],
    });

    mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
      {
        id: 'req-abn',
        credentialTypeId: 'type-abn',
        businessCategory: BusinessCategory.MECHANICS,
        serviceName: null,
        state: null,
        isMandatory: true,
        credentialType: {
          id: 'type-abn',
          code: 'ABN',
          name: 'Australian Business Number',
          issuer: 'ABR',
          jurisdiction: 'ALL',
          requiresDocument: false,
          requiresExpiryDate: false,
          requiresNumber: true,
          isPublic: true,
        },
      },
      {
        id: 'req-mvrl',
        credentialTypeId: 'type-mvrl',
        businessCategory: BusinessCategory.MECHANICS,
        serviceName: null,
        state: 'NSW',
        isMandatory: true,
        credentialType: {
          id: 'type-mvrl',
          code: 'NSW_MVRL',
          name: 'Motor Vehicle Repairer Licence',
          issuer: 'NSW Fair Trading',
          jurisdiction: 'NSW',
          requiresDocument: true,
          requiresExpiryDate: true,
          requiresNumber: true,
          isPublic: true,
        },
      },
    ]);

    const result = await service.resolveRequirementsForOrganization('org-mech-nsw');

    expect(result.state).toBe('NSW');
    expect(result.requirements).toHaveLength(2);
    expect(result.requirements.map((r) => r.credentialCode)).toEqual([
      'ABN',
      'NSW_MVRL',
    ]);
  });

  it('should exclude service-specific requirements if the business does not offer that service', async () => {
    // Mechanic in VIC offering only general servicing (no roadworthy)
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: 'org-mech-vic',
      businessCategory: BusinessCategory.MECHANICS,
      abn: '51824753556',
      RetailBranch: [{ address: '50 Collins St, Melbourne VIC 3000' }],
      businessServices: [{ id: 's1', name: 'General Oil & Filter Change' }],
      profileCompletion: {
        isCompleted: false,
        abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED,
      },
      credentials: [],
    });

    mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
      {
        id: 'req-abn',
        credentialTypeId: 'type-abn',
        businessCategory: BusinessCategory.MECHANICS,
        serviceName: null,
        state: null,
        isMandatory: true,
        credentialType: {
          id: 'type-abn',
          code: 'ABN',
          name: 'Australian Business Number',
          issuer: 'ABR',
          jurisdiction: 'ALL',
          requiresDocument: false,
          requiresExpiryDate: false,
          requiresNumber: true,
          isPublic: true,
        },
      },
      {
        id: 'req-lvt',
        credentialTypeId: 'type-lvt',
        businessCategory: BusinessCategory.MECHANICS,
        serviceName: 'roadworthy-inspection',
        state: 'VIC',
        isMandatory: true,
        credentialType: {
          id: 'type-lvt',
          code: 'VIC_LVT',
          name: 'Licensed Vehicle Tester Licence',
          issuer: 'VicRoads',
          jurisdiction: 'VIC',
          requiresDocument: true,
          requiresExpiryDate: true,
          requiresNumber: true,
          isPublic: true,
        },
      },
    ]);

    const result = await service.resolveRequirementsForOrganization('org-mech-vic');

    expect(result.state).toBe('VIC');
    // VIC_LVT should be filtered out because activeServices does NOT include 'roadworthy-inspection'
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].credentialCode).toBe('ABN');
  });

  it('should satisfy ABN requirement when abnExemptionStatus is APPROVED', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: 'org-exempt',
      businessCategory: BusinessCategory.RETAIL,
      abn: null, // No ABN
      RetailBranch: [{ address: '10 Market St, Sydney NSW 2000' }],
      businessServices: [],
      profileCompletion: {
        isCompleted: false,
        abnExemptionStatus: AbnExemptionStatus.APPROVED,
      },
      credentials: [],
    });

    mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
      {
        id: 'req-abn',
        credentialTypeId: 'type-abn',
        businessCategory: BusinessCategory.RETAIL,
        serviceName: null,
        state: null,
        isMandatory: true,
        credentialType: {
          id: 'type-abn',
          code: 'ABN',
          name: 'Australian Business Number',
          issuer: 'ABR',
          jurisdiction: 'ALL',
          requiresDocument: false,
          requiresExpiryDate: false,
          requiresNumber: true,
          isPublic: true,
        },
      },
    ]);

    const result = await service.resolveRequirementsForOrganization('org-exempt');

    expect(result.abnExemptionStatus).toBe(AbnExemptionStatus.APPROVED);
    expect(result.requirements[0].currentStatus).toBe(CredentialStatus.VERIFIED);
    expect(result.missingMandatoryCount).toBe(0);
  });

  it('should NOT satisfy ABN requirement when abnExemptionStatus is PENDING_REVIEW', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: 'org-pending-exemption',
      businessCategory: BusinessCategory.RETAIL,
      abn: null,
      RetailBranch: [{ address: '10 Market St, Sydney NSW 2000' }],
      businessServices: [],
      profileCompletion: {
        isCompleted: false,
        abnExemptionStatus: AbnExemptionStatus.PENDING_REVIEW,
      },
      credentials: [],
    });

    mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
      {
        id: 'req-abn',
        credentialTypeId: 'type-abn',
        businessCategory: BusinessCategory.RETAIL,
        serviceName: null,
        state: null,
        isMandatory: true,
        credentialType: {
          id: 'type-abn',
          code: 'ABN',
          name: 'Australian Business Number',
          issuer: 'ABR',
          jurisdiction: 'ALL',
          requiresDocument: false,
          requiresExpiryDate: false,
          requiresNumber: true,
          isPublic: true,
        },
      },
    ]);

    const result = await service.resolveRequirementsForOrganization(
      'org-pending-exemption',
    );

    expect(result.abnExemptionStatus).toBe(AbnExemptionStatus.PENDING_REVIEW);
    expect(result.requirements[0].currentStatus).toBe(CredentialStatus.PENDING);
    // PENDING counts as pending review; missing mandatory is 0 because it has been submitted for review
    expect(result.missingMandatoryCount).toBe(0);
  });
});
