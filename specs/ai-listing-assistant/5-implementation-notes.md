# AI Listing Assistant — Implementation Notes

This document is the handoff from spec to code. It pulls the implementation-critical bits out of `1-requirements.md`, `2-design.md`, `3-tasks.md`, and `4-test-plan.md` and adds anything that came up while writing this phase. It does not restate everything in those documents — read them.

## Summary

We are productionizing the existing gpt-4o image-analysis prototype into the live create-listing flow at [src/app/dashboard/listings/add/page.tsx](src/app/dashboard/listings/add/page.tsx). A new modal anchored to the create-listing page offers Choice → (Manual closes / AI continues in same modal). The same modal hosts photo guidance, photo staging, the explicit "Generate Listing Draft" trigger, the processing experience, and any error/recovery messaging. On success the modal dissolves into the underlying form, which has been remounted with AI-prefilled values plus a persistent draft notice, a highly visible Safety Notes disclaimer, and per-field "AI Suggested" badges.

**No DB schema changes. No new dependencies. No fork of the listing form.** The AI system is purely a prefill/orchestration layer in front of the unchanged validation + admin-approval pipeline.

## Refinement decided during this phase

While reviewing test-page compatibility, one small refinement to `2-design.md`:

- **Add `categoryName: string | null` to `AiDraft`** alongside `categoryId`. The route resolves both. The form prefill uses `categoryId`; the existing [test-image-upload page](src/app/test-image-upload/page.tsx) reads `categoryName` for display; the modal's evidence callouts use `categoryName` for the human-readable claim. Three consumers, one canonical resolved value. This is the cleanest fix to the test-page compat note in `2-design.md` §Decisions point 3.

Update the `AiDraft` type in Task 1.1 accordingly. All other docs are unaffected.

## File structure (new and modified)

### New files

```
src/features/listings/ai-listing-assistant/
  types.ts                                  # Task 1.1
  ai-draft-to-initial-values.ts             # Task 1.3 + 1.4
  ai-draft-to-initial-values.test.ts
  __fixtures__/
    aiDraft.full.ts                         # Task fixtures
    aiDraft.minimal.ts
    aiDraft.lowConfidence.ts
    categories.fixture.ts
    openaiResponse.dewalt.json
    openaiResponse.excellentLegacy.json
    openaiResponse.unknownCategory.json
    openaiResponse.malformed.txt

src/features/listings/hooks/
  use-analyze-listing-draft.ts              # Task 3.1
  use-analyze-listing-draft.test.ts

src/features/listings/components/ai-listing-assistant/
  ai-listing-assistant-modal.tsx            # Task 5.5
  ai-listing-assistant-modal.test.tsx
  choice-view.tsx                           # Task 5.1
  choice-view.test.tsx
  instructions-view.tsx                     # Task 5.2
  instructions-view.test.tsx
  processing-view.tsx                       # Task 5.3
  processing-view.test.tsx
  error-view.tsx                            # Task 5.4
  error-view.test.tsx
  modal-state.ts                            # Task 4.1
  modal-state.test.ts
  use-simulated-steps.ts                    # Task 3.3
  use-simulated-steps.test.ts

src/features/listings/components/listing-form/
  create-listing-client.tsx                 # Task 8.1
  create-listing-client.test.tsx
  ai-prefill-context.tsx                    # Task 6.1
  ai-prefill-context.test.tsx
  draft-notice.tsx                          # Task 6.2
  draft-notice.test.tsx
  safety-disclaimer.tsx                     # Task 6.3
  safety-disclaimer.test.tsx
  ai-suggested-badge.tsx                    # Task 6.4
  ai-suggested-badge.test.tsx

src/services/openai/
  resolve-ai-draft.ts                       # Task 1.2
  resolve-ai-draft.test.ts

src/lib/api/
  ai-rate-limit.ts                          # Task 2.2
  ai-rate-limit.test.ts

src/app/api/listings/analyze-image/
  route.test.ts                             # Task 2.4

e2e/
  ai-listing-assistant.spec.ts              # Tasks 10.1–10.4
  fixtures/ai-listing-assistant/
    full-tool.jpg
    model-sticker.jpg
    condition.jpg
```

### Modified files

```
src/services/openai/analyze-tool-image.ts            # Task 2.1 (signature + prompt rewrite)
src/app/api/listings/analyze-image/route.ts          # Task 2.3 (resolver + rate limit + contract)
src/app/dashboard/listings/add/page.tsx              # Task 8.2 (render orchestrator)
src/features/listings/components/listing-form/
  add-listing-form.tsx                               # Tasks 7.1, 7.2, 7.3
  basic-information-section.tsx                      # Task 7.5
  additional-details-section.tsx                     # Tasks 7.4, 7.5
src/features/listings/hooks/use-listing-form-submit.ts  # Task 9.2 (extend submit event)
src/app/test-image-upload/page.tsx                   # Task 11.1 (compat only if needed; categoryName still on AiDraft)
```

## Naming conventions

- **Filenames**: kebab-case (`use-simulated-steps.ts`, `create-listing-client.tsx`) — project standard.
- **React components**: PascalCase (`AILIstingAssistantModal`, `DraftNotice`).
- **Hooks**: camelCase, `use`-prefixed.
- **Types/Interfaces**: PascalCase (`AiDraft`, `ModalState`, `AiFailureReason`).
- **Test files**: co-located `*.test.ts` / `*.test.tsx`.
- **Fixtures**: `__fixtures__/` directory under the closest feature folder.
- **Analytics events**: `snake_case` with a `listing_` prefix (`listing_ai_generation_started`), matching existing project conventions.
- **Server log fields**: `camelCase` keys (already standard via `withRequestLogging`).
- **Discriminated-union tags**: `kind` for state, `reason` for error union — applied consistently.

## Coding standards

Follow [.ai/AI-coding-standards.md](.ai/AI-coding-standards.md). The specific points worth re-emphasizing for this feature:

- **No comments** in new code unless documenting a non-obvious _why_ (the WHY behind the simulated-steps tail behavior is one such; the `categoryName` addition is another). Don't comment what the code does.
- **No backwards-compat shims**. The analyze route's response shape changes — update the one internal consumer (the test page) rather than maintaining the old shape.
- **Validate at boundaries, not inside trusted code**: the analyze route validates raw OpenAI output with Zod (`RawAiResponseSchema.safeParse`). Downstream code trusts the `AiDraft` shape.
- **Don't add error handling for things that can't happen**. The modal reducer doesn't need to handle "what if BEGIN_GENERATE fires from Choice" beyond returning `state` — no logging, no warning toast.
- **No unused exports**. Each new file exports only what's consumed externally.
- **Server-only code stays server-only**. `analyze-tool-image.ts`, `resolve-ai-draft.ts`, `ai-rate-limit.ts`, and the route file must not be imported from any client module.

## TDD approach

The TDD strategy per task is set in [4-test-plan.md](specs/ai-listing-assistant/4-test-plan.md) §"TDD strategy by layer". The short version:

- **Strict TDD** for pure utilities, the rate limiter, the simulated-steps hook, and the modal reducer (Tasks 1.2, 1.3, 1.4, 2.2, 3.3, 4.1).
- **Tests alongside** for the analyze hook, the analyze route, and the orchestrator (Tasks 2.3, 2.4, 3.1, 3.2, 8.1).
- **Tests after** for UI components, form integration, telemetry, and E2E (Tasks 5.x, 6.2–6.4, 7.x, 8.2, 9.x, 10.x).
- **No test** for cleanup/verification (Tasks 11.x).

Reference: [.ai/AI-tdd-methodology.md](.ai/AI-tdd-methodology.md). The red-green-refactor discipline applies only inside the Strict TDD bucket; the rest is behavior-test discipline, not ritual.

## Error handling approach

- **Server**: throws from `analyzeToolImage` flow through the existing `handleApiError`. Validation/parse failures map to `200 { success: true, data: null }` — the low-confidence path is intentionally not a 4xx/5xx because it represents a successful call with a useless result. Rate-limit denial is `429`. The rate-limiter token is consumed only when the response carries a valid `AiDraft` — failures, parse-misses, and OpenAI errors refund.
- **Client hook**: maps HTTP status and `data: null` to `AiFailureReason` (`rate_limited | network | server | low_confidence`). All other code, including views, switches on `reason`, never on raw status codes or message strings.
- **User-facing copy**: never mentions OpenAI, gpt-4o, multimodal inference, status codes, or raw error text (Req 6.3, Req 9.1). Each `AiFailureReason` has a single canonical user-facing message stored in the modal sub-views.

## Logging and monitoring

- **Per analyze-route request**: use the existing `withRequestLogging` wrapper. Log `{ userId, photoCount, latencyMs, rateLimitTokensRemaining, parseSucceeded, categoryResolved, conditionResolved }` (see `2-design.md` §Telemetry).
- **Sentry**: unexpected errors flow through the existing `sentry.server.config.ts`. No new Sentry tagging is required, but tag scope `feature: "ai-listing-assistant"` to make filtering easier (this is a one-line addition at the route).
- **Client analytics**: emit the event list from `2-design.md` §Telemetry. Use the existing analytics client; do not introduce a new layer. Event names follow `listing_ai_*` for new events; the existing listing-submit event is _extended_ (Task 9.2) rather than replaced.
- **What we are deliberately not logging**: the raw OpenAI response (image content + identifying detail), the staged image bytes, or full prompts. Log shape metadata (`photoCount`, `categoryResolved`, `parseSucceeded`) instead.

## Implementation checklist (sequenced epics)

This is the dependency-aware order from `3-tasks.md`; treat it as the merge plan.

- [ ] **Epic 1**: shared types + pure utilities — unblocks everything else.
- [ ] **Epic 2**: OpenAI service + analyze route + rate limiter — unblocks the client hook.
- [ ] **Epic 3**: client analyze hook + simulated steps — unblocks the modal.
- [ ] **Epic 4**: modal reducer — unblocks modal composition.
- [ ] **Epics 5 and 6 in parallel**: modal sub-views + form-side primitives. These are independent.
- [ ] **Epic 7**: integrate primitives into `AddListingForm`.
- [ ] **Epic 8**: orchestrator + swap page.
- [ ] **Epic 9**: telemetry wiring across modal/orchestrator/submit.
- [ ] **Epic 10**: E2E.
- [ ] **Epic 11**: cleanup + compat verification.

A single engineer can land this in roughly the order above; two engineers can split at Epics 5/6 and rejoin at 7. Don't start Epic 7 before 6 lands — Form-side primitives are imported by the form integration.

## Gotchas and known challenges

1. **`useListingForm` initial-values precedence.** `useListingForm` spreads `defaultValues` and then `initialValues`. If `aiDraftToInitialValues` includes a key with value `undefined`, it will clobber the form default (e.g. `condition: undefined` would clear "good"). The mapping in Task 1.3 conditionally includes keys _only when non-null_, but anyone editing that helper later must preserve this invariant. There is a test for it.

2. **`URL.createObjectURL` lifecycle across modal → form handoff.** The modal creates object URLs for previews. When images transfer to the form (success or cancel), the form's PhotosSection creates its own previews from `File` objects. The modal must revoke its URLs on dismiss/unmount; the form section must not assume the URLs persist. Verify no leak with the existing photos-section image lifecycle behavior.

3. **Form remount via `formKey` resets dirty state and focus.** Acceptable in our case (the user couldn't have interacted with the form during the modal flow), but if a future change allows partial form interaction during the AI flow, the remount strategy must change. Document the assumption in `create-listing-client.tsx` as a `// WHY:` comment.

4. **Photos-first reorder may affect existing tests.** The `specs/listings/4-test-plan.md` and `4-e2e-test-plan.md` may have selectors depending on section order. Run the full listings test suite after Task 7.2 and update any broken selectors. This is not a regression — it is a deliberate visible change.

5. **Existing `/test-image-upload` page reads `categoryName`.** Now satisfied via the `categoryName` addition to `AiDraft` (see §Refinement). Re-verify after Task 2.3 lands; if the page expected non-null `name`/`description` it should be updated to tolerate `data: null` for low-confidence runs.

6. **Rate limiter is in-memory, single-instance.** On Vercel autoscale or multi-region this would not enforce the limit globally. For MVP this is acceptable; the per-modal-session UI guard plus per-user UI session bounds the practical blast radius. Flagged for the shared-store migration as a follow-up.

7. **Test isolation for the rate limiter.** Tests _must_ call `__resetForTests()` in `beforeEach`. A leaked token from one test breaks the next. Add a lint or a `beforeEach` in the limiter spec's setup file.

8. **Mobile camera capture attribute.** The `capture` attribute on `<input type="file">` is honored differently across iOS Safari and Android Chrome. Test on both per the manual checklist in `4-test-plan.md` §I.

9. **Simulated steps must not delay the network call.** The temptation is to chain "show steps, then call fetch." Don't — start the fetch immediately on `BEGIN_GENERATE` and run the ticker in parallel. Otherwise the user pays the simulated-step time on every generation.

10. **Evidence callouts run _after_ the AI response, not during.** They are conditional on AiDraft contents and render in the modal's success-tail (just before close). Do not script "we found a model number" as a fixed step in `useSimulatedSteps` — it would lie when the model is null.

11. **Sentry replay / session capture of staged images.** Staged photos are in client memory only and aren't sent to Sentry, but if a session replay tool is installed in the project, confirm images are masked. (Project standard already covers this; not adding new redaction.)

## Open items (deliberately deferred)

These are _not_ in MVP scope but are tracked here so they don't get lost:

- **Optional Safety Notes acknowledgment checkbox.** Flagged in `1-requirements.md` Assumptions and `2-design.md` §Open. Add when legal/product asks for it; ~half a day.
- **Rate-limiter migration to a shared store** (Upstash or similar). Required if/when we scale beyond a single Vercel region or want the limit to survive function cold starts.
- **Telemetry event-name reconciliation.** Event names listed in `2-design.md` and reused here are indicative. Confirm against the project's existing analytics naming convention during Task 9.1 and rename in one pass if needed — but do it consistently across the orchestrator, modal, and submit extension.
- **Per-draft rate-limit token.** True one-shot enforcement requires server-issued draft IDs. Not needed for MVP; add if abuse appears.

## Where to look first if something is wrong

- **AI returns invalid condition** → check `resolve-ai-draft.ts` and the prompt template in `analyze-tool-image.ts`. The prompt now injects the canonical enum dynamically.
- **AI suggests a category that doesn't exist** → check the category fetch in the route handler. The DAL should return only `isActive=true` categories.
- **Modal won't close after generation** → likely the orchestrator's `formKey` is not incrementing, or `modalDismissedThisSession` isn't being set. Test G in `4-test-plan.md` covers this.
- **Banner appears in the manual flow** → `aiPrefilledFields` is being passed as a non-empty array somewhere. Trace from `CreateListingClient`.
- **Form validation rejects an AI-prefilled value** → either the AiDraft included a value the form's Zod schema doesn't accept (likely a coercion miss in `resolveAiDraft`) or the form's enum drifted. Source of truth for both is the same Zod schema; if they have drifted, the constant export in `types.ts` is wrong.
- **Rate-limit denying valid users** → check `__resetForTests` is not being called outside test mode; check `refund()` is being invoked on every non-success branch in the route handler.

Implementation can begin once these notes are approved.
