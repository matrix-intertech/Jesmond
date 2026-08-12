import { Controller, Post, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagService } from '../admin/feature-flag.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout')
  async createCheckout() {
    const isEnabled = await this.featureFlagService.isEnabled('PAYMENTS_BOOKING');
    
    if (!isEnabled) {
      throw new ForbiddenException('Payments and booking are currently disabled.');
    }

    return { success: true, message: 'Checkout session created' };
  }

  @Get('status')
  async getPaymentStatus() {
    const isEnabled = await this.featureFlagService.isEnabled('PAYMENTS_BOOKING');
    return { enabled: isEnabled };
  }
}
