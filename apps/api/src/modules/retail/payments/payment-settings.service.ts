import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripePaymentGateway } from './gateways/stripe-payment.gateway';

@Injectable()
export class PaymentSettingsService {
  constructor(
    private prisma: PrismaService,
    private stripeGateway: StripePaymentGateway,
  ) {}

  async getSettings(organizationId: string) {
    const settings = await this.prisma.organizationPaymentSettings.findUnique({
      where: { organizationId },
    });

    const isStripeConfigured = this.stripeGateway.isConfigured();

    if (!settings) {
      return {
        onlinePaymentsEnabled: false,
        stripeConfigured: isStripeConfigured,
        gateway: 'STRIPE',
      };
    }

    return {
      onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
      stripeConfigured: isStripeConfigured,
      gateway: 'STRIPE',
    };
  }

  async updateSettings(organizationId: string, enabled: boolean) {
    const isStripeConfigured = this.stripeGateway.isConfigured();

    if (enabled && !isStripeConfigured) {
      throw new BadRequestException(
        'Cannot enable online payments when Stripe is not configured.',
      );
    }

    const settings = await this.prisma.organizationPaymentSettings.upsert({
      where: { organizationId },
      update: {
        onlinePaymentsEnabled: enabled,
        stripeConfigured: isStripeConfigured,
      },
      create: {
        organizationId,
        onlinePaymentsEnabled: enabled,
        stripeConfigured: isStripeConfigured,
      },
    });

    return settings;
  }
}
