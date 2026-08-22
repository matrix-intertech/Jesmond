import { Controller, Post, Body, Headers, BadRequestException, Injectable, InternalServerErrorException, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PosWebhookService {
  constructor(private prisma: PrismaService) {}

  async processWebhook(provider: string, externalEventId: string, eventType: string, payload: any) {
    // Phase 11: Idempotency check using externalEventId
    try {
      const existing = await this.prisma.posWebhookEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider,
            externalEventId,
          },
        },
      });

      if (existing) {
        // Webhook was already processed or is pending
        return { status: 'IGNORED', message: 'Duplicate event' };
      }

      // We need organizationId from context, assuming payload contains location_id mapping
      const organizationId = payload.organizationId || 'UNKNOWN';

      await this.prisma.posWebhookEvent.create({
        data: {
          provider,
          externalEventId,
          eventType,
          payload,
          organizationId,
          status: 'PENDING',
        },
      });

      // Dispatch to specific handlers based on eventType (e.g., INVENTORY_UPDATED, ORDER_CREATED)
      // This allows background workers to process it if we want, or we can process synchronously

      // Update status
      await this.prisma.posWebhookEvent.update({
        where: { provider_externalEventId: { provider, externalEventId } },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      return { status: 'SUCCESS' };
    } catch (e) {
      throw new InternalServerErrorException('Failed to process webhook');
    }
  }
}

@Controller('retail/pos/webhooks')
export class PosWebhookController {
  constructor(private webhookService: PosWebhookService) {}

  @Post(':provider')
  async handleWebhook(
    @Headers('x-pos-signature') signature: string,
    @Body() payload: any,
    @Param('provider') provider: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing signature');
    }

    // Abstract verify signature using PosConnector strategy

    const externalEventId = payload.id;
    const eventType = payload.type;

    if (!externalEventId || !eventType) {
      throw new BadRequestException('Invalid payload structure');
    }

    return this.webhookService.processWebhook(provider, externalEventId, eventType, payload);
  }
}
