# Backend Architecture v2

## Overview

The architecture establishes clear boundaries between layers:

- **API Routes** (`src/app/api/**/route.ts`): authentication, authorization,
  request validation, response shaping. Own auth for all client requests.
- **Services** (`src/features/<domain>/services/`): business logic and
  orchestration — DAL + Stripe + notifications + audit logging.
- **DAL** (`src/dal/*.dal.ts`): pure database operations. No auth, no business
  rules.
- **Infrastructure services** (`src/services/`): wrappers around third-party
  SDKs (Stripe, Resend, OpenAI, …). Domain code calls these helpers, never raw
  SDKs.
- **React Query**: all client-side data fetching and mutations, against API
  routes. No server actions.
- **Server Components**: auth check inline, fetch via DAL, optionally prefetch
  into the React Query cache (`HydrateClient`).

```
Client Component ──fetch──▶ API Route ──▶ Service ──▶ DAL ──▶ Postgres
                              │             │  └──▶ src/services/* (Stripe, Resend, …)
                              │             └──▶ Notifications (fire-and-forget)
                              └──▶ DAL directly (simple CRUD)

Server Component ──▶ DAL ──▶ setQueryData ──▶ <HydrateClient> ──▶ client hooks
```

---

## Core Principles

### 1. DAL is Auth-Agnostic

The DAL performs database operations only. It receives parameters like
`userId` when needed for filtering — it does NOT verify authentication or
authorization, ever.

### 2. API Routes Own Auth for Client Requests

All client-side data access goes through API routes. Auth checks happen in
the route, via the helpers in `@/lib/api/route-helpers`, before any service
or DAL call.

### 3. Services Own Business Logic and Side Effects

Anything beyond a single read/write — state transitions, money movement,
multi-DAL coordination, notifications, legal/audit recording — belongs in a
service. Routes stay thin; DALs stay dumb.

### 4. React Query for All Client-Side Data

- `useQuery` / `useInfiniteQuery` for fetching → calls API routes
- `useMutation` (usually via the `useCreateMutation` helper) for changes
- **No server actions** — this is a deliberate architectural choice.

### 5. Server Components Fetch via DAL and Hydrate the Cache

Server pages check auth inline (no middleware), call DALs directly for the
initial data, and either pass it as props or seed the React Query cache so
client hooks take over without a refetch.

---

## Layer Responsibilities

### API Routes (`src/app/api/`)

**Responsibilities:**

- Authenticate (session) and authorize (ownership/role) the request
- Validate request data with Zod (`safeParse`) before use
- Call a service (business logic) or a DAL (simple CRUD)
- Map errors to HTTP status codes via `handleApiError()`

**⚠️ Always use the route helpers** from `@/lib/api/route-helpers`:

| Helper                                        | Returns                                             | Use When                                 |
| --------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| `getAuthenticatedUserResponse()`              | `NextResponse` (401) OR `{ user, userId, isAdmin }` | **Default** — most protected endpoints   |
| `requireAuthResponse()`                       | `NextResponse` (401) OR `null`                      | Auth required but user object not needed |
| `requireAdminResponse()`                      | `NextResponse` (401/403) OR `null`                  | Admin-only endpoints                     |
| `handleApiError(error)`                       | `NextResponse` with mapped status                   | Catch block of every route               |
| `captureNonCriticalError(e, {route, action})` | void (console + Sentry warning)                     | Fire-and-forget side-effect failures     |
| `parseFormData(request)`                      | `Record<string, unknown>` (JSON **or** FormData)    | Routes that accept either body type      |
| `getClientIP` / `getUserAgent`                | request metadata                                    | Audit/legal recording (re-exported)      |

**Pattern (protected endpoint calling a service):**

```typescript
// src/app/api/rentals/route.ts (abridged)
import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { createRentalRequestSchema } from "@/features/rentals/lib/form-schema";
import { RentalService } from "@/features/rentals/services/rental-service";

async function postHandler(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult; // 401
    const { userId } = authResult;

    // 2. Validate
    const body = await request.json();
    const parsed = createRentalRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // 3. Delegate business logic to the service
    const { data, error } = await tryCatch(
      RentalService.createRentalRequest(userId, parsed.data),
    );
    if (error) return handleApiError(error);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(postHandler, "POST /api/rentals");
```

Notes on the pattern:

- `withRequestLogging(handler, "METHOD /path")` wraps exported handlers for
  structured request logging.
- `tryCatch` (from `@walkup/walkup-utils`) returns `{ data, error }` — used
  when the route wants to branch on the error; otherwise just `await` and let
  the outer catch + `handleApiError` deal with it.
- Ownership checks (`resource.ownerId !== userId && !isAdmin` → 403) happen in
  the route after fetching the resource, or inside the service which throws
  `ForbiddenError`.

**Route → Service vs Route → DAL:**

| Call a **service** when…                                | Call the **DAL** directly when…     |
| ------------------------------------------------------- | ----------------------------------- |
| Multi-step logic / state transitions (approve, cancel…) | Single read or write (simple CRUD)  |
| Money is involved (Stripe charge, hold, refund, payout) | Listing/fetching data for display   |
| Side effects: notifications, email, audit log, PDFs     | Profile-style field updates         |
| Legal/compliance recording                              | No side effects beyond the DB write |

Roughly 20% of routes go through a service; the other 80% are thin
CRUD over a DAL. When in doubt: if the logic would need to be duplicated by a
second caller (cron job, admin route, webhook), it belongs in a service.

**Cron routes** (`src/app/api/cron/*`) are triggered by GitHub Actions
(`.github/workflows/cron-jobs.yml`), not Vercel cron:

```typescript
// src/app/api/cron/process-service-payouts/route.ts (abridged)
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request); // Authorization: Bearer $CRON_SECRET
  if (!auth.authorized) return auth.response;

  try {
    const summary = await ServicePaymentLifecycleService.processPayouts(20);
    await CronRunHistoryService.recordRun({ jobName: "...", status: "success", ... });
    return NextResponse.json(summary);
  } catch (error) {
    await CronRunHistoryService.recordRun({ status: "failure", ... });
    await sendOpsAlert({ ... });
    return NextResponse.json({ error: "..." }, { status: 500 });
  }
}
```

**Stripe webhooks** live at `src/app/api/stripe/webhooks/route.ts`: verify the
signature with `webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`
(400 on failure), then delegate to `handleWebhookEvent(event)` in
`src/services/stripe/webhook-handlers.ts`.

---

### Services (`src/features/<domain>/services/`)

The business-logic layer. Classes with **static methods only** (no instance
state), one class per file, named `<domain>-service.ts` →
`export class RentalService { static async approveRentalRequest(...) {} }`.

Domains with services today: `admin`, `auth`, `disputes`, `listings`,
`rentals`, `reviews`, `services` (service bookings). Examples:

- `src/features/rentals/services/rental-service.ts` — create/approve rental
  requests: validates the listing, calculates pricing, persists via DALs,
  records legal acceptances, charges payment + places deposit hold via Stripe
  helpers, sends notifications.
- `src/features/rentals/services/cancellation-service.ts`,
  `payment-lifecycle-service.ts`, `refund-calculations.ts`
- `src/features/reviews/services/blind-review-service.ts` — submit/release
  blind reviews, participant + window validation, cron-driven release.
- `src/features/admin/services/` — payment-lifecycle admin ops, stale-
  processing detection, cron run history.

**Rules:**

- Services receive `userId` (and any actor context) as parameters — they never
  read the session themselves. Callers (routes, cron, webhooks) do auth first.
- Services import **DAL singletons** from `@/dal` (`rentalDAL`, `userDAL`, …)
  and **Stripe helper functions** from `@/services/stripe/*` — never the raw
  Stripe SDK.
- Throw typed errors from `@/dal/errors` (`NotFoundError`, `ForbiddenError`,
  `ValidationError`, `ConflictError`); routes map them via `handleApiError`.
- Notifications/emails are **fire-and-forget** — never let a notification
  failure fail a money operation:

```typescript
sendPaymentFailureNotificationToRenter({ ... }).catch((err) => {
  captureNonCriticalError(err, {
    route: "POST /api/rentals/[id]/approve",
    action: "send_payment_failure_notification",
  });
});
```

- Money boundaries: Stripe works in **integer cents**; DB `numeric` columns
  surface as **strings** in TS. Services convert deliberately at the boundary.

---

### Infrastructure Services (`src/services/`)

Thin wrappers around third-party SDKs. Domain services and routes call these;
nothing outside this directory touches the raw SDKs.

| Directory                   | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `src/services/stripe/`      | Payments, deposit holds, payouts, refunds, Connect, webhooks  |
| `src/services/better-auth/` | Auth client/server config                                     |
| `src/services/resend/`      | Transactional email senders                                   |
| `src/services/openai/`      | Listing image analysis, AI draft resolution                   |
| `src/services/playwright/`  | PDF generation (rental/service agreements via puppeteer-core) |
| `src/services/vercel-blob/` | File/image storage                                            |
| `src/services/geocoding/`   | Address → coordinates                                         |

---

### DAL (`src/dal/`)

**Responsibilities:**

- Execute database queries with Drizzle ORM
- Return typed data; throw typed `@/dal/errors` on constraint violations
- ❌ NO authentication or authorization logic
- ❌ NO business rules (those live in services)

**Shape:** one class per domain extending `BaseDAL`, exported as a
**singleton instance** from `src/dal/index.ts`:

```typescript
// src/dal/index.ts
export const userDAL = new UserDAL();
export const rentalDAL = new RentalDAL();
export const listingDAL = new ListingDAL();
// … ~20 singletons; always import these, never instantiate a DAL yourself
```

```typescript
// consumer
import { rentalDAL, userDAL } from "@/dal";
const rental = await rentalDAL.getRentalRequestById(id);
```

**`BaseDAL`** (`src/dal/base.ts`) provides:

- `this.db` — the shared Drizzle instance
- `handleError(error, operation)` — maps DB/constraint errors to DAL errors,
  captures unexpected ones in Sentry (production only)
- `validatePagination(page, limit)` / `createPaginatedResult(data, total, page, limit)`
  — standard `{ data, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`
- `withReadRetry(fn, operation)` — retries reads once on transient
  connection errors (Neon serverless)
- `validateEmail` / `validatePhoneNumber`

DAL methods read/write via `this.db` directly; there is currently no
transaction-parameter (`tx`) pattern — multi-step atomicity is handled at the
service level by sequencing + compensating updates.

**Error classes** (`src/dal/errors.ts`), all extending `DALError`:

| Class                              | Status                              |
| ---------------------------------- | ----------------------------------- |
| `NotFoundError(resource, id?)`     | 404                                 |
| `ValidationError(message, field?)` | 400                                 |
| `ForbiddenError(message?)`         | 403                                 |
| `ConflictError(message)`           | 409                                 |
| `ServiceBookingPaymentFailedError` | 400                                 |
| `PaymentSetupRequiredError`        | 402/412 (carries onboarding status) |

Throw these from DALs and services; `handleApiError` maps them to responses
and only reports unexpected (5xx) errors to Sentry.

---

### React Query (Client Components)

All client-side data goes through React Query hooks that call API routes.

**Setup:**

- Provider + `QueryClient` in `src/components/providers.tsx`
  (`staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`,
  Sentry integration, devtools in dev).
- Hooks live in `src/features/<domain>/hooks/`, named `use<Entity>` /
  `use<Action>` (e.g. `useConversations`, `useListingMutations`).
- Hooks use raw `fetch()` with inline error handling (no shared fetcher).
- Query keys are inline arrays (`["conversations", archived]`), not a
  centralized factory — match them exactly when prefetching server-side.

**Queries:**

```typescript
// src/features/messages/hooks/use-conversations.ts (abridged)
export function useConversations(archived: boolean = false) {
  return useInfiniteQuery({
    queryKey: ["conversations", archived],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/messages/conversations?archived=${archived}&offset=${pageParam}`,
      );
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
  });
}
```

**Mutations** use the shared helper in
`src/lib/react-query/mutation-helpers.ts`, which wires up sonner toasts and
cache invalidation:

```typescript
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";

export function useArchiveConversation() {
  return useCreateMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/messages/conversations/${id}/archive`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Failed to archive");
      return response.json();
    },
    successMessage: "Conversation archived",
    errorMessage: "Could not archive conversation",
    invalidateQueryKeys: [
      ["conversations", false],
      ["conversations", true],
    ],
  });
}
```

- Toasts: **sonner** (`toast.success` / `toast.error`), normally driven by the
  helper's `successMessage` / `errorMessage`.
- Errors flagged `suppressToast: true` skip the toast (e.g. redirects).
- Invalidation: pass `invalidateQueryKeys`; reach for manual
  `queryClient.invalidateQueries()` only for conditional cases.

---

### Server Components

Server pages check auth inline and fetch initial data via DALs. There is
**no middleware** — protection is per-page (and per-route).

**Session helpers** (`@/features/auth/utils/session`):

| Helper                       | Returns                                    | Use When                       |
| ---------------------------- | ------------------------------------------ | ------------------------------ |
| `getAuthenticatedUser()`     | `null` OR `{ user, userId, isAdmin }`      | Check + `redirect("/sign-in")` |
| `requireAuthenticatedUser()` | `{ user, userId, isAdmin }` (throws)       | With an error boundary         |
| `getCurrentUser()`           | `UserProfile \| null` (request-memoized)   | Just need the user             |
| `getCurrentUserId()`         | `string \| null`                           | Simple ID-only check           |
| `requireVerifiedUser()`      | `UserProfile` (throws if email unverified) | Verified-only flows            |

**Pattern (prefetch + hydrate — the preferred pattern):** the page fetches
via DAL, seeds the server-side query cache with the _same query key_ the
client hook uses, and wraps the client component in `HydrateClient`
(`src/lib/react-query/server.tsx`). The canonical example is
`src/app/dashboard/mailbox/page.tsx`:

```typescript
export default async function MailboxPage() {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/sign-in");
  const { userId } = auth;

  const qc = getServerQueryClient();

  const [inbox, archived] = await Promise.all([
    messagesDAL.getUserConversationsPaginated(userId, false),
    messagesDAL.getUserConversationsPaginated(userId, true),
  ]);

  // Infinite-query shape: { pages, pageParams }; key must match the hook
  qc.setQueryData(["conversations", false], { pages: [inbox], pageParams: [0] });
  qc.setQueryData(["conversations", true], { pages: [archived], pageParams: [0] });

  return (
    <Suspense fallback={<MailboxSkeleton />}>
      <HydrateClient>
        <MailboxClient />
      </HydrateClient>
    </Suspense>
  );
}
```

**Pattern (props-only):** for pages with little client interactivity, fetch
via DAL and pass data down as props (e.g. `src/app/dashboard/payments/page.tsx`).

Server components may call **read-only** service methods for derived data
(e.g. `BlindReviewService.getReviewStatus(...)`), but mutations always go
through API routes.

---

## Notifications

Central orchestration in `src/features/notifications/utils/send-notification.ts`:

1. Create the in-app notification row (always).
2. Send email via Resend if the user's preference allows
   (`shouldSendEmail(userId, category)`).
3. Fire-and-forget web push (`shouldSendPush` + `sendPush()`), with
   `.catch(captureNonCriticalError)`.

Domain-specific notification senders live in
`src/features/<domain>/notifications/` and are invoked from services — always
fire-and-forget from the caller's perspective.

---

## Data Flow Diagrams

### Client mutation with business logic

```
User Action
    ↓
useCreateMutation hook → fetch("/api/rentals/[id]/approve")
    ↓
API Route
    ├── 1. Authenticate (getAuthenticatedUserResponse)
    ├── 2. Authorize (ownership / isAdmin)
    ├── 3. Validate (Zod safeParse)
    └── 4. Service call
            ↓
        RentalService.approveRentalRequest()
            ├── DALs (rentalDAL, paymentDAL, …)
            ├── Stripe helpers (charge, deposit hold)
            ├── Audit/legal recording
            └── Notifications (fire-and-forget)
    ↓
NextResponse (or handleApiError)
    ↓
React Query invalidation + sonner toast
```

### Simple client fetch

```
useQuery → fetch("/api/...") → API Route (auth) → DAL → JSON → cache
```

### Server-rendered page (prefetch + hydrate)

```
Server Component
    ↓ getAuthenticatedUser() → redirect("/sign-in") if null
    ↓ DAL fetch
    ↓ getServerQueryClient().setQueryData(key, data)
    ↓ <HydrateClient> → client hooks read the cache, no initial refetch
```

---

## File Structure

```
src/
├── app/
│   ├── api/                       # API routes (auth + validation + service/DAL calls)
│   │   ├── rentals/…              # incl. [id]/approve, [id]/start, …
│   │   ├── stripe/webhooks/       # signature-verified webhook entry
│   │   ├── cron/…                 # CRON_SECRET-guarded jobs (GitHub Actions)
│   │   └── test/…                 # e2e-only routes (NODE_ENV !== prod && E2E_TEST)
│   └── dashboard/…                # Server pages (auth + DAL + prefetch/hydrate)
│
├── features/<domain>/
│   ├── services/                  # Business logic (static-method classes)
│   ├── hooks/                     # React Query hooks
│   ├── notifications/             # Domain notification senders
│   ├── lib/ | schemas/            # Zod schemas, domain utils
│   └── components/
│
├── dal/                           # Pure DB operations
│   ├── base.ts                    # BaseDAL (db handle, error mapping, pagination, read-retry)
│   ├── errors.ts                  # DALError hierarchy
│   ├── index.ts                   # Singleton instances (import from here)
│   └── *.dal.ts
│
├── services/                      # Third-party SDK wrappers
│   ├── stripe/  ├── resend/  ├── openai/
│   ├── better-auth/  ├── playwright/  ├── vercel-blob/  └── geocoding/
│
├── lib/
│   ├── api/
│   │   ├── route-helpers.ts       # Auth helpers, handleApiError, captureNonCriticalError
│   │   ├── verify-cron-secret.ts
│   │   └── with-request-logging.ts
│   └── react-query/
│       ├── server.tsx             # getServerQueryClient, HydrateClient
│       └── mutation-helpers.ts    # useCreateMutation (toast + invalidation)
│
└── components/providers.tsx       # QueryClientProvider setup
```

---

## Quick Reference

### API Route Helpers (`@/lib/api/route-helpers`)

| Function                         | Returns                                             | Use When                               |
| -------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `getAuthenticatedUserResponse()` | `NextResponse (401)` OR `{ user, userId, isAdmin }` | **Default** — most protected endpoints |
| `requireAuthResponse()`          | `NextResponse (401)` OR `null`                      | Auth gate, user object not needed      |
| `requireAdminResponse()`         | `NextResponse (401/403)` OR `null`                  | Admin-only endpoints                   |
| `handleApiError(error)`          | `NextResponse` with mapped status                   | Catch block for all errors             |
| `captureNonCriticalError()`      | void (Sentry warning)                               | Fire-and-forget failures               |
| `parseFormData(request)`         | body as record (JSON or FormData)                   | Mixed-content endpoints                |

### Session Helpers (`@/features/auth/utils/session`)

| Function                     | Returns                               | Use When                      |
| ---------------------------- | ------------------------------------- | ----------------------------- |
| `getAuthenticatedUser()`     | `null` OR `{ user, userId, isAdmin }` | Check auth + redirect if null |
| `requireAuthenticatedUser()` | `{ user, userId, isAdmin }` (throws)  | Use with error boundary       |
| `getCurrentUser()`           | `UserProfile \| null` (memoized)      | User object only              |
| `getCurrentUserId()`         | `string \| null`                      | Simple ID-only check          |

### Layer Responsibilities

| Layer            | Auth                              | Business Logic                  | Data Access                       |
| ---------------- | --------------------------------- | ------------------------------- | --------------------------------- |
| API Route        | ✅ route helpers                  | ❌ delegate                     | Service or DAL                    |
| Service          | ❌ receives `userId` as param     | ✅                              | DAL singletons + `src/services/*` |
| DAL              | ❌                                | ❌                              | Drizzle queries                   |
| Server Component | ✅ session helpers + `redirect()` | ❌ (read-only service calls OK) | DAL directly                      |
| React Query      | ❌                                | ❌                              | API routes                        |

| Action                          | Pattern                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| Client fetches data             | `useQuery` → API route → DAL                                    |
| Client mutates (simple)         | `useCreateMutation` → API route → DAL                           |
| Client mutates (business logic) | `useCreateMutation` → API route → Service → DAL/Stripe          |
| Server renders page             | Server Component → auth → DAL → prefetch + `HydrateClient`      |
| Scheduled job                   | GitHub Actions → `/api/cron/*` → `verifyCronSecret` → Service   |
| Stripe event                    | `/api/stripe/webhooks` → signature check → `handleWebhookEvent` |
