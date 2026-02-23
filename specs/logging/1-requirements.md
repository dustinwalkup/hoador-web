# Production Logging - Requirements Document

## Introduction

The Production Logging feature establishes a unified, structured logging and audit system for the Hoador application. It provides server-side structured JSON logs with correlation identifiers, a durable audit log for business-critical events (bookings, payments, disputes, admin actions), security event logging, Stripe webhook traceability, and integration with Sentry for error monitoring. The system ensures no sensitive data (tokens, passwords, full payment details) is logged while retaining audit logs for compliance (minimum five years) and supporting observability in production (e.g., Vercel runtime logs and Sentry).

## Requirements

### Requirement 1: Structured Logging Architecture

**User Story:** As a developer or operator, I want a centralized, structured logging system so that I can trace requests, debug issues, and meet observability standards across all server-side operations.

#### Acceptance Criteria

1. **LOG-001** The system SHALL generate structured JSON logs for all server-side operations.
2. **LOG-002** The system SHALL use a centralized logging utility for all application logs.
3. **LOG-003** The system SHALL include a correlation identifier (requestId) in every server log entry.
4. **LOG-004** The system SHALL include userId in logs when an authenticated user is present.
5. **LOG-005** The system SHALL support log levels: trace, debug, info, warn, error, fatal.
6. **LOG-006** The system SHALL default to info level in production environments.

### Requirement 2: Request and API Logging

**User Story:** As an operator, I want every HTTP request and response to be logged with timing and outcome so that I can monitor API usage and diagnose performance or failure issues.

#### Acceptance Criteria

1. **LOG-REQ-001** WHEN an HTTP request is received THEN the system SHALL log the request method, route, requestId, and timestamp.
2. **LOG-REQ-002** WHEN an HTTP response is sent THEN the system SHALL log the response status code and request duration.
3. **LOG-REQ-003** WHEN a request execution time exceeds 1000ms THEN the system SHALL log a warning-level performance event.
4. **LOG-REQ-004** WHEN an unhandled exception occurs in a request lifecycle THEN the system SHALL log an error-level entry and report it to Sentry.

### Requirement 3: Audit Log Data Model

**User Story:** As a system, I need a durable audit log table so that business-critical events are persisted for compliance and forensic analysis.

#### Acceptance Criteria

1. **LOG-AUD-001** The system SHALL persist business-critical events in a durable audit_logs database table.
2. **LOG-AUD-002** The system SHALL record the following attributes for each audit log:
   - id
   - entityType
   - entityId
   - action
   - userId (nullable)
   - metadata (jsonb)
   - ipAddress (nullable)
   - userAgent (nullable)
   - createdAt

### Requirement 4: Business Audit Event Recording

**User Story:** As an operator or compliance stakeholder, I want business-critical events (bookings, payments, disputes, admin actions) recorded in the audit log so that we have a complete, queryable history for support and compliance.

#### Acceptance Criteria

1. **LOG-AUD-010** WHEN a booking is created THEN the system SHALL record a booking.created audit event.
2. **LOG-AUD-011** WHEN a booking is cancelled THEN the system SHALL record a booking.cancelled audit event.
3. **LOG-AUD-012** WHEN a payment is captured, refunded, or fails THEN the system SHALL record a payment state transition audit event.
4. **LOG-AUD-013** WHEN a dispute is opened, escalated, or resolved THEN the system SHALL record a dispute lifecycle audit event.
5. **LOG-AUD-014** WHEN an administrative action modifies user roles, permissions, or account status THEN the system SHALL record an admin action audit event.
6. **LOG-AUD-020** IF a request is unauthenticated THEN the system SHALL still record audit events with a null userId when applicable.

### Requirement 5: Security Logging

**User Story:** As a security or admin user, I want authentication failures, role changes, and account status changes logged so that we can detect abuse and investigate security incidents.

#### Acceptance Criteria

1. **LOG-SEC-001** WHEN an authentication attempt fails THEN the system SHALL record a failed authentication security event.
2. **LOG-SEC-002** WHEN a user role changes THEN the system SHALL record a role modification audit event.
3. **LOG-SEC-003** WHEN an account is suspended or banned THEN the system SHALL record an account status change audit event.
4. **LOG-SEC-004** WHEN repeated failed authentication attempts exceed a defined threshold THEN the system SHALL log a warning-level security event.

### Requirement 6: Payment and Webhook Logging

**User Story:** As an operator, I want Stripe webhook events logged by event ID and type so that we can trace payment and webhook processing without persisting sensitive payloads.

#### Acceptance Criteria

1. **LOG-PAY-001** WHEN a webhook event is received from Stripe THEN the system SHALL log the event ID and event type.
2. **LOG-PAY-002** WHEN webhook signature verification fails THEN the system SHALL log an error-level security event.
3. **LOG-PAY-003** WHEN a webhook event is processed successfully THEN the system SHALL record an internal payment audit event.
4. **LOG-PAY-004** The system SHALL NOT persist full payment payloads containing sensitive financial data.

### Requirement 7: Error Monitoring and Observability

**User Story:** As a developer or operator, I want unhandled exceptions reported to Sentry with request and user context so that we can triage and fix production errors quickly.

#### Acceptance Criteria

1. **LOG-OBS-001** The system SHALL report unhandled exceptions to Sentry.
2. **LOG-OBS-002** The system SHALL include requestId and userId as contextual tags in Sentry events.
3. **LOG-OBS-003** The system SHALL track release versions in Sentry for deployment correlation.
4. **LOG-OBS-010** WHEN a production error occurs THEN the system SHALL include route and environment metadata in the Sentry event.

### Requirement 8: Privacy and Data Protection

**User Story:** As a system and compliance stakeholder, I want to ensure no sensitive or personally identifiable data is logged beyond what is required for audit so that we meet privacy and security standards.

#### Acceptance Criteria

1. **LOG-PRIV-001** The system SHALL NOT log authentication tokens.
2. **LOG-PRIV-002** The system SHALL NOT log passwords.
3. **LOG-PRIV-003** The system SHALL NOT log full payment details.
4. **LOG-PRIV-004** The system SHALL NOT log personally identifiable information beyond userId unless required for audit purposes.

### Requirement 9: Retention and Durability

**User Story:** As a compliance or operations stakeholder, I want application and audit logs retained according to policy and audit logs to be immutable so that we can meet legal and audit requirements.

#### Acceptance Criteria

1. **LOG-RET-001** The system SHALL retain application logs according to hosting provider defaults.
2. **LOG-RET-002** The system SHALL retain audit logs for a minimum of five years.
3. **LOG-RET-003** The system SHALL ensure audit logs are not modifiable after creation.

## Non-Functional Requirements

### Performance

1. **LOG-PERF-001** IF logging overhead increases request latency beyond acceptable thresholds THEN the system SHALL use asynchronous logging mechanisms.
2. **LOG-PERF-002** IF audit log volume exceeds defined capacity limits THEN the system SHALL support archiving or partitioning strategies.
3. The system SHALL minimize impact of logging on request response time (e.g., avoid blocking I/O where possible).

### Reliability

1. The system SHALL ensure audit log writes are durable (e.g., committed to database before considering the operation complete).
2. WHERE logging fails (e.g., transport failure) THEN the system SHALL not fail the primary business operation; logging SHALL be best-effort where it is not critical to the transaction.
3. The system SHALL handle logging utility unavailability gracefully (e.g., fallback or no-op) so that the application remains operational.

### Security

1. Audit logs SHALL be protected from unauthorized modification (immutability as per LOG-RET-003).
2. Access to audit logs SHALL be restricted to authorized roles (e.g., admin, support, compliance).
3. The system SHALL NOT expose sensitive data in log aggregation or monitoring UIs beyond what is necessary for authorized operators.

### Scalability

1. The system SHALL support increasing request volume without degrading log quality or losing critical audit events.
2. Audit log storage and indexing SHALL support efficient querying by entityType, entityId, userId, action, and date range.
3. WHERE audit log volume grows THEN the system SHALL support partitioning or archiving strategies as per LOG-PERF-002.

## Assumptions and Constraints

- The application runs on Vercel (or similar) and uses its runtime log aggregation; structured logs will be visible in that environment.
- Sentry is the chosen error monitoring provider; release tracking and tagging are implemented accordingly.
- Stripe is the payment provider; webhook logging applies to Stripe webhooks only.
- The audit_logs table does not yet exist; it will be created as part of this feature.
- Log levels and thresholds (e.g., 1000ms for slow requests, failed-auth threshold) are configurable via environment or configuration where practical.
- "Booking" in this document refers to the same concept as rental/rental request in the rest of the codebase; audit events will use the appropriate domain terminology consistently.
- Authentication and role changes are implemented elsewhere; this feature only requires that the appropriate hooks or call sites emit the specified audit and security events.

## Edge Cases

1. **High concurrency**: Under load, the system SHALL not drop audit events or corrupt log entries; batching or async writes may be used with durability guarantees.
2. **Partial failures**: If Sentry reporting fails, the system SHALL still write the error to application logs and SHALL NOT block the response.
3. **Missing requestId**: For background jobs or non-request contexts, the system SHALL generate or omit requestId as appropriate and SHALL still support correlation where possible (e.g., job ID).
4. **Null userId for audit**: Unauthenticated actions that trigger audit events (e.g., webhook processing) SHALL store userId as null and SHALL still record ipAddress/userAgent when available.
5. **Webhook replay**: Logging of Stripe event ID SHALL support detection of duplicate processing; idempotency is out of scope for this doc but logging SHALL not prevent it.
6. **Log level changes**: Changing log level at runtime (if supported) SHALL not require application restart where the logging utility supports it.
7. **Audit log query performance**: As audit_logs grows, queries by date and entity SHALL remain within acceptable latency via indexing or partitioning.
8. **Multi-region or multi-instance**: requestId and timestamps SHALL be sufficient to correlate logs across instances; no assumption of single-process logging.

## Out of Scope

- Client-side or browser logging (only server-side logging is in scope).
- Log aggregation or SIEM integration beyond writing structured logs to stdout/Vercel and persisting audit_logs in Postgres.
- Redaction or masking of PII within existing third-party log aggregators (handled by not logging PII per LOG-PRIV-\*).
- Automated alerting rules (e.g., Sentry alerts); configuration of alerts is operational, not part of this requirements set.
- Log sampling or sampling strategies (may be added later if volume demands).
- Detailed schema or implementation of "metadata (jsonb)" for each audit event type; that is left to design.
- Definition of "defined threshold" for LOG-SEC-004; to be specified in design or configuration.
- Definition of "acceptable thresholds" and "defined capacity limits" for LOG-PERF-001 and LOG-PERF-002; to be specified in design or operations playbook.

## Definition of Done for Production Logging

Production logging is considered complete when:

- Structured logs are visible in Vercel runtime logs.
- Errors are visible and grouped in Sentry.
- Audit events are queryable in Postgres.
- Stripe webhook events are traceable by event ID.
- No sensitive information is logged.
- All booking, payment, and dispute state transitions generate audit entries.
