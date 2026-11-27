import { Injectable } from '@nestjs/common';
import {
  BusinessCategory,
  OrgType,
  SubscriptionProfileType,
} from '@prisma/client';

export interface ProfileResolvableOrganization {
  id?: string;
  type: OrgType;
  businessCategory?: BusinessCategory | null;
}

export type ProfileResolutionResult =
  | {
      eligible: true;
      profileType: SubscriptionProfileType;
    }
  | {
      eligible: false;
      reason:
        | 'EXCLUDED_UNIVERSITY'
        | 'UNSUPPORTED_ORG_TYPE'
        | 'MISSING_BUSINESS_CATEGORY'
        | 'UNSUPPORTED_BUSINESS_CATEGORY';
    };

const BUSINESS_CATEGORY_TO_PROFILE: Record<
  BusinessCategory,
  SubscriptionProfileType
> = {
  [BusinessCategory.RETAIL]: SubscriptionProfileType.RETAIL,
  [BusinessCategory.FOOD]: SubscriptionProfileType.FOOD,
  [BusinessCategory.MECHANICS]: SubscriptionProfileType.MECHANICS,
  [BusinessCategory.SERVICES]: SubscriptionProfileType.SERVICES,
  [BusinessCategory.RENTALS]: SubscriptionProfileType.RENTALS,
};

@Injectable()
export class ProfileTypeResolverService {
  /**
   * Resolves an organization's canonical SubscriptionProfileType.
   * PROVIDER and AGENCY always map to ACCOMMODATION regardless of the
   * default businessCategory = RETAIL column on Organization.
   */
  resolve(org: ProfileResolvableOrganization): ProfileResolutionResult {
    if (org.type === OrgType.UNIVERSITY) {
      return { eligible: false, reason: 'EXCLUDED_UNIVERSITY' };
    }

    if (org.type === OrgType.PROVIDER || org.type === OrgType.AGENCY) {
      return {
        eligible: true,
        profileType: SubscriptionProfileType.ACCOMMODATION,
      };
    }

    if (org.type === OrgType.RETAIL) {
      if (!org.businessCategory) {
        return { eligible: false, reason: 'MISSING_BUSINESS_CATEGORY' };
      }

      const mapped = BUSINESS_CATEGORY_TO_PROFILE[org.businessCategory];
      if (!mapped) {
        return { eligible: false, reason: 'UNSUPPORTED_BUSINESS_CATEGORY' };
      }

      return { eligible: true, profileType: mapped };
    }

    return { eligible: false, reason: 'UNSUPPORTED_ORG_TYPE' };
  }
}
