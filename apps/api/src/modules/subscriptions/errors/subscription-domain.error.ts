import { HttpException, HttpStatus } from '@nestjs/common';

export enum SubscriptionErrorCode {
  SUBSCRIPTIONS_DISABLED = 'SUBSCRIPTIONS_DISABLED',
  NO_ACTIVE_SUBSCRIPTION = 'NO_ACTIVE_SUBSCRIPTION',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_SUSPENDED = 'SUBSCRIPTION_SUSPENDED',
  FEATURE_NOT_INCLUDED = 'FEATURE_NOT_INCLUDED',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  PROFILE_MISMATCH = 'PROFILE_MISMATCH',
  INVALID_SUBSCRIPTION_TRANSITION = 'INVALID_SUBSCRIPTION_TRANSITION',
  INVALID_ENTITLEMENT_OVERRIDE = 'INVALID_ENTITLEMENT_OVERRIDE',
  CROSS_ORGANIZATION_ACCESS_DENIED = 'CROSS_ORGANIZATION_ACCESS_DENIED',
}

export class SubscriptionDomainException extends HttpException {
  readonly code: SubscriptionErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: SubscriptionErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        ...(details ? { details } : {}),
      },
      status,
    );
    this.code = code;
    this.details = details;
  }
}
