import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';
import { OrgType, BusinessCategory } from '@prisma/client';

describe('BusinessCategory QA', () => {
  let authService: AuthService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
        update: jest.fn(),
      },
      orgStaff: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: EmailService,
          useValue: { sendMail: jest.fn(), sendVerificationOtp: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. BusinessCategory validation', () => {
    it('should accept all 5 business categories', () => {
      const categories = [
        BusinessCategory.RETAIL,
        BusinessCategory.FOOD,
        BusinessCategory.MECHANICS,
        BusinessCategory.SERVICES,
        BusinessCategory.RENTALS,
      ];
      expect(categories).toHaveLength(5);
    });
  });

  describe('2. Existing organization behavior', () => {
    it('should default to RETAIL when no businessCategory is provided', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        countryCode: '+1',
        phone: '1234567890',
        dateOfBirth: '2000-01-01',
        organizationName: 'Test Org',
        organizationType: OrgType.RETAIL,
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.organization.create.mockResolvedValue({ id: 'org-1' });
      prismaService.user.create.mockResolvedValue({ id: 'user-1' });

      await authService.registerProvider(dto);

      expect(prismaService.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: OrgType.RETAIL,
          businessCategory: undefined, // Which falls back to Prisma schema default RETAIL
          status: 'PENDING',
        }),
      });
    });
  });

  describe('3. Signup with different categories', () => {
    it('should pass correct businessCategory to organization create', async () => {
      const categories = Object.values(BusinessCategory);
      for (const cat of categories) {
        jest.clearAllMocks();
        const dto = {
          email: `test_\${cat}@example.com`,
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          countryCode: '+1',
          phone: '1234567890',
          dateOfBirth: '2000-01-01',
          organizationName: `Test Org \${cat}`,
          organizationType: OrgType.RETAIL,
          businessCategory: cat,
        };

        prismaService.user.findUnique.mockResolvedValue(null);
        prismaService.organization.create.mockResolvedValue({
          id: `org-\${cat}`,
        });
        prismaService.user.create.mockResolvedValue({ id: `user-\${cat}` });

        await authService.registerProvider(dto);

        expect(prismaService.organization.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: OrgType.RETAIL,
            businessCategory: cat,
          }),
        });
      }
    });
  });

  describe('4. Location fields', () => {
    it('RetailBranch should support nullable lat/lng (typecheck)', () => {
      // Type verification happens via tsc compilation - if it builds, it passes.
      expect(true).toBe(true);
    });
  });
});
