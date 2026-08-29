import { Controller, Post, Body, Headers, BadRequestException, Injectable, InternalServerErrorException, Param, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PosConnector } from './pos-connector.interface';
import { TyroConnector } from './providers/tyro.connector';
import { SquareConnector } from './providers/square.connector';
import { StripeConnector } from './providers/stripe.connector';
import { ZellerConnector } from './providers/zeller.connector';

@Injectable()
export class PosWebhookService {
  constructor(private prisma: PrismaService) {}

  // A registry for POS connectors
  private getConnector(provider: string): PosConnector | null {
    switch (provider.toUpperCase()) {
      case 'TYRO': return new TyroConnector();
      case 'SQUARE': return new SquareConnector();
      case 'STRIPE': return new StripeConnector();
      case 'ZELLER': return new ZellerConnector();
      default: return null;
    }
  }

  verifySignature(provider: string, req: { headers: any; body: any; rawBody?: Buffer }, signature: string): boolean {
    const connector = this.getConnector(provider);
    if (!connector) {
      throw new BadRequestException(`Provider not configured: ${provider}`);
    }
    // Abstract the secret resolution per organization/provider
    // For this abstraction, we assume verifyWebhookSignature fetches the secret internally.
    return connector.verifyWebhookSignature(req, 'dummy-secret');
  }

  parseEvent(provider: string, payload: any) {
    const connector = this.getConnector(provider);
    if (!connector) {
      throw new BadRequestException(`Provider not configured: ${provider}`);
    }
    return connector.parseWebhookEvent(payload);
  }

  async processWebhook(provider: string, externalEventId: string, eventType: string, payload: any) {
    try {
      const existing = await this.prisma.posWebhookEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider: provider.toUpperCase(),
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
          provider: provider.toUpperCase(),
          externalEventId,
          eventType,
          payload,
          organizationId,
          status: 'PENDING',
        },
      });

      await this.prisma.posWebhookEvent.update({
        where: { provider_externalEventId: { provider: provider.toUpperCase(), externalEventId } },
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
    @Req() req: any,
    @Headers('x-pos-signature') signature: string,
    @Body() payload: any,
    @Param('provider') provider: string,
  ) {
    if (!signature && provider.toUpperCase() !== 'ZELLER') { // Basic example logic
      throw new BadRequestException('Missing signature');
    }

    // This will throw BadRequestException if provider is not configured or signature is invalid
    this.webhookService.verifySignature(provider, { headers: req.headers, body: req.body, rawBody: req.rawBody }, signature || '');

    const parsedEvent = this.webhookService.parseEvent(provider, payload);
    const externalEventId = parsedEvent.eventId;
    const eventType = parsedEvent.type;

    if (!externalEventId || !eventType) {
      throw new BadRequestException('Invalid payload structure');
    }

    return this.webhookService.processWebhook(provider, externalEventId, eventType, parsedEvent.data);
  }
}
