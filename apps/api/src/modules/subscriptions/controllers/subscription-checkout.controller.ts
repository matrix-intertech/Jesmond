import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  SubscriptionDomainException,
  SubscriptionErrorCode,
} from '../errors/subscription-domain.error';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

export class CreateSubscriptionCheckoutDto {
  @IsUUID()
  planId!: string;

  @IsUUID()
  planPriceId!: string;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionCheckoutController {
  constructor(private readonly billingService: SubscriptionBillingService) {}

  private assertBusinessOrg(req: any): string {
    const user = req.user;
    if (!user || user.role !== UserRole.ORG_STAFF || !user.organizationId) {
      throw new SubscriptionDomainException(
        SubscriptionErrorCode.PROFILE_MISMATCH,
        'Active business organization context is required',
        HttpStatus.FORBIDDEN,
      );
    }
    return user.organizationId;
  }

  @Post('checkout')
  async createCheckout(
    @Request() req: any,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    const organizationId = this.assertBusinessOrg(req);
    return this.billingService.createCheckoutSession({
      organizationId,
      userId: req.user.id,
      userEmail: req.user.email,
      planId: dto.planId,
      planPriceId: dto.planPriceId,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Get('billing-history')
  async getBillingHistory(@Request() req: any) {
    const organizationId = this.assertBusinessOrg(req);
    return this.billingService.listOrganizationBillingHistory(organizationId);
  }
}
