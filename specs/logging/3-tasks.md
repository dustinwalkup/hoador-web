# Production Logging - Implementation Tasks

## Overview

This document breaks down the Production Logging feature into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements. Implementation follows the design in [specs/logging/2-design.md](specs/logging/2-design.md).

## Task List

### Phase 1: Dependencies and Central Logger

- [ ] 1. Add Pino dependency for structured JSON logging
  - Add `pino` to `package.json` dependencies
  - _Requirements: LOG-001, LOG-002, LOG-005_

- [ ] 2. Create central logging utility and request context
  - [ ] 2.1 Create `src/lib/logger/index.ts` (or `src/lib/logging/`) with a single logger instance that writes structured JSON to stdout
  - Configure Pino with levels: trace, debug, info, warn, error, fatal; default level from `LOG_LEVEL` env (default `info` in production per LOG-006)
  - Expose `getLogger(context?: { requestId?: string; userId?: string | null })` returning a child logger that includes requestId and userId in every log line when provided
  - Ensure no sensitive keys (token, password, card, etc.) are logged; document or implement a redact helper for metadata (LOG-PRIV-001, LOG-PRIV-002, LOG-PRIV-003, LOG-PRIV-004)
  - _Requirements: LOG-001, LOG-002, LOG-003, LOG-004, LOG-005, LOG-006, LOG-PRIV-\*_
  - [ ] 2.2 Create or extend request context in `src/lib/logger/request-context.ts` (or `src/lib/utils/request-context.ts`) to support storing requestId and userId for the duration of a request
  - Use AsyncLocalStorage to store `{ requestId, userId, ipAddress?, userAgent? }` so that getLogger() can read from it when no explicit context is passed
  - Provide `runWithRequestContext(context, fn)` and a way to generate requestId (e.g. crypto.randomUUID() or nanoid)
  - _Requirements: LOG-003, LOG-004, LOG-AUD-002, LOG-AUD-020_

- [ ] 3. Unit tests for logger and level filtering
  - Test that logger outputs valid JSON with level, message, timestamp, and optional requestId/userId
  - Test that when level is `info`, debug/trace messages are not emitted
  - Test that sensitive keys in metadata are redacted or omitted (if redact helper exists)
  - _Requirements: LOG-001, LOG-005, LOG-006, LOG-PRIV-\*_

### Phase 2: Audit Log Schema and DAL

- [ ] 4. Create audit_logs schema and register
  - Create `src/db/schemas/audit-logs.schema.ts` with table `audit_logs`: id (uuid, PK), entityType (varchar 64), entityId (varchar 255), action (varchar 128), userId (text, nullable, FK to user.id onDelete set null), metadata (jsonb), ipAddress (varchar 45), userAgent (text), createdAt (timestamp defaultNow)
  - Add indexes: (entityType, entityId), (userId, createdAt), (action, createdAt), (createdAt)
  - Register in `src/db/schemas/index.ts`; ensure Drizzle config includes it for migrations
  - _Requirements: LOG-AUD-001, LOG-AUD-002, LOG-RET-002, LOG-RET-003_

- [ ] 5. Generate and apply migration for audit_logs
  - Run `db:generate` to create migration; run `db:migrate` or `db:push` per project workflow
  - _Requirements: LOG-AUD-001_

- [ ] 6. Implement AuditLogDAL
  - Create `src/dal/audit-log.dal.ts` with `create(entry: NewAuditLogEntry): Promise<AuditLogRow>`
  - Entry type: entityType, entityId, action, userId (optional), metadata (optional), ipAddress (optional), userAgent (optional)
  - No update or delete methods; append-only (LOG-RET-003)
  - Use BaseDAL/db pattern consistent with existing DALs; export from `src/dal/index.ts` if applicable
  - _Requirements: LOG-AUD-001, LOG-AUD-002, LOG-RET-003_

- [ ] 7. Unit tests for AuditLogDAL
  - Test create inserts a row with correct columns; test that no update/delete API exists
  - Use test DB or in-memory pattern consistent with project (e.g. `src/dal/__tests__/audit-log.dal.test.ts`)
  - _Requirements: LOG-AUD-001, LOG-AUD-002_

### Phase 3: Request/Response Logging and Sentry Tags

- [ ] 8. Implement withRequestLogging wrapper
  - Create `withRequestLogging(handler, route: string)` (or equivalent) in `src/lib/api/with-request-logging.ts` or `src/lib/logger/`
  - On entry: generate or read requestId (e.g. from header `x-request-id`), set request context (requestId; optionally resolve userId, ip, userAgent from request), log info: request received (method, route, requestId, timestamp) — LOG-REQ-001
  - Invoke handler; on success log info: response sent (statusCode, durationMs) — LOG-REQ-002; if duration > SLOW_REQUEST_MS (1000) log warn performance event — LOG-REQ-003
  - On unhandled exception: log error-level entry, call Sentry.captureException with tags: requestId, userId, route, environment — LOG-REQ-004, LOG-OBS-001, LOG-OBS-002, LOG-OBS-010; then rethrow or return 500
  - Do not log request/response bodies
  - _Requirements: LOG-REQ-001, LOG-REQ-002, LOG-REQ-003, LOG-REQ-004, LOG-OBS-001, LOG-OBS-002, LOG-OBS-010_

- [ ] 9. Add requestId and route to Sentry in route-helpers
  - In `src/lib/api/route-helpers.ts` handleApiError (and captureNonCriticalError if used), ensure Sentry.captureException receives tags: requestId, userId, route, environment when available (e.g. from request context or passed in)
  - Verify release is set in sentry.server.config.ts from package version (LOG-OBS-003)
  - _Requirements: LOG-OBS-002, LOG-OBS-003, LOG-OBS-010_

- [ ] 10. Apply withRequestLogging to API routes
  - Apply the wrapper to all API route handlers that should be logged (e.g. wrap handler in each route file, or create a higher-order helper used by route handlers)
  - Ensure route pattern is passed (e.g. `/api/rentals`, `/api/rentals/[id]/approve`) for log and Sentry context
  - _Requirements: LOG-REQ-001, LOG-REQ-002, LOG-REQ-003, LOG-REQ-004_

- [ ] 11. Integration test for request logging and Sentry tags
  - Test that a wrapped route logs request and response with requestId; test that when handler throws, error is logged and Sentry is called with requestId, userId, route, environment tags
  - Test that when handler takes > 1000ms (e.g. with delay), a warning-level performance log is emitted
  - _Requirements: LOG-REQ-001, LOG-REQ-002, LOG-REQ-003, LOG-REQ-004, LOG-OBS-\*_

### Phase 4: Booking (Rental) Audit Events

- [ ] 12. Record rental_request.created audit event
  - In `src/app/api/rentals/route.ts` (or in RentalDAL.createRentalRequest after successful insert), call AuditLogDAL.create with entityType `rental_request`, entityId = rentalRequestId, action `rental_request.created`, userId from session, metadata minimal (e.g. listingId, startDate, endDate), ipAddress and userAgent from request
  - Pass request context (ip, userAgent) from route; use getClientIP and getUserAgent from request-context
  - _Requirements: LOG-AUD-010, LOG-AUD-020_

- [ ] 13. Record rental_request.cancelled / rental.cancelled audit event
  - Identify where rental request or rental cancellation is performed (e.g. cancel request API, decline, or rental cancel flow)
  - After successful cancel, call AuditLogDAL.create with entityType `rental_request` or `rental`, entityId, action `rental_request.cancelled` or `rental.cancelled`, userId, ipAddress, userAgent
  - _Requirements: LOG-AUD-011, LOG-AUD-020_

### Phase 5: Payment Audit Events

- [ ] 14. Record payment state transition audit events
  - Identify where payment is captured, refunded, or fails (e.g. approve route payment success/failure, refund API, Stripe webhook payment_intent.succeeded / charge.refunded etc.)
  - Call AuditLogDAL.create with entityType `payment`, entityId = paymentId or equivalent, action `payment.captured` / `payment.refunded` / `payment.failed`, userId nullable when system-initiated, metadata without full card or payment details (e.g. amount, currency, status only)
  - _Requirements: LOG-AUD-012, LOG-PRIV-003_

### Phase 6: Dispute Lifecycle Audit Events

- [ ] 15. Record dispute.opened audit event
  - In dispute creation path (e.g. `src/app/api/disputes/route.ts` or DisputeDAL after insert), call AuditLogDAL.create with entityType `dispute`, entityId = disputeId, action `dispute.opened`, userId, metadata minimal, ipAddress, userAgent
  - _Requirements: LOG-AUD-013_

- [ ] 16. Record dispute.escalated and dispute.resolved audit events
  - Where dispute state transitions to escalated or resolved (e.g. admin resolve API, state change logic), call AuditLogDAL.create with action `dispute.escalated` or `dispute.resolved`, entityId = disputeId, userId (admin), metadata as needed (e.g. previousStatus, newStatus, resolutionOutcome)
  - _Requirements: LOG-AUD-013_

### Phase 7: Admin Action Audit Events

- [ ] 17. Record admin action audit events
  - Identify where admin modifies user roles, permissions, or account status (e.g. admin user update API, suspend/ban, role change)
  - Call AuditLogDAL.create with entityType `user`, entityId = target userId, action `admin.role_change` / `admin.permission_change` / `admin.account_status_change`, userId = admin id, metadata as needed (e.g. targetUserId, previousRole, newRole)
  - _Requirements: LOG-AUD-014, LOG-SEC-002, LOG-SEC-003_

### Phase 8: Security Logging (Auth Failures and Threshold)

- [ ] 18. Log failed authentication security event
  - In auth routes or middleware where authentication fails (e.g. invalid credentials, invalid session), use the central logger to record a security event (e.g. info or warn, message `auth.failed`); do not log password or token
  - Optionally call AuditLogDAL.create with entityType `auth`, action `auth.failed`, userId null, metadata e.g. identifier used (no password)
  - _Requirements: LOG-SEC-001_

- [ ] 19. Log warning when repeated failed auth exceeds threshold
  - Implement a simple store (in-memory or short TTL) to count failed auth attempts per identifier (e.g. IP or email) in a time window; when count exceeds FAILED_AUTH_THRESHOLD (e.g. 5 in 15 minutes), log warning-level security event
  - Make threshold and window configurable via env (e.g. FAILED_AUTH_THRESHOLD, FAILED_AUTH_WINDOW_MS)
  - _Requirements: LOG-SEC-004_

### Phase 9: Stripe Webhook Logging

- [ ] 20. Log Stripe webhook receive and signature failure
  - In `src/app/api/stripe/webhooks/route.ts`: at start of POST, after parsing body and signature, log event ID and event type only (do not log body or full payload) — LOG-PAY-001, LOG-PAY-004
  - In the catch block for signature verification failure, log error-level security event before returning 400 — LOG-PAY-002
  - _Requirements: LOG-PAY-001, LOG-PAY-002, LOG-PAY-004_

- [ ] 21. Record webhook.processed audit event on success
  - After the webhook handler has successfully processed an event (before returning 200), call AuditLogDAL.create with entityType `webhook` or `payment`, entityId = Stripe event.id, action `webhook.processed`, userId null, metadata = { eventType } only
  - Do not persist full payload — LOG-PAY-004
  - _Requirements: LOG-PAY-003, LOG-PAY-004_

- [ ] 22. Integration test for Stripe webhook logging
  - Test that on successful webhook handling, one audit_logs row exists with entityId = event.id, action webhook.processed
  - Test that on signature verification failure, error-level log is emitted and no audit row is created for the payload
  - _Requirements: LOG-PAY-001, LOG-PAY-002, LOG-PAY-003, LOG-PAY-004_

### Phase 10: Integration Tests for Audit Events

- [ ] 23. Integration test for rental audit events
  - Create a rental request via API and assert one audit_logs row with entityType `rental_request`, action `rental_request.created`, correct entityId and userId
  - Cancel a rental request (or rental) and assert audit_logs row with action `rental_request.cancelled` or `rental.cancelled`
  - _Requirements: LOG-AUD-010, LOG-AUD-011_

- [ ] 24. Integration test for dispute and admin audit events (optional / as needed)
  - Create a dispute and assert audit_logs row dispute.opened; resolve (or escalate) and assert corresponding audit row
  - If admin role/status change endpoints exist, assert admin.\* audit row after change
  - _Requirements: LOG-AUD-013, LOG-AUD-014_

## Summary

- **Phase 1:** Pino dependency; central logger with levels and context; request context (AsyncLocalStorage); logger unit tests.
- **Phase 2:** audit_logs schema, migration, AuditLogDAL (create only), DAL unit tests.
- **Phase 3:** withRequestLogging wrapper; Sentry tags in route-helpers; apply wrapper to API routes; request-logging integration test.
- **Phase 4–7:** Audit integration points: rental created/cancelled (12, 13), payment transitions (14), dispute opened/escalated/resolved (15, 16), admin actions (17).
- **Phase 8:** Auth failure logging (18) and repeated-failure threshold warning (19).
- **Phase 9:** Stripe webhook log event id/type and signature failure (20); audit on success (21); webhook integration test (22).
- **Phase 10:** Integration tests for rental and optionally dispute/admin audit (23, 24).

All requirements LOG-001 through LOG-RET-003, LOG-PERF-001/002, and the integration requirements (LOG-AUD-010–014, LOG-AUD-020, LOG-SEC-001–004, LOG-PAY-001–004) are covered by the above tasks.
