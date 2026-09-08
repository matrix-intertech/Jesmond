import {
  Controller,
  Post,
  Body,
  BadRequestException,
  ForbiddenException,
  UseGuards,
  NotImplementedException,
} from "@nestjs/common";
import { PosWebhookService } from "./pos.controller";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

/**
 * SANDBOX-ONLY: POS Webhook Simulator
 *
 * This controller is ONLY accessible when ALL of these conditions are met:
 *   1. NODE_ENV is NOT "production"
 *   2. POS_SANDBOX_ENABLED env var is explicitly set to "true"
 *
 * Every provider path calls verifySignature (which delegates to the real
 * connector). Since all connectors now throw NotImplementedException in
 * verifyWebhookSignature, no sandbox simulation can currently reach
 * processWebhook and mutate payment/order state.
 *
 * When a real provider integration is implemented, the connector's
 * verifyWebhookSignature will start validating real signatures, and the
 * sandbox will need to be updated with real test-mode secrets to
 * generate valid signatures.
 *
 * Production webhook verification is NEVER weakened by this file.
 */
@Controller("retail/pos/sandbox")
@UseGuards(JwtAuthGuard)
export class PosSandboxController {
  constructor(private readonly webhookService: PosWebhookService) {}

  /**
   * Validates that the sandbox environment is properly configured.
   * Throws ForbiddenException if any safety check fails.
   */
  private assertSandboxAllowed(): void {
    // Layer 1: Hard block in production — fail closed
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException(
        "Sandbox simulator is not available in production"
      );
    }

    // Layer 2: Require explicit opt-in via POS_SANDBOX_ENABLED
    if (process.env.POS_SANDBOX_ENABLED !== "true") {
      throw new ForbiddenException(
        "POS sandbox is not enabled. Set POS_SANDBOX_ENABLED=true in a non-production environment to use this endpoint."
      );
    }
  }

  @Post("simulate")
  async simulateWebhook(
    @Body()
    body: {
      provider: string;
      transactionId: string;
      success: boolean;
    }
  ) {
    this.assertSandboxAllowed();

    const { provider, transactionId, success } = body;
    if (!provider || transactionId === undefined || success === undefined) {
      throw new BadRequestException(
        "provider, transactionId, and success are required"
      );
    }

    const providerUpper = provider.toUpperCase();

    // All providers must go through verifySignature → parseEvent → processWebhook.
    // Since all connectors currently throw NotImplementedException in
    // verifyWebhookSignature, this endpoint will return 501 for every provider
    // until a real integration is implemented with proper test-mode secrets.
    //
    // This is the correct, secure behavior — sandbox simulation cannot
    // generate fake PAID/COMPLETED states.

    if (
      providerUpper !== "STRIPE" &&
      providerUpper !== "SQUARE" &&
      providerUpper !== "TYRO" &&
      providerUpper !== "ZELLER"
    ) {
      throw new BadRequestException(
        `Unsupported sandbox provider: ${provider}`
      );
    }

    // Construct a minimal synthetic event for the provider
    const eventId = `evt_sandbox_${providerUpper.toLowerCase()}_${Date.now()}`;
    const eventType = this.getEventType(providerUpper, success);
    const payload = this.buildPayload(
      providerUpper,
      eventId,
      eventType,
      transactionId,
      success
    );

    // ALL providers go through signature verification.
    // This will throw NotImplementedException for all providers whose
    // connectors have not been implemented with real SDK integration.
    const syntheticReq = {
      headers: {},
      body: payload,
      rawBody: Buffer.from(JSON.stringify(payload), "utf8"),
    };

    // This call will throw NotImplementedException for all current connectors.
    // When a real integration is added, this will need real test-mode secrets
    // and proper HMAC signature generation.
    this.webhookService.verifySignature(provider, syntheticReq, "sandbox-sig");

    // If verifySignature somehow passes (future real integration),
    // continue with the normal flow
    const parsedEvent = this.webhookService.parseEvent(provider, payload);

    if (!parsedEvent.eventId || !parsedEvent.type) {
      throw new BadRequestException(
        "Simulator produced invalid event structure"
      );
    }

    return this.webhookService.processWebhook(
      provider,
      parsedEvent.eventId,
      parsedEvent.type,
      parsedEvent.data
    );
  }

  private getEventType(provider: string, success: boolean): string {
    switch (provider) {
      case "STRIPE":
        return success
          ? "payment_intent.succeeded"
          : "payment_intent.payment_failed";
      case "SQUARE":
        return "payment.created";
      case "TYRO":
        return success ? "transaction_completed" : "transaction_failed";
      case "ZELLER":
        return success ? "payment.success" : "payment.failed";
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  private buildPayload(
    provider: string,
    eventId: string,
    eventType: string,
    transactionId: string,
    success: boolean
  ): any {
    switch (provider) {
      case "STRIPE":
        return {
          id: eventId,
          type: eventType,
          data: { object: { id: transactionId } },
        };
      case "SQUARE":
        return {
          event_id: eventId,
          type: eventType,
          data: {
            object: {
              payment: {
                id: transactionId,
                status: success ? "COMPLETED" : "FAILED",
              },
            },
          },
        };
      case "TYRO":
        return { id: eventId, eventType, transactionId };
      case "ZELLER":
        return { id: eventId, eventType, transactionId };
      default:
        return { id: eventId, eventType, transactionId };
    }
  }
}
