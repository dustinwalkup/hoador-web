# Phase 3 Deployment Verification

Internal checklist for deploying Phase 3 (dispute resolution & chargebacks).

## Database Migration

Run the Phase 3 migration (`0028_lonely_lilandra.sql`) which:

- Adds `renter_no_show` and `owner_no_show` to the `dispute_reason_code` enum
- Adds nullable `deposit_captured_at` column to `rental_payment_lifecycle`

This migration is additive and backward-compatible — no data migration required.

## Stripe Webhook Events

Add the following event types to your Stripe webhook endpoint (Dashboard → Developers → Webhooks → select endpoint → "Update details"):

| Event type               | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `charge.dispute.created` | Link Stripe chargeback to internal dispute (or auto-create one), freeze owner payout, alert ops |
| `charge.dispute.updated` | Log chargeback status changes for audit trail                                                   |
| `charge.dispute.closed`  | Record chargeback outcome (won/lost), alert ops                                                 |

These are in addition to the Phase 1 and Phase 2 event types (see `specs/payments/phase2/5-deployment-verification.md`).

**How to add events:** Webhooks → [your endpoint] → "Update details" → "Select events" → add each event above.

## Environment Variables

- **No new environment variables** are required for Phase 3.
- **Existing variables** (must be set in all Vercel environments):
  - `OPS_ALERT_EMAIL` — receives critical dispute/chargeback alerts.
  - `CRON_SECRET` — used by cron endpoints; must match Vercel Cron configuration.
  - `STRIPE_WEBHOOK_SECRET` — used for webhook signature verification.

## Pre-deploy verification checklist

- [ ] Stripe Dashboard → Webhooks → [endpoint] → **Select events** includes:
  - `charge.dispute.created`
  - `charge.dispute.updated`
  - `charge.dispute.closed`
- [ ] Env vars set in target environment: `OPS_ALERT_EMAIL`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`
- [ ] Phase 3 migration `0028_lonely_lilandra.sql` has been run

---

_Last updated: March 15, 2026 | Internal use only_
