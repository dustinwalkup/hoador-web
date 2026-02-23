# Production Logging - Test Plan

## Overview

This test plan defines how to verify that the Production Logging implementation meets the requirements in [specs/logging/1-requirements.md](specs/logging/1-requirements.md) and aligns with the design in [specs/logging/2-design.md](specs/logging/2-design.md). Tests are mapped to requirements by ID (LOG-001, LOG-REQ-001, LOG-AUD-\*, etc.). Test types (unit, integration, manual), framework, coverage goals, key test cases, and test data strategies are specified.

## Requirements Traceability

### Requirement 1: Structured Logging Architecture (LOG-001 – LOG-006)

**Requirement Reference**: 1-requirements.md – Requirement 1

**Acceptance Criteria**: LOG-001 (structured JSON), LOG-002 (centralized utility), LOG-003 (requestId in every entry), LOG-004 (userId when authenticated), LOG-005 (levels trace–fatal), LOG-006 (default info in production).

**Test Coverage**:

- Unit: Logger emits a single JSON object per log call with required keys (level, message, timestamp; requestId and userId when context provided).
- Unit: All application logs go through the same logger utility (no direct console.log for app logs in scope).
- Unit: getLogger(context) with requestId/userId produces log lines containing those fields.
- Unit: All six levels (trace, debug, info, warn, error, fatal) are supported and respect current LOG_LEVEL (e.g. when level is info, debug/trace are not emitted).
- Unit: Default level is info when NODE_ENV=production or LOG_LEVEL is unset.
- Integration: Request-scoped logs in a wrapped route include requestId (and userId when authenticated).

### Requirement 2: Request and API Logging (LOG-REQ-001 – LOG-REQ-004)

**Requirement Reference**: 1-requirements.md – Requirement 2

**Acceptance Criteria**: LOG-REQ-001 (log request method, route, requestId, timestamp), LOG-REQ-002 (log response status, duration), LOG-REQ-003 (warn when duration > 1000ms), LOG-REQ-004 (error log + Sentry on unhandled exception).

**Test Coverage**:

- Integration: Wrapped handler logs one “request received” entry with method, route, requestId, timestamp.
- Integration: Wrapped handler logs one “response sent” entry with statusCode and durationMs on success.
- Integration: When handler runs longer than SLOW_REQUEST_MS (1000), a warning-level performance log is emitted.
- Integration: When handler throws, an error-level log entry is emitted and Sentry.captureException is invoked (mock Sentry to assert call and tags).
- Unit/Integration: Request and response bodies are not logged (no token or PII in log content).

### Requirement 3: Audit Log Data Model (LOG-AUD-001, LOG-AUD-002)

**Requirement Reference**: 1-requirements.md – Requirement 3

**Acceptance Criteria**: LOG-AUD-001 (persist in audit_logs table), LOG-AUD-002 (id, entityType, entityId, action, userId, metadata, ipAddress, userAgent, createdAt).

**Test Coverage**:

- Unit: AuditLogDAL.create(entry) inserts one row; returned row has id, entityType, entityId, action, userId (nullable), metadata, ipAddress, userAgent, createdAt.
- Unit: AuditLogDAL has no update or delete methods (append-only; LOG-RET-003).
- Unit: Schema enforces column types and indexes exist for entityType+entityId, userId+createdAt, action+createdAt, createdAt.
- Integration: Inserted audit row is queryable in test DB by entityType, entityId, userId, action, createdAt.

### Requirement 4: Business Audit Event Recording (LOG-AUD-010 – LOG-AUD-014, LOG-AUD-020)

**Requirement Reference**: 1-requirements.md – Requirement 4

**Acceptance Criteria**: LOG-AUD-010 (booking created), LOG-AUD-011 (booking cancelled), LOG-AUD-012 (payment captured/refunded/failed), LOG-AUD-013 (dispute opened/escalated/resolved), LOG-AUD-014 (admin action), LOG-AUD-020 (unauthenticated requests still record audit with null userId).

**Test Coverage**:

- Integration: Creating a rental request produces one audit_logs row with entityType `rental_request`, action `rental_request.created`, correct entityId and userId (LOG-AUD-010).
- Integration: Cancelling a rental request or rental produces one audit_logs row with action `rental_request.cancelled` or `rental.cancelled` (LOG-AUD-011).
- Integration: Payment capture/refund/failure flows produce audit_logs row with entityType `payment`, action `payment.captured` / `payment.refunded` / `payment.failed`, metadata without full payment details (LOG-AUD-012, LOG-PRIV-003).
- Integration: Creating a dispute produces audit row `dispute.opened`; resolving or escalating produces `dispute.resolved` / `dispute.escalated` (LOG-AUD-013).
- Integration: Admin role/permission/account-status change produces audit row with action `admin.role_change` / `admin.permission_change` / `admin.account_status_change` (LOG-AUD-014).
- Integration: Webhook success (no user) produces audit row with userId null (LOG-AUD-020).

### Requirement 5: Security Logging (LOG-SEC-001 – LOG-SEC-004)

**Requirement Reference**: 1-requirements.md – Requirement 5

**Acceptance Criteria**: LOG-SEC-001 (failed auth event), LOG-SEC-002 (role change audit), LOG-SEC-003 (account status change audit), LOG-SEC-004 (warning when repeated failures exceed threshold).

**Test Coverage**:

- Integration: Failed authentication attempt results in a security log event (and optionally audit_logs auth.failed); no password or token in logs (LOG-SEC-001).
- Integration: Admin role change and account status change produce the corresponding audit events (LOG-SEC-002, LOG-SEC-003) — can be covered under Requirement 4 admin tests.
- Unit/Integration: When failed attempts for an identifier exceed FAILED_AUTH_THRESHOLD within the window, a warning-level security log is emitted (LOG-SEC-004); threshold/window configurable.

### Requirement 6: Payment and Webhook Logging (LOG-PAY-001 – LOG-PAY-004)

**Requirement Reference**: 1-requirements.md – Requirement 6

**Acceptance Criteria**: LOG-PAY-001 (log event ID and type on receive), LOG-PAY-002 (error-level on signature failure), LOG-PAY-003 (audit on success), LOG-PAY-004 (no full payment payload persisted).

**Test Coverage**:

- Integration: Stripe webhook POST logs event ID and event type; log output does not contain full request body (LOG-PAY-001, LOG-PAY-004).
- Integration: Invalid or missing signature results in error-level log and 400 response; no audit row for that payload (LOG-PAY-002).
- Integration: Successful webhook processing creates one audit_logs row with entityId = event.id, action `webhook.processed`, metadata limited to e.g. eventType (LOG-PAY-003, LOG-PAY-004).
- Unit: Audit metadata for payment/webhook events does not include full card number, full payload, or other sensitive financial data.

### Requirement 7: Error Monitoring and Observability (LOG-OBS-001 – LOG-OBS-010)

**Requirement Reference**: 1-requirements.md – Requirement 7

**Acceptance Criteria**: LOG-OBS-001 (report to Sentry), LOG-OBS-002 (requestId, userId tags), LOG-OBS-003 (release versions), LOG-OBS-010 (route, environment in Sentry event).

**Test Coverage**:

- Integration: Unhandled exception in wrapped route results in Sentry.captureException being called (mock Sentry) (LOG-OBS-001).
- Integration: Sentry capture receives tags: requestId, userId (when present), route, environment (LOG-OBS-002, LOG-OBS-010).
- Manual/Config: Sentry init uses release from package or env (LOG-OBS-003); verify in deployment or config test.
- Integration: When Sentry.captureException fails, request still completes and error is written to application log (partial failure edge case).

### Requirement 8: Privacy and Data Protection (LOG-PRIV-001 – LOG-PRIV-004)

**Requirement Reference**: 1-requirements.md – Requirement 8

**Acceptance Criteria**: LOG-PRIV-001 (no tokens), LOG-PRIV-002 (no passwords), LOG-PRIV-003 (no full payment details), LOG-PRIV-004 (no PII beyond userId unless required for audit).

**Test Coverage**:

- Unit: Logger (or redact helper) does not include known sensitive keys (e.g. token, password, authorization, card number) in log output when passed in metadata; keys are redacted or omitted.
- Unit: AuditLogDAL metadata conventions: payment metadata has no full card/payment method; audit payloads do not contain tokens or passwords.
- Code review / negative tests: Confirm request/response logging does not log headers that contain tokens or body that might contain passwords.
- Integration: Stripe webhook log and audit row contain only event id, event type, and safe metadata (LOG-PAY-004, LOG-PRIV-003).

### Requirement 9: Retention and Durability (LOG-RET-001 – LOG-RET-003)

**Requirement Reference**: 1-requirements.md – Requirement 9

**Acceptance Criteria**: LOG-RET-001 (application logs per host defaults), LOG-RET-002 (audit logs retained 5 years), LOG-RET-003 (audit logs not modifiable).

**Test Coverage**:

- Unit: AuditLogDAL exposes only create; no update or delete (LOG-RET-003).
- Integration: Audit row once inserted cannot be updated or deleted via DAL (LOG-RET-003).
- Manual/Operational: LOG-RET-001 and LOG-RET-002 are policy/operational (Vercel retention, 5-year retention); documented in runbooks; no automated test required in codebase.

### Non-Functional: Performance, Reliability, Security

**Test Coverage**:

- Unit: Logger throws (e.g. serialization error) — catch and fallback so caller does not fail (reliability NFR).
- Integration: Primary business operation (e.g. create rental request) completes successfully even if audit insert fails (when design allows best-effort) or logger fails (reliability).
- Security: Audit log read access is restricted to authorized roles (no public API for raw audit table); immutability enforced by DAL (no update/delete).

## Test Types and Strategy

### Unit Tests

**Purpose**: Logger output shape and level filtering; request context; AuditLogDAL; redaction/sensitive data handling; failed-auth threshold logic.

**Framework**: Vitest

**Coverage Goals**: 80%+ for `src/lib/logger`, `src/lib/logger/request-context.ts`, and `src/dal/audit-log.dal.ts`; critical paths for level filtering and redaction.

**Areas to Test**:

- **Logger**: getLogger() with and without context; each level (trace–fatal); LOG_LEVEL filtering; JSON shape (level, message, timestamp, requestId, userId); redaction of sensitive keys in metadata.
- **Request context**: runWithRequestContext stores and restores requestId/userId; getLogger() without args picks up context when inside runWithRequestContext.
- **AuditLogDAL**: create() inserts row with all required/optional fields; return value shape; no update/delete methods.
- **Failed-auth threshold**: Counter and window logic; when count exceeds threshold, warning is logged (mock logger).

**Mock/Stub Strategy**:

- Capture logger output (e.g. Pino destination or stream) to assert JSON and level.
- Use test DB or in-memory DB for AuditLogDAL.
- Mock Sentry in integration tests to assert captureException and tags.

### Integration Tests

**Purpose**: Request/response logging wrapper; Sentry tags on error; slow-request warning; audit events from rental, payment, dispute, webhook, and auth flows.

**Framework**: Vitest with test DB and mocked external services (Sentry, optional Stripe).

**Coverage Goals**: All LOG-REQ-_ and LOG-OBS-_ request-logging behavior; at least one audit integration per event type (rental created/cancelled, webhook processed, dispute opened/resolved); 70%+ for audit integration paths.

**Areas to Test**:

- **withRequestLogging**: Wrap a test handler; assert request log, response log, duration; assert slow-request warn when handler delays > 1000ms; assert error log + Sentry.captureException (mock) when handler throws; assert tags (requestId, userId, route, environment).
- **Rental**: POST create rental request → one audit_logs row rental_request.created; cancel flow → one row rental_request.cancelled or rental.cancelled.
- **Stripe webhook**: Valid signature + success → log event id/type, one audit row webhook.processed; invalid signature → error log, 400, no audit row; no full body in logs or audit.
- **Dispute**: Create dispute → audit row dispute.opened; resolve → audit row dispute.resolved (if implemented).
- **Auth failure**: Failed login attempt → security log (and optionally audit auth.failed); no password in log.
- **Sentry partial failure**: When Sentry.captureException throws, response still returned and error logged locally.

**Mock/Stub Strategy**:

- Mock Sentry (e.g. vi.mock("@sentry/nextjs")) to capture captureException calls and assert tags.
- Use test database for audit_logs; seed or create rentals/disputes as needed for integration flows.
- Stripe webhook: use Stripe test helpers or constructEvent with test secret to generate valid signature; invalid signature for failure path.

### Manual / Exploratory Tests

**Purpose**: Verify in real environment: structured logs in Vercel, Sentry events with context, audit queryability, no sensitive data in logs.

**Scenarios**:

- Deploy to preview or production; trigger a few API requests; confirm structured JSON logs appear in Vercel runtime logs with requestId and (when authenticated) userId.
- Trigger an error (e.g. 500); confirm error appears in Sentry with requestId, userId, route, environment, and release.
- Query audit_logs in Postgres (e.g. by entityType, entityId, userId, createdAt) and confirm rows for rental create, cancel, webhook, dispute, admin as implemented.
- Confirm Stripe webhook events are traceable by event ID in logs and in audit_logs (entityId = event.id).
- Spot-check: no authentication tokens, passwords, or full payment details in log output or audit metadata.

## Test Data Requirements

- **Users**: Authenticated user (for userId in logs and audit); unauthenticated (for null userId audit).
- **Request context**: requestId (UUID or nanoid), optional userId, ipAddress, userAgent (from getClientIP/getUserAgent).
- **Audit entries**: entityType, entityId, action, userId (or null), metadata (minimal, no PII/sensitive), ipAddress, userAgent.
- **Stripe webhook**: Sample event id and type; valid and invalid signature for verification tests.
- **Rental request / rental**: IDs and minimal payload for create and cancel flows.

## Key Test Cases Summary

| ID  | Scenario                                                      | Type        | Requirements              |
| --- | ------------------------------------------------------------- | ----------- | ------------------------- |
| T1  | Logger emits valid JSON with level, message, timestamp        | Unit        | LOG-001                   |
| T2  | getLogger(context) adds requestId and userId to output        | Unit        | LOG-003, LOG-004          |
| T3  | When LOG_LEVEL=info, debug/trace not emitted                  | Unit        | LOG-005, LOG-006          |
| T4  | Sensitive keys in metadata redacted or omitted                | Unit        | LOG-PRIV-\*               |
| T5  | AuditLogDAL.create inserts row; no update/delete              | Unit        | LOG-AUD-001, 002, RET-003 |
| T6  | Wrapped route logs request then response with duration        | Integration | LOG-REQ-001, 002          |
| T7  | Handler duration > 1000ms → warn performance log              | Integration | LOG-REQ-003               |
| T8  | Handler throws → error log + Sentry with tags                 | Integration | LOG-REQ-004, LOG-OBS-\*   |
| T9  | Create rental request → audit row rental_request.created      | Integration | LOG-AUD-010               |
| T10 | Cancel rental → audit row rental_request.cancelled            | Integration | LOG-AUD-011               |
| T11 | Webhook success → log event id/type + audit webhook.processed | Integration | LOG-PAY-001, 003, 004     |
| T12 | Webhook signature failure → error log, no audit               | Integration | LOG-PAY-002               |
| T13 | Failed auth → security log; no password in log                | Integration | LOG-SEC-001, LOG-PRIV-002 |
| T14 | Repeated failed auth over threshold → warning log             | Unit/Integ  | LOG-SEC-004               |
| T15 | Logger/Sentry failure does not fail request                   | Integration | NFR Reliability           |

## Security and Performance

- **Security**: Audit logs must not be writable (no update/delete). Read access to audit_logs only via authorized APIs/roles. Tests verify DAL has no update/delete and that sensitive data (tokens, passwords, full payment details) never appear in logger output or audit metadata.
- **Performance**: Logging should not block the request path. Tests can assert that wrapped handler completes without unnecessary await on logger. LOG-PERF-001 (async logging) is an implementation option; if used, tests remain valid. No specific latency benchmark in this plan; optional: assert request duration overhead is below a threshold (e.g. 50ms) when logging is enabled.

## Definition of Done Verification

Production logging is complete when (from 1-requirements.md):

- **Structured logs in Vercel**: Manual or E2E: trigger requests, confirm JSON logs in Vercel runtime logs (T6, T8, manual).
- **Errors in Sentry**: Manual or integration with mocked Sentry: confirm errors reported with requestId, userId, route, environment (T8, manual).
- **Audit events queryable in Postgres**: Integration tests create audit rows; manual query by entityType, entityId, userId, createdAt (T5, T9, T10, T11).
- **Stripe webhooks traceable by event ID**: Integration and manual: log and audit contain event id, not full payload (T11, T12, manual).
- **No sensitive information logged**: Unit (redaction) and integration (no body/token in request log); manual spot-check (T4, T8, T13).
- **Booking, payment, dispute transitions generate audit entries**: Integration tests for rental create/cancel, payment, dispute, admin (T9, T10, and payment/dispute/admin tests).

## Summary

Tests are mapped to all requirement IDs (LOG-001 through LOG-RET-003, LOG-PERF-001/002, and NFRs). Unit tests cover the central logger (levels, context, redaction), request context, and AuditLogDAL. Integration tests cover the request-logging wrapper (request/response, slow request, error + Sentry tags), rental audit events, Stripe webhook logging and audit, auth failure logging, and optional dispute/admin audit. Manual scenarios verify Vercel logs, Sentry context, and audit queryability in a real environment. Use Vitest; mock Sentry and use test DB for audit and routes. The plan ensures the Definition of Done for Production Logging can be verified before release.
