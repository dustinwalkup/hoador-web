# Plan R-SEC-14: OpenAI cost controls on the AI listing-image analyzer

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/app/api/listings/analyze-image/route.ts src/lib/api/ai-rate-limit.ts src/lib/api/rate-limit.ts src/dal/rate-limit.dal.ts src/services/openai/analyze-listing-image.ts src/features/listings/ai-listing-assistant/types.ts src/app/api/listings/analyze-image/route.test.ts src/app/api/listings/analyze-image/route.logging.test.ts src/dal/__tests__/rate-limit.integration.test.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: S · **Risk**: LOW (one route, additive
  validation, no schema change; a user-visible quota policy change —
  Decision 4)
- **Depends on**: R-ARCH-07 (`enforceRateLimit`/`RateLimitDAL`, DONE
  uncommitted) — this plan extends `RateLimitDAL` with one new method and
  reuses the existing `rate_limit_buckets` table; no new migration.
- **Category**: security / cost-control · **Planned at**: commit `29fe557`,
  2026-09-25
- **Fixes**: SEC-14

## Why this matters

`POST /api/listings/analyze-image` sends every string in `imageUrls` straight
to gpt-4o as an `image_url` part, with no count cap, no size cap, and no host
restriction — a request with dozens of large `data:` URLs multiplies cost per
call. The limiter (`src/lib/api/ai-rate-limit.ts`) is an in-memory `Map`, so
it resets per serverless instance: a multi-instance deploy gives an attacker
one free bucket per instance. Worse, `refund()` runs for **every** outcome
that doesn't produce a usable draft — a model refusal, a low-confidence
parse, or a thrown error — so an attacker who crafts inputs the model rejects
(or that just don't parse cleanly) pays nothing per attempt even though
OpenAI was already charged for the call. There is no daily budget and no
alert when a user is burning unusual amounts of quota.

## Current state

- `src/app/api/listings/analyze-image/route.ts:18-20`:
  ```ts
  const analyzeImageSchema = z.object({
    imageUrls: z.union([z.string(), z.array(z.string())]),
  });
  ```
  No count limit, no per-item shape check.
- Both real callers send **base64 `data:` URLs**, not hosted blob URLs —
  confirmed by reading both clients, not assumed from the finding:
  - Web: `src/features/listings/hooks/use-analyze-listing-draft.ts:34-46`
    (`FileReader.readAsDataURL`).
  - Mobile: `hoador-mobile/src/native/upload.ts:26` ("takes base64 data URLs
    in a JSON body"). So "accept only Hoador blob hosts" (one half of the
    finding's suggested fix) would break both real clients — the `data:`
    half of the same recommendation is the one that fits how this endpoint is
    actually used.
  - `src/features/listings/ai-listing-assistant/types.ts:20` already defines
    `MAX_AI_PHOTOS = 5` as the client-side cap on staged photos, with a
    comment already explaining why: "each photo is sent to gpt-4o as a base64
    data URL and counts against vision token budget." No server-side
    enforcement of this constant exists today — the route trusts the client.
- `route.ts:56-63`: `consume(userId)` from `ai-rate-limit.ts`, checked before
  the body is even parsed.
- `route.ts:65-73`: a validation failure calls `refund(consumedUserId)` —
  correct, no OpenAI call happened yet.
- `route.ts:93-99`: a model refusal (`result.kind === "refused"`) calls
  `refund(consumedUserId)` — **wrong**: the OpenAI call already happened and
  was billed.
- `route.ts:109-115`: a low-confidence/unparseable draft also calls
  `refund(consumedUserId)` — **wrong**, same reason.
- `route.ts:120-124` (`catch` block): a thrown error (network/API fault)
  calls `refund(consumedUserId)`. That is right for a call that never
  completed (an OpenAI API/network error, our DB failing), and wrong for
  the post-billing throw described below. Step 3 narrows it to the first
  case.
- `src/lib/api/ai-rate-limit.ts` — in-memory `Map<string, number[]>`,
  `DEFAULT_LIMIT = 10`, `DEFAULT_WINDOW_MS = 1h`, no daily budget, no ops
  alert, resets on every cold start/instance, and has its own doc comment
  already admitting "Limits to a single process... Would migrate to a shared
  store... for multi-instance."
- `src/dal/rate-limit.dal.ts` `RateLimitDAL.consume` (landed by R-ARCH-07) has
  no refund/decrement method — only atomic increment-and-check. It is a
  **fixed window** per key: the upsert resets `count` to 1 and moves
  `reset_at` once the old `reset_at` has passed. A rejected `consume` still
  increments (count can exceed `limit`). `reset_at` is `timestamp` (without
  time zone, microsecond precision, set from `now()`), so a JS `Date`
  round-trip loses precision and can't be used for an equality match. The
  DAL's tests are real-DB only: `src/dal/__tests__/rate-limit.integration.test.ts`
  (there is no `rate-limit.dal.test.ts`).
- **The route consumes quota before it reads the body** (`route.ts:56` vs
  `:65`). That is why a validation failure needs a refund at all.
- `route.ts:120-124`'s catch-all refund also fires for errors thrown **after
  OpenAI billed the call**. `analyze-listing-image.ts:102` throws `"No message
returned from OpenAI"` when `message.content` is null, which is what a
  `finish_reason: "content_filter"` completion returns. That is a billed
  refusal, and an attacker can provoke it with images, so it gets refunded
  today.
- The route's own tests are colocated: `src/app/api/listings/analyze-image/route.test.ts`
  **and** `route.logging.test.ts`. Both mock `@/lib/api/ai-rate-limit`'s
  `consume`/`refund`, so both break when that module's exports change.
- Formats: OpenAI vision accepts png, jpeg, webp and non-animated gif, and
  **not HEIC/HEIF**. Mobile always re-encodes to `data:image/jpeg`
  (`hoador-mobile/src/native/upload.ts:193`). Web reads the user's file
  as-is, with `accept="image/*"` (`instructions-view.tsx:200,212`), so a HEIC,
  AVIF, BMP or SVG pick reaches OpenAI today and fails there.
- Size: Vercel caps a Function's request body at 4.5 MB, so the whole JSON
  body, all five images together, can't exceed that. A per-image cap above
  ~4.5M base64 chars is dead code.
- `src/services/openai/analyze-listing-image.ts:75-96` — builds one
  `chat.completions.create` call with `image_url: { url }` per photo, no
  `detail` parameter (defaults to `"auto"`, the most expensive option per
  OpenAI's own vision pricing). `Array.isArray(imageUrls) ? imageUrls :
[imageUrls]` already normalizes internally — it accepts a plain `string[]`
  today with no change needed on its side.
- Mobile contract, confirmed by reading the actual client, not the comment
  alone: `hoador-mobile/src/features/listings/hooks/use-ai-assistant.ts:43`:
  `if (error.status === 429) return 'rate_limited';` — **classification is by
  HTTP status only**, never by response body. The contract file's own header
  comment documents today's body as `429 { error: "rate_limited" }` (no
  `code`), but nothing downstream reads that shape.

## Decisions for the maintainer

**1. Image count cap reuses the existing product constant (5), not a new
"10."** The finding suggests capping at 10; the codebase already has
`MAX_AI_PHOTOS = 5` as the single source of truth for how many photos the AI
flow ever stages, on both clients. Enforcing a second, larger, hardcoded
number server-side would let the server accept more than the product design
allows and risks drifting from the client constant over time.
**Recommendation: import and enforce `MAX_AI_PHOTOS` server-side** rather
than introducing a new number.

**2. Per-user daily budget: 30/day, on top of the existing 10/hour.** The
existing hourly limit stays (it's a legitimate burst control); a new daily
cap answers SEC-14's "amplifying cost" concern specifically, since an
attacker with patience can otherwise exhaust 10/hour, wait, and repeat
all day. 30/day gives a real user room for several retries across a couple of
listings while bounding worst-case daily spend to a small, fixed multiple of
one call's cost. **Recommendation: 30/day**, as a named constant the
maintainer can tune without re-reading this plan.

**3. Alert only on the daily-budget breach, not the hourly one.** Hitting the
existing hourly burst limit is unremarkable (a user retrying a few times in
a row); hitting the **daily** budget is the signal worth paging on. The
ops alert fires only when the daily check rejects, not the hourly one, and
only on the **first** rejection in a window (`count === DAILY_LIMIT + 1`).
Otherwise a client retrying against the cap pages ops on every request.

**4. Billed outcomes now cost quota: a user-visible policy change.** The
route's own comment says "Failed calls do not eat quota", and today a
refusal or low-confidence result is free to the user. After this plan it
costs one of 10/hour and 30/day. Options: (a) charge every call OpenAI
billed (refusal, low confidence, content-filter empty reply) and refund only
calls that never completed; (b) keep refunding refusals and low confidence
and rely on the daily cap alone. **Recommendation: (a)**, which is SEC-14's
fix: under (b), crafted refusals are unlimited free gpt-4o calls up to
the daily cap, and the cap then limits nothing. Steps assume (a).

**5. Validate before consuming quota; refund only within the same window.**
Reading the body first means a malformed request never touches a bucket,
and removes the refund on the validation path. The auth check still comes
first, and the 4.5 MB platform body cap bounds the parse cost. The one
refund left, a call that never completed, is window-aware. It only
decrements the window the token came from (`reset_at` unchanged). A plain
`count - 1` lets a request that straddles a window reset refund into the
**next** window: a slow body, or an OpenAI call spanning the reset, gives up
to +1 per in-flight request, so an attacker timing up to 10 of them at the
boundary doubles their hourly allowance. **Recommendation: both.** Steps 1-3
assume them.

**6. `detail: "low"` on the vision call.** It sends each image as a 512px
thumbnail at a fixed ~85 tokens, instead of `auto`'s tiling. That is enough
to name and categorize an item, but it may miss small text such as model
numbers and brand plates, which the description uses. **Recommendation:
ship `low`** (it bounds cost per image regardless of input size), then
compare a handful of drafts on staging before and after. Step 4 assumes it.

## Commands

| Purpose        | Command                                                                                                                                                       | Expected |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                                                          | exit 0   |
| Lint           | `bun run lint`                                                                                                                                                | exit 0   |
| Targeted tests | `bun run test:run src/app/api/listings/analyze-image src/lib/api/__tests__/ai-rate-limit.test.ts src/services/openai/__tests__/analyze-listing-image.test.ts` | all pass |
| Real-DB tests  | `docker compose up -d && bun run db:push:e2e && bun run test:integration` (includes `src/dal/__tests__/rate-limit.integration.test.ts`)                       | exit 0   |

No migration — reuses the `rate_limit_buckets` table R-ARCH-07 already added.

## Scope

**In scope**: `src/app/api/listings/analyze-image/route.ts`;
`src/lib/api/ai-rate-limit.ts` (rewritten onto `RateLimitDAL`);
`src/dal/rate-limit.dal.ts` (`ConsumeResult.count`/`windowId`, new
window-aware `refund`); `src/services/openai/analyze-listing-image.ts`
(`detail: "low"`; a null-content reply becomes `refused`); tests for all of
the above, including `route.logging.test.ts` and the real-DB
`rate-limit.integration.test.ts`.

**Out of scope**: `failed-auth-store.ts` and any other in-memory limiter not
named by this finding; `src/app/api/listings/[listingId]/route.ts`'s existing
upload-rate-limit TODO (R-ARCH-07's Maintenance notes already flag it as a
trivial follow-up, not this plan's job); OpenAI's own organization-level
spend cap (dashboard config, not code).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### Step 1: `RateLimitDAL` — expose the window, add a window-aware `refund`

`ConsumeResult` gains two fields, both additive (`enforceRateLimit` and
`betterAuthRateLimitStorage` ignore them):

```ts
export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** The bucket's count after this hit (can exceed `limit`). */
  count: number;
  /** Opaque id of the window this hit landed in: `reset_at` as Postgres
   * text, full microsecond precision (a JS Date would truncate it). Pass it
   * back to `refund`. */
  windowId: string;
}
```

Import `and`/`gt` from `drizzle-orm`. In `consume`, add `windowId: sql<string>\`${rateLimitBuckets.resetAt}::text\``to the`.returning({...})`and return`count: row.count, windowId: row.windowId`.

Add next to `consume`:

```ts
/**
 * Gives back one hit for `key`, but only inside the window it was taken
 * from (SEC-14). If the window has reset since, the refund is a no-op:
 * decrementing the new window would hand out a free hit, and a request that
 * straddles a reset (slow body, long upstream call) could do that on demand.
 * One statement, so it serializes with `consume` on the row lock.
 */
async refund(key: string, windowId: string): Promise<boolean> {
  try {
    const rows = await this.db
      .update(rateLimitBuckets)
      .set({ count: sql`${rateLimitBuckets.count} - 1` })
      .where(
        and(
          eq(rateLimitBuckets.key, key),
          sql`${rateLimitBuckets.resetAt} = ${windowId}::timestamp`,
          gt(rateLimitBuckets.count, 0),
        ),
      )
      .returning({ key: rateLimitBuckets.key });
    return rows.length > 0;
  } catch (error) {
    this.handleError(error, "RateLimitDAL.refund");
  }
}
```

**Verify**: `bun run type-check` → exit 0. Extend the **real-DB**
`src/dal/__tests__/rate-limit.integration.test.ts` (a new WHERE clause; mocks
can't prove it): (1) `consume` → `refund(key, windowId)` → the count is back to
0 and it returns true; (2) forced reset: `consume` (window A),
`UPDATE rate_limit_buckets SET reset_at = now() - interval '1 second'`,
`consume` again (window B, count 1), then `refund(key, windowIdA)` → returns
false and count stays 1; (3) refund at count 0 → false, count stays 0;
(4) `windowId` round-trips exactly (`refund` with the value from `consume`
matches even though `reset_at` has microseconds).

### Step 2: Rewrite `ai-rate-limit.ts` onto `RateLimitDAL`

Replace the in-memory implementation with a durable, two-bucket wrapper.
Delete the old `Map`-based `consume`/`refund`/`__resetForTests`/`__peekForTests`
and replace the file's contents:

```ts
import { rateLimitDAL } from "@/dal";
import { RateLimitedError } from "@/dal/errors";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

/** Burst control — unchanged from the pre-existing in-memory limit. */
const HOURLY_LIMIT = 10;
const HOURLY_WINDOW_SECONDS = 60 * 60;
/** Daily budget (SEC-14, Decision 2). */
const DAILY_LIMIT = 30;
const DAILY_WINDOW_SECONDS = 24 * 60 * 60;

const hourlyKey = (userId: string) => `ai:analyze-image:hourly:user:${userId}`;
const dailyKey = (userId: string) => `ai:analyze-image:daily:user:${userId}`;

/** What a successful consume took, so a refund can give back exactly that. */
export interface AiQuotaClaim {
  userId: string;
  remaining: number;
  hourlyWindowId: string | null; // null outside production (nothing taken)
  dailyWindowId: string | null;
}

export async function consumeAiImageQuota(
  userId: string,
): Promise<AiQuotaClaim> {
  if (process.env.NODE_ENV !== "production") {
    return {
      userId,
      remaining: DAILY_LIMIT,
      hourlyWindowId: null,
      dailyWindowId: null,
    };
  }

  const hourly = await rateLimitDAL.consume(
    hourlyKey(userId),
    HOURLY_LIMIT,
    HOURLY_WINDOW_SECONDS,
  );
  if (!hourly.allowed) throw new RateLimitedError(hourly.retryAfterSeconds);

  const daily = await rateLimitDAL.consume(
    dailyKey(userId),
    DAILY_LIMIT,
    DAILY_WINDOW_SECONDS,
  );
  if (!daily.allowed) {
    // Hitting the daily cap shouldn't also spend an hourly hit.
    await rateLimitDAL.refund(hourlyKey(userId), hourly.windowId);
    if (daily.count === DAILY_LIMIT + 1) {
      // First rejection in this window only (Decision 3).
      await sendOpsAlert({
        event: "ai_image_daily_budget_exceeded",
        message: `User ${userId} hit the daily AI image-analysis budget (${DAILY_LIMIT}/day)`,
        metadata: { userId },
        sendEmailAlert: false,
      }).catch(() => {});
    }
    throw new RateLimitedError(
      daily.retryAfterSeconds,
      "Daily AI image-analysis budget reached. Try again tomorrow.",
    );
  }

  return {
    userId,
    remaining: Math.min(hourly.remaining, daily.remaining),
    hourlyWindowId: hourly.windowId,
    dailyWindowId: daily.windowId,
  };
}

/**
 * Gives back what `claim` took, in the windows it took it from. Call only
 * when the OpenAI call did not complete (Decision 4); never for a refusal,
 * a content-filter empty reply, or a low-confidence draft.
 */
export async function refundAiImageQuota(claim: AiQuotaClaim): Promise<void> {
  if (claim.hourlyWindowId) {
    await rateLimitDAL.refund(hourlyKey(claim.userId), claim.hourlyWindowId);
  }
  if (claim.dailyWindowId) {
    await rateLimitDAL.refund(dailyKey(claim.userId), claim.dailyWindowId);
  }
}
```

The `NODE_ENV !== "production"` gate matches `enforceRateLimit`'s existing
convention exactly (dev/test/e2e skip enforcement; Vercel preview/staging/prod
enforce). Note this is a change for local dev: the old in-memory limiter
enforced everywhere.

**Verify**: `bun run type-check` → exit 0. Rewrite
`src/lib/api/__tests__/ai-rate-limit.test.ts` (the old `Map`-based assertions
no longer apply): with `vi.stubEnv("NODE_ENV", "production")` and a mocked
`rateLimitDAL`, `consumeAiImageQuota` resolves with both window ids when
both buckets allow; throws `RateLimitedError` on an hourly rejection without
touching the daily bucket; on a daily rejection, throws, refunds the hourly
key **with the hourly window id**, and alerts only when `count === 31` (a
`count: 32` rejection doesn't alert); outside production neither bucket is
touched. `refundAiImageQuota` refunds each key with its own window id, and
does nothing for a claim with null ids.

### Step 3: The route — validate first, cap count/format/size, refund only uncompleted calls

Replace the schema (`route.ts:18-20`) with a normalizing, capped one:

```ts
import { MAX_AI_PHOTOS } from "@/features/listings/ai-listing-assistant/types";

/** Per image. Vercel rejects any request body over 4.5 MB before the route
 * runs, so this only needs to stop one image taking the whole budget. */
const MAX_IMAGE_BASE64_CHARS = 4_500_000;

/** The formats OpenAI vision accepts (HEIC/HEIF, AVIF, BMP, SVG are not). */
const DATA_URL_IMAGE_RE =
  /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/]+=*)$/i;

function isValidImageDataUrl(value: string): boolean {
  if (value.length > MAX_IMAGE_BASE64_CHARS + 32) return false; // before the regex
  const match = DATA_URL_IMAGE_RE.exec(value);
  return match !== null && match[2].length <= MAX_IMAGE_BASE64_CHARS;
}

const analyzeImageSchema = z
  .object({
    imageUrls: z.union([z.string(), z.array(z.string())]),
  })
  .transform((val, ctx) => {
    const urls = Array.isArray(val.imageUrls) ? val.imageUrls : [val.imageUrls];
    if (urls.length === 0 || urls.length > MAX_AI_PHOTOS) {
      ctx.addIssue({
        code: "custom",
        message: `imageUrls must have between 1 and ${MAX_AI_PHOTOS} images`,
      });
      return z.NEVER;
    }
    if (!urls.every(isValidImageDataUrl)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Each image must be a jpeg/png/webp/gif data: URL under the size cap",
      });
      return z.NEVER;
    }
    return { imageUrls: urls };
  });
```

(zod is `^4.4.3`: `code: "custom"`, not the deprecated `z.ZodIssueCode`.)

This caps the array (Decision 1) and rejects anything that isn't a
`data:image/...;base64,...` URL, so this route never fetches an arbitrary
`http(s)` host and there's no allowlist to maintain. On web, a HEIC/AVIF/BMP
pick now gets a 400 from us instead of an OpenAI error. Both map to the
same "server" failure copy (`mapHttpStatusToReason`), so nothing regresses.

Reorder the handler (Decision 5): auth → **parse and validate the body** →
`consumeAiImageQuota` → categories → OpenAI. A validation failure returns
400 with nothing consumed, so it no longer needs a refund:

```ts
let claim: AiQuotaClaim | null = null;
let openAiCompleted = false;
// ... after requireAuthResponse/getCurrentUserId:
const body = await parseFormData(request);
const validationResult = analyzeImageSchema.safeParse(body);
if (!validationResult.success) {
  return NextResponse.json(
    { error: "Validation failed", details: validationResult.error.flatten() },
    { status: 400 },
  );
}
photoCount = validationResult.data.imageUrls.length;

try {
  claim = await consumeAiImageQuota(userId);
} catch (error) {
  if (error instanceof RateLimitedError) outcome = "rate_limited";
  throw error; // → outer catch → handleApiError → 429 + Retry-After
}
rateLimitTokensRemaining = claim.remaining;

const categories = await listingDAL.getListingCategories();
const result = await analyzeListingImage(validationResult.data.imageUrls, {
  categoryNames: categories.map((c) => c.name),
  conditionEnum: CANONICAL_CONDITION_ENUM,
});
openAiCompleted = true; // billed from here on (Decision 4)
```

(Imports: `consumeAiImageQuota`, `refundAiImageQuota`, `type AiQuotaClaim`
from `@/lib/api/ai-rate-limit`; `RateLimitedError` from `@/dal/errors`;
`captureNonCriticalError` from `@/lib/api/route-helpers`.) Remove the old
manual `NextResponse.json({error: "rate_limited"}, {status: 429})` branch. The outer `catch`/`handleApiError` now handles it (R-ARCH-07
maps `RateLimitedError` to `429 {error, code: "RATE_LIMITED"}` +
`Retry-After`), like every other rate-limited route.

**Remove the refund from the `refused` branch and the low-confidence
branch.** Both calls were billed. Delete the `refund(consumedUserId);
consumedUserId = null;` lines before each `return`; nothing else in either
branch changes.

The outer `catch` refunds only a call that never completed:

```ts
} catch (error) {
  if (claim && !openAiCompleted) {
    await refundAiImageQuota(claim).catch(captureNonCriticalError);
  }
  return handleApiError(error);
}
```

`consumedUserId` goes away. Hoist a `let loggedUserId: string | null = null`
next to the other `let`s, set it right after `getCurrentUserId()`, and log it
in the `finally` as `userId`, so every path including 400 and 429 is
attributed. `userId` itself is scoped inside the `try`.

In `analyze-listing-image.ts`, make the post-billing empty reply a
refusal instead of a throw, so it is charged like one:

```ts
const message = res.choices[0]?.message?.content;
// Null content = a content-filtered completion. OpenAI billed it; it's a
// refusal, not an infra error (SEC-14).
if (!message) return { kind: "refused", raw: "" };
```

**Verify**: `bun run type-check` → exit 0.

### Step 4: `detail: "low"` on the vision call

In `analyze-listing-image.ts`, cut per-image token cost:

```ts
...urls.map((url) => ({
  type: "image_url" as const,
  image_url: { url, detail: "low" as const },
})),
```

**Verify**: `bun run type-check` → exit 0. Extend
`analyze-listing-image.test.ts` (or add a minimal one if none exists,
mocking the OpenAI client per this file's existing test conventions): the
built `chat.completions.create` payload's `image_url` parts each include
`detail: "low"`.

### Step 5: Route tests

Rewrite `src/app/api/listings/analyze-image/route.test.ts` **and update
`route.logging.test.ts`**. Both mock `@/lib/api/ai-rate-limit`; switch them
to `consumeAiImageQuota`/`refundAiImageQuota`, and in the logging test
assert `userId` instead of `consumedUserId`.

- `MAX_AI_PHOTOS + 1` (6) `data:image/jpeg;base64,...` URLs → 400; no
  OpenAI call; `consumeAiImageQuota` **not called** (validation runs first).
- A non-`data:` URL (`https://evil.example/x.jpg`) → 400; a
  `data:image/heic;base64,...` → 400; `data:image/svg+xml;base64,...` → 400.
- An oversized image (`"data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_BASE64_CHARS + 1)`)
  → 400.
- A model refusal (`result.kind === "refused"`) → 200 with
  `failureKind: "unsuitable_content"`, and `refundAiImageQuota` is **not**
  called (the SEC-14 regression test; the old code refunded here).
- A low-confidence draft → 200 with `data: null`, no refund.
- `analyzeListingImage` throwing (OpenAI API error, never completed) →
  `refundAiImageQuota` called with the claim; `handleApiError` maps the error.
- `listingDAL.getListingCategories` throwing after consume → refunded.
- `consumeAiImageQuota` rejecting with `RateLimitedError` → 429 with
  `{error, code: "RATE_LIMITED"}` and a `Retry-After` header, and
  `analyzeListingImage` not called.

In `analyze-listing-image.test.ts`: a completion whose `message.content` is
`null` returns `{ kind: "refused" }` instead of throwing.

**Verify**: `bun run test:run src/app/api/listings/analyze-image src/services/openai` → all pass.

### Step 6: Full regression

**Verify**: `bun run test:run` → all pass.

## Test plan

Covered inline per step: **real-DB** tests for `RateLimitDAL.refund`'s
window-aware WHERE, including a forced window reset between consume and
refund (Step 1; a WHERE clause needs a real DB); the two-bucket
consume/refund/alert wrapper unit-tested with a mocked DAL (Step 2); the
route's validate-before-consume ordering, count/format/size validation, and
refund-only-uncompleted behavior (Step 3, pinned in Step 5); the `detail:
"low"` payload shape and null-content → `refused` (Steps 3-4).
`consume`'s own atomicity is R-ARCH-07's existing real-DB test; this plan
only adds two returned columns. Full regression: `bun run test:run` +
`bun run test:integration`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; `bun run test:integration` → exit 0
- [ ] A refund whose window has since reset is a no-op (real-DB test)
- [ ] An invalid body never touches a quota bucket (test)
- [ ] More than `MAX_AI_PHOTOS` images, a non-`data:` URL, or an oversized
      image all return 400 without calling OpenAI (test)
- [ ] A model refusal, a null-content (content-filtered) reply, or a
      low-confidence result does **not** refund quota (test) — the core
      SEC-14 fix
- [ ] The first daily-budget rejection in a window sends one
      `ai_image_daily_budget_exceeded` ops alert (later ones don't) and
      refunds the hourly hit it just spent (test)
- [ ] The rate limiter is durable across instances (reuses `RateLimitDAL`;
      `ai-rate-limit.ts` holds no module state)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2, "OpenAI cost controls")

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- A legitimate caller is found sending a non-`data:` URL (re-run the greps in
  Current state before assuming neither client does) — if one exists, the
  host-allowlist half of the original recommendation needs adding back for
  that caller instead of the blanket `data:`-only rule.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

**No contract change.** `analyzeImageResponseSchema`
(`hoador-mobile/src/api/contract/ai-draft.contract.ts`) already models only
the success body; a 429 never reaches it. Confirmed by reading the actual
call site, not just the contract file's comment:
`hoador-mobile/src/features/listings/hooks/use-ai-assistant.ts:43` —
`if (error.status === 429) return 'rate_limited';` — classification is by
HTTP status alone, so the body changing from `{error: "rate_limited"}` to
`{error, code: "RATE_LIMITED"}` (via `RateLimitedError`/`handleApiError`, the
same shape every other `enforceRateLimit`-backed route already returns)
needs no app change. The 400 validation responses for count/size/format are
likewise unread beyond status by both clients (`use-analyze-listing-draft.ts`'s
`mapHttpStatusToReason` on web is the same status-only pattern). Mobile always
sends `data:image/jpeg` (`native/upload.ts:193`) and caps at its own
`MAX_AI_PHOTOS = 5` (`ai-assistant-state.ts:18`), equal to the server's, so
no shipped binary trips the new 400s. **Don't lower the server constant
below 5** without a mobile release first. Old binaries hard-code it.

**Behavior change users will notice (Decision 4):** a refusal or
low-confidence result now spends quota, so a user who retries unsuitable
photos reaches the app's existing "rate limited" state sooner (10/hour,
30/day). No app copy promises that failures are free (grep for "count
against" etc. finds nothing), so there's no copy to change.

Add this row to the roadmap's Mobile client follow-ups table (comment only;
the executor can't edit the mobile repo):

| Fix      | Contract change                                                                                                                             | Where the app sees it | Mobile task | Status                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R-SEC-14 | 429 body is now `{ error, code: "RATE_LIMITED" }` + `Retry-After` (was `{ error: "rate_limited" }`); classification by status is unaffected | AI listing assistant  | —           | TODO (comment only): update `ai-draft.contract.ts:13`'s header to the new 429 shape and note that refusals/low-confidence now spend quota. |

## Production cutover

No migration, no new environment variable, no new secret — this plan reuses
the `rate_limit_buckets` table and `BLOB`/Stripe-unrelated existing
infrastructure entirely. No row needed in `13-production-cutover.md`.

## Maintenance notes

- `RATE_LIMITS`-style constants for this feature live in `ai-rate-limit.ts`
  itself rather than `src/constants/rate-limits.ts` (where R-ARCH-07 put
  its own) — kept local since this plan is the only consumer; if a future
  plan wants one shared constants file for every `enforceRateLimit`-backed
  limit, moving these two is a pure refactor.
- The upload-rate-limit TODO on `listings/[listingId]/route.ts` (noted by
  R-ARCH-07's Maintenance notes as "now a one-line follow-up") is unrelated
  to this route and still not done — a good next small plan if image-upload
  abuse becomes a concern.
- If OpenAI's vision pricing or `detail` semantics change, re-check whether
  `"low"` still gives an acceptable analysis quality/cost trade-off for this
  feature before assuming the constant is still right.
