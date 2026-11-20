import { RequirementsEngineService } from './requirements-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BusinessCategory,
  CredentialStatus,
  AbnExemptionStatus,
  BusinessVerificationStatus,
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
    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].credentialCode).toBe('ABN');
  });

  it('should satisfy ABN requirement when abnExemptionStatus is APPROVED', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: 'org-exempt',
      businessCategory: BusinessCategory.RETAIL,
      abn: null,
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
    expect(result.missingMandatoryCount).toBe(0);
  });

  describe('recalculateOrganizationVerificationStatus', () => {
    beforeEach(() => {
      mockPrisma.businessProfileCompletion = {
        upsert: jest.fn().mockImplementation((args) => args.update),
      };
    });

    it('1. ABN approved but mandatory licence missing -> overallStatus is PARTIALLY_VERIFIED (never VERIFIED)', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-1',
        businessCategory: BusinessCategory.MECHANICS,
        abn: '51824753556',
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [{ id: 's1', name: 'Logbook Servicing' }],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED },
        credentials: [
          {
            credentialTypeId: 'type-abn',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-abn', code: 'ABN' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-1');
      expect(status).toBe(BusinessVerificationStatus.PARTIALLY_VERIFIED);
      expect(status).not.toBe(BusinessVerificationStatus.VERIFIED);
    });

    it('2. ABN approved and mandatory licence pending -> overallStatus is PARTIALLY_VERIFIED', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-2',
        businessCategory: BusinessCategory.MECHANICS,
        abn: '51824753556',
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [{ id: 's1', name: 'Logbook Servicing' }],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED },
        credentials: [
          {
            credentialTypeId: 'type-abn',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-abn', code: 'ABN' },
          },
          {
            credentialTypeId: 'type-mvrl',
            status: CredentialStatus.PENDING,
            credentialType: { id: 'type-mvrl', code: 'NSW_MVRL' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-2');
      expect(status).toBe(BusinessVerificationStatus.PARTIALLY_VERIFIED);
    });

    it('3. All mandatory credentials verified -> overallStatus is VERIFIED', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-3',
        businessCategory: BusinessCategory.MECHANICS,
        abn: '51824753556',
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [{ id: 's1', name: 'Logbook Servicing' }],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED },
        credentials: [
          {
            credentialTypeId: 'type-abn',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-abn', code: 'ABN' },
          },
          {
            credentialTypeId: 'type-mvrl',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-mvrl', code: 'NSW_MVRL' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-3');
      expect(status).toBe(BusinessVerificationStatus.VERIFIED);
    });

    it('4. Mandatory ABN exemption approved + mandatory licence verified -> overallStatus is VERIFIED', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-4',
        businessCategory: BusinessCategory.MECHANICS,
        abn: null,
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [{ id: 's1', name: 'Logbook Servicing' }],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.APPROVED },
        credentials: [
          {
            credentialTypeId: 'type-mvrl',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-mvrl', code: 'NSW_MVRL' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-4');
      expect(status).toBe(BusinessVerificationStatus.VERIFIED);
    });

    it('5. Optional credential missing does NOT block overall VERIFIED status', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-5',
        businessCategory: BusinessCategory.MECHANICS,
        abn: '51824753556',
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [{ id: 's1', name: 'Logbook Servicing' }],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED },
        credentials: [
          {
            credentialTypeId: 'type-abn',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-abn', code: 'ABN' },
          },
          {
            credentialTypeId: 'type-mvrl',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-mvrl', code: 'NSW_MVRL' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
        {
          id: 'req-ins',
          credentialTypeId: 'type-ins',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: false, // Optional Public Liability
          credentialType: { id: 'type-ins', code: 'INSURANCE_PL', name: 'Public Liability' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-5');
      expect(status).toBe(BusinessVerificationStatus.VERIFIED);
    });

    it('6. Mandatory credential rejected -> overallStatus is ACTION_REQUIRED', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-6',
        businessCategory: BusinessCategory.MECHANICS,
        abn: '51824753556',
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [{ id: 's1', name: 'Logbook Servicing' }],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED },
        credentials: [
          {
            credentialTypeId: 'type-abn',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-abn', code: 'ABN' },
          },
          {
            credentialTypeId: 'type-mvrl',
            status: CredentialStatus.REJECTED,
            credentialType: { id: 'type-mvrl', code: 'NSW_MVRL' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-6');
      expect(status).toBe(BusinessVerificationStatus.ACTION_REQUIRED);
    });

    it('7. Requirements change after service selection changes (adding Air Conditioning introduces ARCtick requirement)', async () => {
      // Business previously verified with ABN and MVRL
      // Now adds 'Air Conditioning Service' to businessServices, requiring ARCTICK
      mockPrisma.organization.findUnique.mockResolvedValueOnce({
        id: 'org-mech-7',
        businessCategory: BusinessCategory.MECHANICS,
        abn: '51824753556',
        RetailBranch: [{ address: '100 Workshop Way, Newcastle NSW 2300' }],
        businessServices: [
          { id: 's1', name: 'Logbook Servicing' },
          { id: 's2', name: 'Automotive Air Conditioning' },
        ],
        profileCompletion: { isCompleted: true, abnExemptionStatus: AbnExemptionStatus.NOT_REQUESTED },
        credentials: [
          {
            credentialTypeId: 'type-abn',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-abn', code: 'ABN' },
          },
          {
            credentialTypeId: 'type-mvrl',
            status: CredentialStatus.VERIFIED,
            credentialType: { id: 'type-mvrl', code: 'NSW_MVRL' },
          },
        ],
      });

      mockPrisma.credentialRequirement.findMany.mockResolvedValueOnce([
        {
          id: 'req-abn',
          credentialTypeId: 'type-abn',
          businessCategory: BusinessCategory.MECHANICS,
          isMandatory: true,
          credentialType: { id: 'type-abn', code: 'ABN', name: 'ABN' },
        },
        {
          id: 'req-mvrl',
          credentialTypeId: 'type-mvrl',
          businessCategory: BusinessCategory.MECHANICS,
          state: 'NSW',
          isMandatory: true,
          credentialType: { id: 'type-mvrl', code: 'NSW_MVRL', name: 'MVRL' },
        },
        {
          id: 'req-arctick',
          credentialTypeId: 'type-arctick',
          businessCategory: BusinessCategory.MECHANICS,
          serviceName: 'air conditioning', // Matches 'Automotive Air Conditioning'
          isMandatory: true,
          credentialType: { id: 'type-arctick', code: 'ARCTICK', name: 'Refrigerant Licence' },
        },
      ]);

      const status = await service.recalculateOrganizationVerificationStatus('org-mech-7');
      // ARCtick is not yet submitted/verified, so status must NOT be VERIFIED
      expect(status).toBe(BusinessVerificationStatus.PARTIALLY_VERIFIED);
      expect(status).not.toBe(BusinessVerificationStatus.VERIFIED);
    });
  });
});
