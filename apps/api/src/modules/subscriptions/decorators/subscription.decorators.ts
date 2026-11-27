import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_FEATURE_KEY = 'subscription_feature';
export const SKIP_SUBSCRIPTION_CHECK_KEY = 'skip_subscription_check';

export interface SubscriptionFeatureMetadata {
  featureKey: string;
  checkUsage?: boolean;
}

export const RequireSubscriptionFeature = (
  featureKey: string,
  options?: { checkUsage?: boolean },
) =>
  SetMetadata(SUBSCRIPTION_FEATURE_KEY, {
    featureKey,
    checkUsage: options?.checkUsage ?? false,
  } satisfies SubscriptionFeatureMetadata);

export const SkipSubscriptionCheck = () =>
  SetMetadata(SKIP_SUBSCRIPTION_CHECK_KEY, true);
