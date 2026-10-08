import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessCapabilityGuard } from './business-capability.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessCapability } from '../business-capabilities';
import { CAPABILITIES_KEY } from '../decorators/require-capability.decorator';
import { OrgType } from '@prisma/client';

describe('BusinessCapabilityGuard - Phase 4 Matrix', () => {
  let guard: BusinessCapabilityGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessCapabilityGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<BusinessCapabilityGuard>(BusinessCapabilityGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as any;
  };

  const testMatrix = [
    // RETAIL cases -> allowed
    {
      category: 'RETAIL',
      required: [BusinessCapability.CATALOG],
      expected: true,
    },
    {
      category: 'RETAIL',
      required: [BusinessCapability.INVENTORY],
      expected: true,
    },
    {
      category: 'RETAIL',
      required: [BusinessCapability.ORDERS],
      expected: true,
    },
    { category: 'RETAIL', required: [BusinessCapability.POS], expected: true },
    // FOOD cases -> 403
    {
      category: 'FOOD',
      required: [BusinessCapability.CATALOG],
      expected: false,
    },
    {
      category: 'FOOD',
      required: [BusinessCapability.ORDERS],
      expected: true,
    },
    {
      category: 'FOOD',
      required: [BusinessCapability.INVENTORY],
      expected: false,
    },
    { category: 'FOOD', required: [BusinessCapability.POS], expected: false },
    // OTHER cases -> 403
    {
      category: 'MECHANICS',
      required: [BusinessCapability.CATALOG],
      expected: false,
    },
    {
      category: 'SERVICES',
      required: [BusinessCapability.ORDERS],
      expected: false,
    },
    {
      category: 'RENTALS',
      required: [BusinessCapability.INVENTORY],
      expected: false,
    },
    // FOOD Matrix
    {
      category: 'FOOD',
      required: [BusinessCapability.MENU],
      expected: true,
    },
    {
      category: 'FOOD',
      required: [BusinessCapability.MENU_ITEMS],
      expected: true,
    },
    // RETAIL -> FOOD capabilities -> 403
    {
      category: 'RETAIL',
      required: [BusinessCapability.MENU],
      expected: false,
    },
    {
      category: 'RETAIL',
      required: [BusinessCapability.MENU_ITEMS],
      expected: false,
    },
  ];

  for (const t of testMatrix) {
    it(`should return ${t.expected} for ${t.category} requesting ${t.required}`, async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(t.required);
      jest
        .spyOn(prisma.organization, 'findUnique')
        .mockResolvedValue({ businessCategory: t.category } as any);

      const context = createMockContext({ organizationId: 'org-1' });

      if (t.expected) {
        await expect(guard.canActivate(context)).resolves.toBe(true);
      } else {
        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
      }
    });
  }

  it('should prevent spoofing organizationId by pulling from trusted user context', async () => {
    // The capability relies on user.organizationId injected by JwtAuthGuard,
    // ensuring the user cannot pass an arbitrary ID to bypass.
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([BusinessCapability.CATALOG]);
    const mockFindUnique = jest
      .spyOn(prisma.organization, 'findUnique')
      .mockResolvedValue({ businessCategory: 'FOOD' } as any);

    // Even if client sends malicious body/query, the trusted token 'user.organizationId' is used
    const context = createMockContext({ organizationId: 'real-food-org' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'real-food-org' },
      select: { businessCategory: true },
    });
  });
});
