Phase 1 — What You Can Test Now
Full payment lifecycle (happy path):

Renter submits rental request — creates pending request with payment method
Owner approves — charges renter (platform-hold, no transfer_data), creates rental_payment_lifecycle record
Deposit scheduling — if start > 48hrs, cron places auth hold when within 48hrs; if ≤ 48hrs, hold placed immediately at approval
Owner confirms return — POST /api/rentals/[id]/confirm-return sets returnConfirmedAt, status → completed
24-hour dispute window passes — payout cron finds eligible rentals
Payout cron — releases deposit hold (paymentIntents.cancel), creates owner transfer (transfers.create with source_transaction), deducts 20% platform fee
Webhooks — payment_intent.succeeded/failed/canceled, transfer.failed, account.updated/closed
Error/recovery paths:

Deposit hold fails → renter/owner notified → renter updates payment method → status resets to scheduled → cron retries
Deposit hold expires (>7 days) → expiry monitoring cron detects → ops alerted
Owner transfer fails → ownerTransferStatus: 'failed' → ops alerted (no auto-retry)
Concurrent cron runs → atomic claimForProcessing prevents double-processing
All Stripe calls have deterministic idempotency keys
Ops alerting: structured logging + email to OPS_ALERT_EMAIL for all critical failures

Future Phases — Not Implemented Yet
Phase 2 (Cancellations):

Renter cancels before/after owner confirms — no automated refund logic
Owner cancels after confirming — no automated refund
Tiered cancellation policies — not defined
No-show handling — not implemented
Currently handled manually via Stripe Dashboard
Phase 3 (Disputes & Chargebacks):

Damage claim filing/resolution workflow — the 24-hour window and frozen status exist, but there's no UI or API for filing disputes
Deposit capture for damage — captureSecurityDeposit() exists but no automated trigger
Mediation outcomes — not implemented
Chargeback evidence collection — not implemented
Phase 4 (Operational Tooling):

Admin dashboard for payment states
Stale processing status alerts (cron crash recovery)
Manual override tools
Payout scheduling preferences
Other known limitations:

Auth holds expire after 7 days (no extended authorizations yet)
Single-party return confirmation (owner only, no renter confirmation)
No auto-completion if owner never confirms return
No automated cancellation of deposit holds when a rental is cancelled pre-pickup (ops manual)
