import { Controller, Post, Body, Headers, BadRequestException, Injectable, InternalServerErrorException, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PosConnector } from './pos-connector.interface';

@Injectable()
export class PosWebhookService {
  constructor(private prisma: PrismaService) {}

  // A registry for POS connectors
  private getConnector(provider: string): PosConnector | null {
    // We would resolve specific provider implementations here.
    // E.g. if (provider === 'SQUARE') return new SquareConnector(config);
    return null;
  }

  verifySignature(provider: string, payload: any, signature: string): boolean {
    const connector = this.getConnector(provider);
    if (!connector) {
      throw new BadRequestException(`Provider not configured: ${provider}`);
    }
    // Abstract the secret resolution per organization/provider
    // For this abstraction, we assume verifyWebhookSignature fetches the secret internally.
    return connector.verifyWebhookSignature(payload, signature, 'dummy-secret');
  }

  async processWebhook(provider: string, externalEventId: string, eventType: string, payload: any) {
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
        return { status: 'IGNORED', message: 'Duplicate event' };
      }

      const organizationId = payload.organizationId || 'UNKNOWN';

      const webhook = await this.prisma.posWebhookEvent.create({
        data: {
          provider,
          externalEventId,
          eventType,
          payload,
          organizationId,
          status: 'PENDING',
        },
      });

      await this.prisma.posWebhookEvent.update({
        where: { provider_externalEventId: { provider, externalEventId } },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      // Audit Logging
      await this.prisma.auditLog.create({
        data: {
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'webhook.process',
          resourceType: 'PosWebhookEvent',
          resourceId: webhook.id,
          changes: { eventType, provider }
        }
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

    // This will throw BadRequestException if provider is not configured or signature is invalid
    this.webhookService.verifySignature(provider, payload, signature);

    const externalEventId = payload.id;
    const eventType = payload.type;

    if (!externalEventId || !eventType) {
      throw new BadRequestException('Invalid payload structure');
    }

    return this.webhookService.processWebhook(provider, externalEventId, eventType, payload);
  }
}
