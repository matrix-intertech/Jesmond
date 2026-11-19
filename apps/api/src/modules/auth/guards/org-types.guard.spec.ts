import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgTypesGuard } from './org-types.guard';
import { OrgType } from '@prisma/client';
import { ORG_TYPES_KEY } from '../decorators/org-types.decorator';

describe('OrgTypesGuard', () => {
  let guard: OrgTypesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgTypesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<OrgTypesGuard>(OrgTypesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('should allow if no org types are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: 'ORG_STAFF', orgType: OrgType.PROVIDER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should bypass non-ORG_STAFF roles (e.g. SUPER_ADMIN)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.RETAIL]);
    const context = createMockContext({ role: 'SUPER_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ORG_STAFF with matching orgType RETAIL', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.RETAIL]);
    const context = createMockContext({
      role: 'ORG_STAFF',
      orgType: OrgType.RETAIL,
      businessCategory: 'RETAIL',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ORG_STAFF with businessCategory RETAIL even if orgType is legacy PROVIDER', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.RETAIL]);
    const context = createMockContext({
      role: 'ORG_STAFF',
      orgType: OrgType.PROVIDER,
      businessCategory: 'RETAIL',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject ORG_STAFF with businessCategory RETAIL from PROVIDER endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.PROVIDER]);
    const context = createMockContext({
      role: 'ORG_STAFF',
      orgType: OrgType.PROVIDER,
      businessCategory: 'RETAIL',
    });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should reject standard PROVIDER ORG_STAFF from RETAIL endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.RETAIL]);
    const context = createMockContext({
      role: 'ORG_STAFF',
      orgType: OrgType.PROVIDER,
      businessCategory: null,
    });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should allow restored Accommodation Provider (PROVIDER + RENTALS) to access PROVIDER endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.PROVIDER]);
    const context = createMockContext({
      role: 'ORG_STAFF',
      orgType: OrgType.PROVIDER,
      businessCategory: 'RENTALS',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject restored Accommodation Provider (PROVIDER + RENTALS) from RETAIL endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrgType.RETAIL]);
    const context = createMockContext({
      role: 'ORG_STAFF',
      orgType: OrgType.PROVIDER,
      businessCategory: 'RENTALS',
    });
    expect(guard.canActivate(context)).toBe(false);
  });
});
