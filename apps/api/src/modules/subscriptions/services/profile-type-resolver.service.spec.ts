import { BusinessCategory, OrgType, SubscriptionProfileType } from '@prisma/client';
import { ProfileTypeResolverService } from './profile-type-resolver.service';

describe('ProfileTypeResolverService', () => {
  let service: ProfileTypeResolverService;

  beforeEach(() => {
    service = new ProfileTypeResolverService();
  });

  it('resolves PROVIDER to ACCOMMODATION regardless of default businessCategory RETAIL', () => {
    expect(
      service.resolve({
        type: OrgType.PROVIDER,
        businessCategory: BusinessCategory.RETAIL,
      }),
    ).toEqual({
      eligible: true,
      profileType: SubscriptionProfileType.ACCOMMODATION,
    });
  });

  it('resolves AGENCY to ACCOMMODATION regardless of businessCategory', () => {
    expect(
      service.resolve({
        type: OrgType.AGENCY,
        businessCategory: BusinessCategory.RETAIL,
      }),
    ).toEqual({
      eligible: true,
      profileType: SubscriptionProfileType.ACCOMMODATION,
    });
  });

  it.each([
    [BusinessCategory.RETAIL, SubscriptionProfileType.RETAIL],
    [BusinessCategory.FOOD, SubscriptionProfileType.FOOD],
    [BusinessCategory.MECHANICS, SubscriptionProfileType.MECHANICS],
    [BusinessCategory.SERVICES, SubscriptionProfileType.SERVICES],
    [BusinessCategory.RENTALS, SubscriptionProfileType.RENTALS],
  ])('resolves RETAIL org with businessCategory %s to %s', (category, expected) => {
    expect(
      service.resolve({
        type: OrgType.RETAIL,
        businessCategory: category,
      }),
    ).toEqual({
      eligible: true,
      profileType: expected,
    });
  });

  it('excludes UNIVERSITY organizations', () => {
    expect(
      service.resolve({
        type: OrgType.UNIVERSITY,
        businessCategory: BusinessCategory.RETAIL,
      }),
    ).toEqual({
      eligible: false,
      reason: 'EXCLUDED_UNIVERSITY',
    });
  });

  it('rejects RETAIL organization with missing businessCategory safely', () => {
    expect(
      service.resolve({
        type: OrgType.RETAIL,
        businessCategory: null,
      }),
    ).toEqual({
      eligible: false,
      reason: 'MISSING_BUSINESS_CATEGORY',
    });
  });
});
