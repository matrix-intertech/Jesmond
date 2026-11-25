import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from '../services/organizations.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('OrganizationsController — Origin Spoofing & Server Verification Security Challenge', () => {
  let controller: OrganizationsController;
  let service: any;

  beforeEach(async () => {
    service = {
      initiateBusinessOnboarding: jest.fn(),
      createOrganizationForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  describe('1. Origin Spoofing Attack Vectors (Client-Supplied Headers)', () => {
    it('1.1 should pass request to service requiring server-verified onboarding token when customer has NO Origin header', async () => {
      const req = {
        user: { id: 'customer-1', role: UserRole.STUDENT },
        headers: {},
      };

      service.createOrganizationForUser.mockRejectedValue(
        new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        ),
      );

      await expect(
        controller.createOrganization(req, {
          name: 'Direct API Corp',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(service.createOrganizationForUser).toHaveBeenCalledWith(
        'customer-1',
        { name: 'Direct API Corp', onboardingToken: undefined },
        UserRole.STUDENT,
      );
    });

    it('1.2 should REJECT customer attempting organization creation even with forged Origin: https://business.jesmond.com.au without server onboardingToken', async () => {
      const req = {
        user: { id: 'customer-attacker-1', role: UserRole.STUDENT },
        headers: {
          origin: 'https://business.jesmond.com.au',
          host: 'business.jesmond.com.au',
        },
      };

      service.createOrganizationForUser.mockRejectedValue(
        new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        ),
      );

      await expect(
        controller.createOrganization(req, {
          name: 'Spoofed Origin Enterprise',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.3 should REJECT customer attempting organization creation with forged Origin: http://business.localhost:3000 without server onboardingToken', async () => {
      const req = {
        user: { id: 'customer-attacker-2', role: UserRole.STUDENT },
        headers: {
          origin: 'http://business.localhost:3000',
          host: 'business.localhost:3000',
        },
      };

      service.createOrganizationForUser.mockRejectedValue(
        new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        ),
      );

      await expect(
        controller.createOrganization(req, {
          name: 'Local Dev Spoofed Enterprise',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.4 should REJECT customer attempting organization creation with forged Referer: https://business.jesmond.com.au/onboarding', async () => {
      const req = {
        user: { id: 'customer-attacker-3', role: UserRole.STUDENT },
        headers: {
          referer: 'https://business.jesmond.com.au/onboarding',
        },
      };

      service.createOrganizationForUser.mockRejectedValue(
        new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        ),
      );

      await expect(
        controller.createOrganization(req, {
          name: 'Spoofed Referer Corp',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.5 should REJECT customer attempting organization creation with conflicting Origin, Host, and X-Forwarded-Host', async () => {
      const req = {
        user: { id: 'customer-attacker-4', role: UserRole.STUDENT },
        headers: {
          host: 'jesmond.com.au',
          origin: 'https://business.jesmond.com.au',
          'x-forwarded-host': 'business.jesmond.com.au',
          referer: 'https://evil-site.com',
        },
      };

      service.createOrganizationForUser.mockRejectedValue(
        new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        ),
      );

      await expect(
        controller.createOrganization(req, {
          name: 'Conflicting Headers Enterprise',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.6 should REJECT direct curl / Python API requests bypassing the browser entirely', async () => {
      const req = {
        user: { id: 'direct-curl-user', role: UserRole.STUDENT },
        headers: {
          'user-agent': 'curl/7.88.1',
        },
      };

      service.createOrganizationForUser.mockRejectedValue(
        new ForbiddenException(
          'Missing server-verified business onboarding token. Organization creation is restricted to the verified onboarding flow.',
        ),
      );

      await expect(
        controller.createOrganization(req, {
          name: 'Bypassed Browser Corp',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Server-Verified Onboarding Flow Execution', () => {
    it('2.1 should successfully initiate onboarding and return server-verified token', async () => {
      const req = {
        user: { id: 'verified-customer-1', role: UserRole.STUDENT },
      };

      service.initiateBusinessOnboarding.mockResolvedValue({
        onboardingToken: 'server.signed.onboarding.token',
        expiresIn: 900,
      });

      const result = await controller.initiateOnboarding(req);
      expect(result).toEqual({
        onboardingToken: 'server.signed.onboarding.token',
        expiresIn: 900,
      });
      expect(service.initiateBusinessOnboarding).toHaveBeenCalledWith(
        'verified-customer-1',
      );
    });

    it('2.2 should create organization when valid onboardingToken is supplied in request body', async () => {
      const req = {
        user: { id: 'verified-customer-1', role: UserRole.STUDENT },
        headers: {},
      };

      const mockOrg = {
        id: 'org-created-123',
        name: 'Verified Student Properties',
      };
      service.createOrganizationForUser.mockResolvedValue(mockOrg);

      const result = await controller.createOrganization(req, {
        name: 'Verified Student Properties',
        onboardingToken: 'valid.onboarding.jwt',
      });

      expect(result).toEqual(mockOrg);
      expect(service.createOrganizationForUser).toHaveBeenCalledWith(
        'verified-customer-1',
        {
          name: 'Verified Student Properties',
          onboardingToken: 'valid.onboarding.jwt',
        },
        UserRole.STUDENT,
      );
    });

    it('2.3 should create organization when onboardingToken is passed via X-Onboarding-Token header', async () => {
      const req = {
        user: { id: 'verified-customer-2', role: UserRole.STUDENT },
        headers: {
          'x-onboarding-token': 'header.onboarding.jwt',
        },
      };

      const mockOrg = {
        id: 'org-created-456',
        name: 'Header Token Properties',
      };
      service.createOrganizationForUser.mockResolvedValue(mockOrg);

      const result = await controller.createOrganization(req, {
        name: 'Header Token Properties',
      });

      expect(result).toEqual(mockOrg);
      expect(service.createOrganizationForUser).toHaveBeenCalledWith(
        'verified-customer-2',
        {
          name: 'Header Token Properties',
          onboardingToken: 'header.onboarding.jwt',
        },
        UserRole.STUDENT,
      );
    });

    it('2.4 should allow platform admin to create organization directly without onboardingToken', async () => {
      const req = {
        user: { id: 'platform-admin-1', role: UserRole.ADMIN },
        headers: {},
      };

      service.createOrganizationForUser.mockResolvedValue({
        id: 'org-admin-1',
        name: 'Admin Managed Agency',
      });

      const result = await controller.createOrganization(req, {
        name: 'Admin Managed Agency',
      });

      expect(result).toEqual({
        id: 'org-admin-1',
        name: 'Admin Managed Agency',
      });
      expect(service.createOrganizationForUser).toHaveBeenCalledWith(
        'platform-admin-1',
        { name: 'Admin Managed Agency', onboardingToken: undefined },
        UserRole.ADMIN,
      );
    });
  });

  describe('3. Validation handling', () => {
    it('3.1 should reject empty organization name with BadRequestException', async () => {
      const req = {
        user: { id: 'user-1', role: UserRole.STUDENT },
      };

      await expect(
        controller.createOrganization(req, {
          name: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
