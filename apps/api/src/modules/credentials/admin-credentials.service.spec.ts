import { AdminCredentialsService } from './admin-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../properties/core/storage.service';
import { RequirementsEngineService } from './services/requirements-engine.service';
import { UserRole, CredentialStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('AdminCredentialsService - Reviewer Eligibility & Self-Approval Prevention', () => {
  let service: AdminCredentialsService;
  let mockPrisma: any;
  let mockStorage: any;
  let mockRequirementsEngine: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      businessCredential: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      businessProfileCompletion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    mockStorage = {};
    mockRequirementsEngine = {
      recalculateOrganizationVerificationStatus: jest.fn().mockResolvedValue('VERIFIED'),
    };

    service = new AdminCredentialsService(
      mockPrisma as PrismaService,
      mockStorage as StorageService,
      mockRequirementsEngine as RequirementsEngineService,
    );
  });

  describe('Reviewer Eligibility Checks', () => {
    it('should allow eligible platform administrator to review credential', async () => {
      mockPrisma.businessCredential.findUnique.mockResolvedValueOnce({
        id: 'cred-1',
        organizationId: 'org-target-123',
        status: CredentialStatus.PENDING,
      });

      // Reviewer is ADMIN and has no staff roles in org-target-123
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        role: UserRole.ADMIN,
        orgStaffRoles: [{ organizationId: 'some-other-org' }],
      });

      mockPrisma.businessCredential.update.mockResolvedValueOnce({
        id: 'cred-1',
        status: CredentialStatus.VERIFIED,
      });

      const res = await service.reviewCredential('cred-1', 'admin-1', {
        decision: 'VERIFIED',
        notes: 'Registry match confirmed',
      });

      expect(res.status).toBe(CredentialStatus.VERIFIED);
      expect(mockRequirementsEngine.recalculateOrganizationVerificationStatus).toHaveBeenCalledWith(
        'org-target-123',
      );
    });

    it('should reject reviewer if user is not ADMIN or SUPER_ADMIN', async () => {
      mockPrisma.businessCredential.findUnique.mockResolvedValueOnce({
        id: 'cred-1',
        organizationId: 'org-target-123',
        status: CredentialStatus.PENDING,
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'staff-1',
        role: UserRole.ORG_STAFF,
        orgStaffRoles: [],
      });

      await expect(
        service.reviewCredential('cred-1', 'staff-1', {
          decision: 'VERIFIED',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prohibit self-approval when reviewer is associated with target organization', async () => {
      mockPrisma.businessCredential.findUnique.mockResolvedValueOnce({
        id: 'cred-1',
        organizationId: 'org-target-123',
        status: CredentialStatus.PENDING,
      });

      // Admin also belongs to org-target-123
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-owner',
        role: UserRole.ADMIN,
        orgStaffRoles: [{ organizationId: 'org-target-123' }],
      });

      await expect(
        service.reviewCredential('cred-1', 'admin-owner', {
          decision: 'VERIFIED',
        }),
      ).rejects.toThrow(
        /Administrative self-approval prohibited: reviewers cannot approve or reject credentials for an organization they are associated with/i,
      );

      // Verify audit log captured rejected attempt
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'admin-owner',
            action: 'credential.review_attempt_rejected',
            resourceId: 'org-target-123',
          }),
        }),
      );
    });

    it('should prohibit self-approval for ABN exemptions', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-owner',
        role: UserRole.ADMIN,
        orgStaffRoles: [{ organizationId: 'org-target-123' }],
      });

      await expect(
        service.reviewAbnExemption('org-target-123', 'admin-owner', {
          decision: 'APPROVED',
          notes: 'Self exemption',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
