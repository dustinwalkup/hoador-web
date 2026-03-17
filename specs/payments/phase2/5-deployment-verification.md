# Phase 2 Deployment Verification

Internal checklist for deploying Phase 2 (cancellation policies, refunds, no-show).

## Stripe Webhook Events

Configure your Stripe webhook endpoint (Dashboard → Developers → Webhooks → select endpoint → "Update details") to send these event types to `POST /api/stripe/webhooks`:

| Event type                      | Purpose                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `account.updated`               | Sync Connect account status (charges_enabled, payouts_enabled) to user onboarding      |
| `account.closed`                | Mark user's Connect onboarding as disabled when account is closed                      |
| `payment_intent.succeeded`      | Update payment record to `succeeded`, set `paidAt`                                     |
| `payment_intent.payment_failed` | Update payment to `failed`, notify renter to update payment method                     |
| `payment_intent.canceled`       | For deposit-hold PaymentIntents: set `depositHoldStatus` to `expired`, alert ops       |
| `transfer.reversed`             | Set `ownerTransferStatus` to `failed`, alert ops when transfer is reversed/clawed back |
| `charge.refunded`               | Update payment to `refunded`, set `refundedAt` and `refundAmount` (idempotent)         |

**How to add events:** Webhooks → [your endpoint] → "Update details" → "Select events" → add each event above (or "Select all events" and rely on the app to ignore unhandled types; only the events above are processed).

## Environment Variables

- **No new environment variables** are required for Phase 2.
- **Existing variables** (must be set in all Vercel environments):
  - `OPS_ALERT_EMAIL` — receives critical payment/cancellation failure alerts.
  - `CRON_SECRET` — used by cron endpoints (`schedule-deposit-holds`, `process-payouts`, `monitor-deposit-expiry`); must match Vercel Cron configuration.

Both are already documented in `.env.example`.

---

_Last updated: March 12, 2026 | Internal use only_
