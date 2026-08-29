# POS Provider Integration Contract

## 1. Tyro
- **Supported Operations**: Terminal Pairing, Payment Initiation, Refunds, Webhook Notifications, Terminal Status
- **Authentication**: Merchant Authorization (OAuth or API Keys), Webhook HMAC-SHA256
- **Terminal Pairing**: Flow initiated from POS, confirmed on terminal.
- **Payment Initiation**: Supported via Tyro Connect API.
- **Webhooks**: Supported. Event types include `payment.success`, `payment.failed`, `terminal.status`.
- **Refunds**: Supported via provider transaction ID.
- **Device Control**: Cloud API, Browser fallback (requires native agent).
- **Sandbox**: Official Tyro Sandbox available for test credentials and mocked terminals.
- **Known Limitations**: Requires persistent connectivity for full webhook reliability.

## 2. Square Terminal
- **Supported Operations**: Terminal Pairing, Checkout Request, Payment Status, Cancellation, Refunds, Webhooks
- **Authentication**: OAuth (Square Authorization), Webhook Signature validation
- **Terminal Pairing**: Device Code generation on POS -> Login on Square Terminal.
- **Payment Initiation**: Terminal Checkout API.
- **Webhooks**: Supported (`terminal.checkout.created`, `terminal.checkout.updated`).
- **Refunds**: Supported via Payments API.
- **Device Control**: Managed completely by Square API. POS cannot control the printer on Square Terminal.
- **Sandbox**: Square Sandbox environment is fully supported.
- **Known Limitations**: POS cannot inject custom receipt formats to the Square Terminal printer.

## 3. Stripe Terminal
- **Supported Operations**: Connection Token Generation, Payment Intents, Webhooks
- **Authentication**: Stripe API Keys, Webhook Secret
- **Terminal Pairing**: SDK generates connection token, pairs reader via network or bluetooth.
- **Payment Initiation**: PaymentIntent API with `capture_method: manual` or `automatic`.
- **Webhooks**: Supported (`payment_intent.succeeded`, `payment_intent.payment_failed`).
- **Refunds**: Supported via Refunds API.
- **Device Control**: Supported via Stripe Terminal SDKs (JS, iOS, Android).
- **Sandbox**: Simulated reader in Stripe Test Mode.
- **Known Limitations**: Browser-based POS requires local network connectivity to the reader unless using cloud-based readers (BBPOS WisePOS E).

## 4. Zeller
- **Supported Operations**: NONE currently verified.
- **Authentication**: Requires Partner API Access.
- **Terminal Pairing**: Requires Partner API Access.
- **Payment Initiation**: Requires Partner API Access.
- **Webhooks**: Requires Partner API Access.
- **Refunds**: Requires Partner API Access.
- **Device Control**: Unknown.
- **Sandbox**: Requires partner agreement to access.
- **Known Limitations**: **REQUIRES PARTNER ACCESS**. Standard merchants cannot use external POS integrations with Zeller without a formal partnership and certification process. This integration is stubbed and disabled by default.
