import {
  Controller,
  Post,
  Body,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from "@nestjs/common";
import * as crypto from "crypto";
import { PosWebhookService } from "./pos.controller";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

/**
 * SANDBOX-ONLY: POS Webhook Simulator
 *
 * This controller is ONLY active when NODE_ENV !== "production".
 * It generates valid provider-style HMAC signatures using test-only secrets,
 * then calls the real PosWebhookService.processWebhook — exercising the full
 * real verification path end-to-end.
 *
 * TEST-ONLY SECRETS (configured via env in test/staging):
 *   STRIPE_WEBHOOK_SECRET          defaults to "whsec_stripe_test"
 *   SQUARE_WEBHOOK_SIGNATURE_KEY   defaults to "sq_sig_test"
 *
 * Production webhook verification is NEVER weakened by this file.
 * In production NODE_ENV, any call returns 403.
 */
@Controller("retail/pos/sandbox")
@UseGuards(JwtAuthGuard)
export class PosSandboxController {
  constructor(private readonly webhookService: PosWebhookService) {}

  @Post("simulate")
  async simulateWebhook(
    @Body()
    body: {
      provider: string;
      transactionId: string;
      success: boolean;
    }
  ) {
    // Hard block in production — fail closed
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException(
        "Sandbox simulator is not available in production"
      );
    }

    const { provider, transactionId, success } = body;
    if (!provider || transactionId === undefined || success === undefined) {
      throw new BadRequestException(
        "provider, transactionId, and success are required"
      );
    }

    const providerUpper = provider.toUpperCase();
    let parsedEvent: { eventId: string; type: string; data: any };

    if (providerUpper === "STRIPE") {
      /**
       * Stripe signature: t=<ts>,v1=<HMAC-SHA256("<ts>.<body>", secret)>
       * Uses STRIPE_WEBHOOK_SECRET || "whsec_stripe_test" (TEST-ONLY default)
       */
      const secret =
        process.env.STRIPE_WEBHOOK_SECRET || "whsec_stripe_test";
      const eventId = `evt_sandbox_${Date.now()}`;
      const eventType = success
        ? "payment_intent.succeeded"
        : "payment_intent.payment_failed";
      const payload = {
        id: eventId,
        type: eventType,
        data: { object: { id: transactionId } },
      };
      const rawBody = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000);
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
      const stripeHeader = `t=${timestamp},v1=${hmac}`;

      const syntheticReq = {
        headers: { "stripe-signature": stripeHeader },
        body: payload,
        rawBody: Buffer.from(rawBody, "utf8"),
      };

      // Exercises the real StripeConnector.verifyWebhookSignature
      this.webhookService.verifySignature(provider, syntheticReq, stripeHeader);
      parsedEvent = this.webhookService.parseEvent(provider, payload);
    } else if (providerUpper === "SQUARE") {
      /**
       * Square signature: HMAC-SHA256(webhookUrl + rawBody, secret), base64
       * Uses SQUARE_WEBHOOK_SIGNATURE_KEY || "sq_sig_test" (TEST-ONLY default)
       */
      const secret =
        process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "sq_sig_test";
      const eventId = `evt_sandbox_${Date.now()}`;
      const status = success ? "COMPLETED" : "FAILED";
      const payload = {
        event_id: eventId,
        type: "payment.created",
        data: { object: { payment: { id: transactionId, status } } },
      };
      const rawBody = JSON.stringify(payload);

      // Sign against the connector expected webhook URL
      const apiBase = process.env.API_BASE_URL || "http://localhost:3001";
      const apiBaseUrl = new URL(apiBase);
      const webhookUrl = `${apiBaseUrl.protocol}//${apiBaseUrl.host}/api/v1/retail/pos/webhooks/square`;
      const sig = crypto
        .createHmac("sha256", secret)
        .update(webhookUrl + rawBody)
        .digest("base64");

      const syntheticReq = {
        headers: {
          "x-square-hmacsha256-signature": sig,
          host: apiBaseUrl.host,
          "x-forwarded-proto": apiBaseUrl.protocol.replace(":", ""),
        },
        body: payload,
        rawBody: Buffer.from(rawBody, "utf8"),
      };

      // Exercises the real SquareConnector.verifyWebhookSignature
      this.webhookService.verifySignature(provider, syntheticReq, sig);
      parsedEvent = this.webhookService.parseEvent(provider, payload);
    } else if (providerUpper === "TYRO") {
      /**
       * Tyro: documented stub, no cryptographic verification.
       * Event forwarded directly to processWebhook.
       */
      const eventId = `evt_sandbox_tyro_${Date.now()}`;
      const eventType = success
        ? "transaction_completed"
        : "transaction_failed";
      const payload = { id: eventId, eventType, transactionId };
      parsedEvent = this.webhookService.parseEvent(provider, payload);
    } else {
      throw new BadRequestException(
        `Unsupported sandbox provider: ${provider}`
      );
    }

    const { eventId, type } = parsedEvent;
    if (!eventId || !type) {
      throw new BadRequestException(
        "Simulator produced invalid event structure"
      );
    }

    return this.webhookService.processWebhook(
      provider,
      eventId,
      type,
      parsedEvent.data
    );
  }
}
