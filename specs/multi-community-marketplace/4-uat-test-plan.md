# UAT Test Plan: Multi-Community Marketplace Expansion

## Document control

| Field             | Value                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Feature           | Multi-community marketplace (networks, visibility, admin verification) |
| Related PRD       | [1-requirements.md](./1-requirements.md)                               |
| Related design    | [2-design.md](./2-design.md)                                           |
| Engineering tests | [4-test-plan.md](./4-test-plan.md)                                     |
| Intended use      | Pre-release **User Acceptance Testing** (business / QA / support)      |

**Revision history**

| Version | Date | Notes                                   |
| ------- | ---- | --------------------------------------- |
| 1.0     | —    | Initial UAT plan                        |
| 1.1     | —    | Expanded scenarios, matrices, templates |

---

## 1. Purpose and audience

This document defines **what to validate manually** so stakeholders can
accept the release. It complements automated testing: unit, integration, and
E2E tests de-risk regressions; **UAT proves the product behaves correctly for
real users, admins, and operations** under plausible data and workflows.

**Primary readers**

- Product owner / PM (acceptance authority)
- QA engineers executing scripted checks
- Support and operations (verification queue runbook alignment)
- Engineering (triage of UAT defects vs spec gaps)

**Out of scope for this document**

- Writing or maintaining automated tests (see [4-test-plan.md](./4-test-plan.md))
- Load testing at extreme scale
- Legal or compliance sign-off unless referenced by your org separately

---

## 2. References

| Document                                                       | Use in UAT                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| [1-requirements.md](./1-requirements.md)                       | Authoritative acceptance criteria (`R#`)                         |
| [2-design.md](./2-design.md)                                   | Intended UX, API shapes, data model mental model                 |
| [3-tasks.md](./3-tasks.md)                                     | Implementation task IDs if defects need routing                  |
| [5-implementation-notes.md](./5-implementation-notes.md)       | Gotchas (symmetric visibility, cache invalidation, admin search) |
| [.ai/AI-bdd-methodology.md](../../.ai/AI-bdd-methodology.md)   | Scenario wording conventions                                     |
| [.ai/AI-coding-standards.md](../../.ai/AI-coding-standards.md) | Engineering quality bar (indirect)                               |

---

## 3. Glossary (UAT language)

| Term                            | Meaning for testers                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary (home) community**    | The one membership with `is_primary = true`; not self-service changeable in MVP                                                                                                                       |
| **Network**                     | Regional grouping (e.g. Kansas City Metro). Cross-community discovery is scoped by network membership                                                                                                 |
| **Community visibility**        | Per-user, per-community switch; **symmetric**: off = you do not see that community's listings, and your listings in that community are not shown to anyone                                            |
| **Home community of a listing** | `listings.community_id` / `service_listings.community_id` — the single community a listing surfaces through. A listing shows only when **both** its owner and the viewer have that community visible. |
| **Pending verification**        | Trust badge state; **must not** block marketplace actions in MVP                                                                                                                                      |
| **Legacy join code**            | Admin-issued code path; still supported alongside `/community-select`                                                                                                                                 |

---

## 4. UAT scope

### 4.1 In scope

- **Auth routing:** `email_verified` users land on `/community-select`;
  legacy `/join-code` still works when reached deliberately
- **Community select UX:** list population, filter (if present), request
  community, link to private invite
- **Onboarding:** address capture; membership stays pending until admin
  verifies unless legacy join-code path pre-trusts
- **Profile:** pending verification badge; visibility settings card
- **Marketplace discovery:** tool listings **and** service listings obey the
  same per-community visibility rule (a listing shows only when its home
  community is visible to both the owner and the viewer); each listing
  appears once
- **Filtering:** metro-wide vs community-specific behavior **as exposed in UI**
- **Admin:** pending verifications queue (verify, deny + notes); community list /
  edit including `network_id`, `is_active`, optional lat/lng
- **Post-migration sanity:** existing users behave as backfilled (verified
  primary, visibility rows present) — spot-check only

### 4.2 Explicitly out of scope (defer / do not file as UAT failures)

- Polygon residency proof, map browsing, PostGIS
- Self-service primary community change
- Per-listing visibility overrides
- Full **networks** admin product (dropdown on community edit only)
- Server-side community autocomplete at huge scale
- “Distance” as improved ranking (MVP may show placeholders)

---

## 5. Entry and exit criteria

### 5.1 Entry criteria (start UAT)

| ID   | Gate                                             | Expected evidence                                                                  |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| EN-1 | Release candidate deployed to agreed environment | URL + build identifier recorded                                                    |
| EN-2 | DB migrations applied                            | Schema matches [1-requirements.md R10](./1-requirements.md) intent                 |
| EN-3 | Critical automation green                        | Sign-off from engineering on [4-test-plan.md](./4-test-plan.md) “must ship” subset |
| EN-4 | Seed / prod-like data available                  | At least KC Metro network + communities; optional Test Network for join-code       |
| EN-5 | Accounts provisioned                             | Admin, two residents, fresh signup inbox                                           |
| EN-6 | Support briefed                                  | How deny works; users may need support to correct address (MVP)                    |

### 5.2 Exit criteria (approve release)

| ID   | Gate                                                                          |
| ---- | ----------------------------------------------------------------------------- |
| EX-1 | All **P0** scenarios **Pass**                                                 |
| EX-2 | **P1** failures either **fixed** or **explicitly waived** with owner sign-off |
| EX-3 | Open defects triaged: remaining work assigned to hotfix vs follow-up          |
| EX-4 | Sign-off table (§20) complete                                                 |

### 5.3 Severity definitions (for UAT defects)

| Severity | Definition                                                                                                                    | Example                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **P0**   | Ship blocker: security hole, data loss risk, user stuck unable to complete signup, or marketplace entirely wrong              | Non-admin performs verify; infinite redirect; primary hidden |
| **P1**   | Major wrong behavior: listings visible when they should not be; wrong empty state hiding real inventory; admin queue unusable | Symmetric visibility broken; duplicate listings clutter feed |
| **P2**   | Incorrect but workaround exists: confusing copy, minor layout, slow but tolerable                                             | Tooltip unclear; filter label ambiguous                      |
| **P3**   | Nice-to-have polish                                                                                                           | Typos, cosmetic spacing                                      |

---

## 6. Roles and responsibilities

| Role                    | Responsibilities                                                       |
| ----------------------- | ---------------------------------------------------------------------- |
| **UAT lead (QA)**       | Schedule, environment, test data, daily defect triage, coverage report |
| **Product**             | Accept/waive P1s, clarify expected UX, approve copy                    |
| **Support lead**        | Validate runbook for verify/deny and resident communications           |
| **Engineering liaison** | Confirms defect reproducibility, estimates fixes, advises data setup   |

---

## 7. Environment and configuration checklist

Complete before **Suite A** begins. Store values in your run log, not in this repo.

| ID    | Check                                                                         | Pass? |
| ----- | ----------------------------------------------------------------------------- | ----- |
| CFG-1 | Base URL (staging / pre-prod) documented                                      |       |
| CFG-2 | Email delivery works (verification links received)                            |       |
| CFG-3 | Admin can sign in to `/admin/dashboard/users`                                 |       |
| CFG-4 | Image / asset hosts allow test environment (no broken avatars blocking flows) |       |
| CFG-5 | Test payment or messaging toggles documented (“payments in/out of UAT scope”) |       |
| CFG-6 | Browser matrix chosen (see §16)                                               |       |

---

## 8. Test data specification

### 8.1 Required entities

| Entity                                    | Minimum                    | Purpose                       |
| ----------------------------------------- | -------------------------- | ----------------------------- |
| Network “Kansas City Metro”               | 1                          | Canonical new-user list       |
| Active communities in network             | ≥ 8 (or match env seed)    | Selection + visibility lists  |
| Test Network + join-code community        | 1 code (if testing legacy) | UAT-2                         |
| Fresh email alias                         | 1                          | Full signup                   |
| Resident A (primary community **Alpha**)  | 1                          | Visibility toggles + browse   |
| Resident B (primary **Beta**)             | 1                          | Symmetric visibility pairwise |
| At least one listing owned by A, one by B | 2+                         | Feed correctness              |
| At least one **service** listing          | 1                          | Parity with tools             |
| Pending verification user                 | 1                          | Badge + queue                 |
| Admin user                                | 1                          | Queue + community CRUD        |

Replace **Alpha** / **Beta** with real seeded community names in your log.

### 8.2 Naming convention for run logs

Use stable handles: `UAT-RESIDENT-A`, `UAT-RESIDENT-B`, `UAT-ADMIN-01`,
`UAT-FRESH-SIGNUP-01`.

---

## 9. Business rules checklist (quick validation)

Tick during exploratory passes; any **fail** is at least **P1**.

| ID   | Rule                                                                                                                                                          | Req                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| BR-1 | Exactly one primary community per user (conceptually — user never picks two)                                                                                  | R3                      |
| BR-2 | Primary community visibility cannot be turned off                                                                                                             | R4.5                    |
| BR-3 | Pending verification does **not** block browse / list / message / rent                                                                                        | R2.7                    |
| BR-4 | A listing appears only when **both** its owner and the viewer have the listing's home community (`community_id`) visible                                      | R5, R8.1                |
| BR-5 | Turning community X off removes every listing whose `community_id = X` from your search **and** removes your `community_id = X` listings from everyone else's | R5.7, R5.8, R8.1–R8.2   |
| BR-6 | Legacy join-code creates trusted primary (verified) per design                                                                                                | R1.5, design            |
| BR-7 | Inactive community not selectable at signup                                                                                                                   | R1 + service validation |
| BR-8 | Deny requires admin notes                                                                                                                                     | R9.1                    |

---

## 10. Detailed UAT suites

**How to record results:** For each **Case ID**, capture **Pass / Fail / Blocked**,
build ID, tester, date, notes, screenshot link. Use §19 templates.

---

### Suite A — Signup, routing, and community selection

| Case ID | Preconditions                            | Steps                                                        | Expected results                                                                                     | Req         |
| ------- | ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------- |
| A-01    | Clean browser session; new email         | Register; complete email verification                        | User reaches `/community-select` (or equivalent); URL not permanently stuck on legacy join-code only | R1, R11     |
| A-02    | On `/community-select`                   | Open community control; observe list                         | All **active** KC Metro communities appear; none duplicated obviously                                | R1.2        |
| A-03    | On `/community-select`                   | If filter/search exists, type mixed-case substring of a name | Matching communities remain; non-matching hidden                                                     | R1.7        |
| A-04    | On `/community-select`                   | Select a community; submit                                   | Redirect to `/onboarding`; no duplicate submit creating error loop                                   | R1.3, R11.3 |
| A-05    | User `email_verified`; no primary chosen | Manually navigate to `/dashboard` or `/onboarding`           | Middleware sends user to `/community-select` (or documented gate)                                    | R1.6, R11   |
| A-06    | On `/community-select`                   | Trigger “request your community” / HOA inquiry               | Modal or flow opens; can cancel without breaking session                                             | R1.4        |
| A-07    | On `/community-select`                   | Follow “private invite code” link                            | `/join-code` loads                                                                                   | R1.5        |
| A-08    | After A-04                               | Complete onboarding                                          | Lands on dashboard (or next expected step); session coherent after refresh                           | R11         |
| A-09    | User mid-funnel                          | Log out; log back in                                         | Resume path sensible: not trapped; no orphaned half-state blocking                                   | R11         |

**Negative / abuse cases (Suite A)**

| Case ID | Steps                                            | Expected                                            |
| ------- | ------------------------------------------------ | --------------------------------------------------- |
| A-N1    | Double-click Continue rapidly                    | Single primary membership; no 500 spam              |
| A-N2    | Browser Back from onboarding to community select | No invalid duplicate primary; UI handles gracefully |
| A-N3    | Submit without selecting community (if possible) | Validation prevents progress                        |

---

### Suite B — Legacy join-code path

| Case ID | Preconditions                         | Steps                           | Expected results                                                                                   | Req         |
| ------- | ------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| B-01    | `email_verified` user without primary | Open `/join-code` directly      | Page reachable; not redirected away incorrectly                                                    | R11.2       |
| B-02    | Valid code                            | Enter valid code; submit        | Membership created; continues to onboarding or dashboard per product                               | R1.5        |
| B-03    | Invalid code                          | Enter garbage code              | Error message; user can retry; DB not obviously corrupted                                          | R1.5        |
| B-04    | After B-02                            | Inspect profile primary / badge | Legacy path user aligns with **pre-trusted** design (no erroneous “pending” if spec says verified) | Design §7.3 |

---

### Suite C — Onboarding, profile, and pending badge

| Case ID | Preconditions                                       | Steps                                                 | Expected results                                             | Req                                                                  |
| ------- | --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| C-01    | New user post community select                      | Enter full address; submit                            | Address persisted; profile or settings show coherent address | R2.1–R2.2                                                            |
| C-02    | Membership pending                                  | Open `/dashboard/profile`                             | Visible **pending verification** badge or indicator          | R2.6                                                                 |
| C-03    | Pending user                                        | Browse explore; open listing detail                   | Access matches “no gate” policy                              | R2.7                                                                 |
| C-04    | Pending user                                        | Create listing / service (if product allows)          | Allowed                                                      | R2.7                                                                 |
| C-05    | Pending user                                        | Start conversation from listing (if in product scope) | Allowed per “messages tied to listing” model                 | See [1-requirements.md](./1-requirements.md) intro (messaging scope) |
| C-06    | Admin verifies membership (coordinate with Suite F) | Refresh profile as user                               | Badge clears; status looks verified                          | R2.4–R2.6                                                            |

---

### Suite D — Visibility settings (symmetric behavior)

Use **Resident A** unless noted.

| Case ID | Preconditions                | Steps                                       | Expected results                                                                                                                                                                                          | Req                    |
| ------- | ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D-01    | Logged in                    | Open profile → Community visibility section | Every network community listed; primary labeled / locked                                                                                                                                                  | R4.3, R4.5             |
| D-02    | D-01                         | Attempt to toggle primary off via UI        | Control disabled OR request rejected clearly; **cannot** persist off                                                                                                                                      | R4.5                   |
| D-03    | Choose non-primary **Gamma** | Toggle **Gamma** off; Save                  | Success feedback; after hard refresh, remains off                                                                                                                                                         | R4.3, R4.6             |
| D-04    | After D-03                   | Browse metro-wide feed                      | **Every** listing whose home community is **Gamma** is hidden from A — regardless of the owner's other communities; A's listings in other communities are unaffected; each remaining listing appears once | R4.4, R8.1, R5.7, R5.8 |
| D-05    | After D-03                   | If UI supports filter “community = Gamma”   | Empty, or messaging explains no access — not a misleading mixed feed                                                                                                                                      | R8.2                   |
| D-06    | D-05                         | Toggle **Gamma** on; Save                   | The Gamma listings reappear after navigation / refresh                                                                                                                                                    | R4.6                   |
| D-07    | Two-device sanity (optional) | Same user two browsers                      | Visibility card eventually consistent (may depend on cache — note behavior)                                                                                                                               | —                      |

**Pairwise matrix (high value, recommended)**

| Case ID | Setup                                                                                                  | Steps                       | Expected                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| D-P1    | Resident A and Resident B both visible in **Gamma**; B has a listing whose home community is **Gamma** | B lists the item; A browses | A sees B’s Gamma item while both are visible in Gamma                                                              |
| D-P2    | Continuation of D-P1                                                                                   | A turns off **Gamma**       | A no longer sees B’s Gamma listing (nor any Gamma listing); B no longer sees any of A’s Gamma listings — symmetric | R5.7, R5.8 |
| D-P3    | B’s listing whose home community is **Gamma**; A and B both visible in Gamma                           | A browses                   | **One** card for B’s listing in A’s feed (the visibility join is 1:1 with the listing)                             | R8.1       |

---

### Suite E — Tool and service listing discovery

| Case ID | Preconditions                                                                                                   | Steps                                                                           | Expected results                                                                                                                                                                | Req              |
| ------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| E-01    | Known listing owners                                                                                            | Open tool explore / search                                                      | Only listings whose home community is visible to both the owner and the viewer; ordering acceptable                                                                             | R8.1, R5         |
| E-02    | Known service listings                                                                                          | Open services browse / search                                                   | Same per-community visibility behavior as tools                                                                                                                                 | R8.4             |
| E-03    | Apply category / price filters                                                                                  | Combine with visibility                                                         | Filters still make sense; empty states honest                                                                                                                                   | R8.6             |
| E-04    | Pagination                                                                                                      | Page through results                                                            | No duplicates across pages; totals plausible                                                                                                                                    | R8.6             |
| E-05    | **Admin as shopper**                                                                                            | If admins use marketplace                                                       | Confirm whether admin bypasses visibility (design note: likely **no**); document actual behavior and raise if contrary to policy                                                | Impl notes §10.4 |
| E-06    | A listing visible in your feed                                                                                  | Click into its detail page, then start the booking/rent flow (tool and service) | Detail page **and** the booking/rent page open — clicking through a listing you can see never 404s                                                                              | R8.9             |
| E-07    | A listing whose home community **you** have toggled off; copy/deep-link its detail (and `/book` or `/rent`) URL | Open the URL directly (tool and service)                                        | `Not found` on the detail page and the booking/rent page — you cannot open or book a listing in a community you've hidden, even via a direct link                               | R8.9, R5.8       |
| E-08    | A listing whose home community **the owner** has toggled off; deep-link its detail URL                          | Open the URL directly                                                           | `Not found` for non-owners; the owner themselves can still open it                                                                                                              | R8.9, R5.7       |
| E-09    | A provider you share a visible community with vs. one you don't                                                 | Open `/dashboard/services/providers/[userId]` for each                          | Shared → profile loads, listings shown are only those in your shared visible communities. No overlap → `Not found`. Your own provider page always loads with all your listings. | R8.10            |

---

### Suite F — Admin: verification queue

| Case ID | Preconditions | Steps                                         | Expected results                                                  | Req              |
| ------- | ------------- | --------------------------------------------- | ----------------------------------------------------------------- | ---------------- |
| F-01    | Admin login   | Navigate to Users → Pending Verifications tab | Queue loads; rows show address + community + age                  | R9.1             |
| F-02    | F-01          | Sort / pagination if present                  | Oldest-first honored; stable UX                                   | R9.1             |
| F-03    | Choose row    | Open detail / dialog                          | Notes field usable                                                | R9.1             |
| F-04    | Row           | Click **Verify**                              | Row leaves queue; audit trail exists (engineering may confirm DB) | R2.5, R9.1, R9.5 |
| F-05    | Row           | Click **Deny**; enter notes; submit           | Row leaves or updates per UX; user status denied                  | R2.4, R9.1       |
| F-06    | Row           | Attempt **Deny** with empty notes             | Blocked with validation                                           | R9.1             |
| F-07    | Non-admin     | Open admin URL directly                       | 403 / redirect                                                    | R9.4             |

**Admin procedure alignment (manual residency check)**

Follow [1-requirements.md §R2 MVP Verification Procedure](./1-requirements.md):

1. Open submitted address.
2. Compare against maps / assessor / HOA proof as your org requires.
3. Verify → sets verified timestamp and admin id.
4. Deny → requires reason in notes.
5. Ambiguous → leave pending; document note (still non-blocking marketplace).

---

### Suite G — Admin: communities and network assignment

| Case ID | Preconditions         | Steps                                                       | Expected results                                                                                                 | Req        |
| ------- | --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| G-01    | Admin login           | Open Communities admin                                      | List shows communities; stats columns plausible if present                                                       | R9.2       |
| G-02    | Pick community        | Edit fields: display name, address, image, lat/lng optional | Saves; public/admin surfaces show updates as designed                                                            | R9.2, R7   |
| G-03    | G-02                  | Change **network** via dropdown                             | Saves; future signups / visibility init align with network membership                                            | R6, R9.2   |
| G-04    | Deactivate community  | Set `is_active` false (if exposed)                          | Community not offered on `/community-select`; existing users handled per product (document)                      | R6.5, R9.2 |
| G-05    | Reactivate            | Undo G-04                                                   | Community returns appropriately                                                                                  | R9.2       |
| G-06    | **Optional advanced** | Add brand-new community into existing metro network         | Engineering confirms visibility backfill job or migration ran (R4.9); residents see new toggle row after refresh | R4.9       |

---

### Suite H — Regression, resilience, and UX polish

| Case ID | Steps                                             | Expected                                                  |
| ------- | ------------------------------------------------- | --------------------------------------------------------- |
| H-01    | Deep link: active user visits `/community-select` | No erroneous second primary; friendly message or redirect |
| H-02    | Refresh during mutation (visibility save)         | Eventually consistent; no stuck spinners                  |
| H-03    | Slow network throttle (optional)                  | Loading states; no double charges / duplicate saves       |
| H-04    | Empty queue (admin)                               | Helpful empty state                                       |
| H-05    | No listings match visibility                      | User understands why (empty state copy)                   |

---

## 11. Truth table — symmetric visibility (teaching aid for testers)

Let **V(A,X)** mean user A has visibility **on** for community X. Listing L
owned by B is shown to A in context “community X” when product applies **both**:

- V(A,X) = on
- V(B,X) = on

If either is off, the listing must **not** appear for that slice.

| V(A,X) | V(B,X) | Expected: A sees B’s listing in X context |
| ------ | ------ | ----------------------------------------- |
| on     | on     | Yes                                       |
| on     | off    | No                                        |
| off    | on     | No                                        |
| off    | off    | No                                        |

---

## 12. Requirements traceability matrix (UAT case → PRD)

| Suite | Primary requirements       |
| ----- | -------------------------- |
| A     | R1, R11, R13               |
| B     | R1.5, R11.2                |
| C     | R2, R3, R11.4              |
| D     | R4, R5, R8                 |
| E     | R5, R8, R14 (subjective)   |
| F     | R2.4–R2.6, R9.1, R9.4–R9.5 |
| G     | R6, R7, R9.2, R4.9         |
| H     | R3, stability              |

---

## 13. Non-functional UAT notes

### 13.1 Performance (lightweight)

| Case ID | Action                              | Pass guideline                                                                                                                                 |
| ------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NF-1    | Cold load explore                   | Interactive < ~3s on throttled “fast 3G” **or** org’s standard                                                                                 |
| NF-2    | Change visibility + revisit explore | Updates within acceptable time; if delayed, note for engineering ([5-implementation-notes.md](./5-implementation-notes.md) cache invalidation) |

Formal budgets remain in **R14** / engineering `EXPLAIN` work.

### 13.2 Accessibility (spot)

| Case ID | Check                                                      |
| ------- | ---------------------------------------------------------- |
| AC-1    | Tab order through community select and visibility switches |
| AC-2    | Screen reader announces locked primary community           |
| AC-3    | Color contrast on pending badge                            |

---

## 14. Security and privacy spot checks

| Case ID | Check                                       | Expected                                           |
| ------- | ------------------------------------------- | -------------------------------------------------- |
| S-1     | Non-admin calls admin API (DevTools replay) | 403                                                |
| S-2     | User A cannot PATCH user B visibility       | Denied                                             |
| S-3     | PII in admin queue                          | Only exposed to admins; no leakage on public pages |

---

## 15. Post-migration / data integrity (staging smoke)

**Purpose:** catch catastrophic backfill mistakes before prod.

| Case ID | Check                                           | Note                                                      |
| ------- | ----------------------------------------------- | --------------------------------------------------------- | --- |
| M-1     | Sample legacy user (pre-release account)        | Has primary + visibility rows; marketplace usable         |
| M-2     | Count visibility rows vs communities in network | Order-of-magnitude plausible (engineering can supply SQL) |
| M-3     | `join_code` nullable                            | New community can omit code if business needs             | R10 |

---

## 16. Browser / device matrix (recommended minimum)

| Platform | Browser               | Suites to run |
| -------- | --------------------- | ------------- |
| Desktop  | Chrome (current)      | A–H           |
| Desktop  | Safari **or** Firefox | A, D, E       |
| Mobile   | iOS Safari            | A, D          |
| Mobile   | Chrome Android        | A, D          |

Adjust to your org standards.

---

## 17. Daily cadence suggestion (multi-day UAT)

| Day | Focus                           |
| --- | ------------------------------- |
| 1   | Suites A–C + data setup         |
| 2   | Suites D–E + pairwise           |
| 3   | Suites F–G + admin training     |
| 4   | Suite H + regression + sign-off |

---

## 18. Appendix A — BDD-style scenarios (readable narratives)

```gherkin
Feature: Community selection after email verification
  As a new resident
  I want to pick my community from the metro list
  So that I can onboard without a private code

  Scenario: Happy path to onboarding
    Given I have verified my email
    When I choose "Foxcroft" and continue
    Then I am sent to onboarding
    And I am not blocked from the dashboard later solely by pending verification

Feature: Symmetric visibility
  As a resident
  I want turning off a neighboring community to hide listings in both directions
  So that my privacy expectations match my settings

  Scenario: Hide a non-primary community
    Given my home community is Foxcroft
    When I turn off visibility for "Timber Trace" and save
    Then I do not see Timber Trace neighbors’ listings in my feed
    And my listings are not shown to them in Timber Trace context

Feature: Admin verification
  As a platform admin
  I want to verify or deny pending residency claims with notes
  So that trust signals are accurate

  Scenario: Deny requires documentation
    Given a pending membership in the queue
    When I attempt to deny without notes
    Then the application blocks me until I provide a reason
```

---

## 19. Templates

### 19.1 Defect report (copy per bug)

```
Title: [UAT] <short description>
Environment: <URL>
Build: <sha or version>
Case ID: <e.g. D-04>
Severity: P0 | P1 | P2 | P3
Steps:
1. ...
Expected:
Actual:
Screenshots / logs:
Requirement: R#.#
```

### 19.2 Suite result summary (end of day)

```
Date:
Tester:
Build:

Suite A: _ / _ passed
Suite B: _ / _ passed
Suite C: _ / _ passed
Suite D: _ / _ passed
Suite E: _ / _ passed
Suite F: _ / _ passed
Suite G: _ / _ passed
Suite H: _ / _ passed

Open P0: #
Open P1: #
Notes:
```

---

## 20. Sign-off

| Stakeholder | Responsibility                         | Name | Date |
| ----------- | -------------------------------------- | ---- | ---- |
| Product     | PRD behavior met or waivers documented |      |      |
| QA          | Suites executed; summary attached      |      |      |
| Support     | Queue procedure validated              |      |      |
| Engineering | Confirmed fixes / known issues         |      |      |

**Release decision:** Proceed only when **§5.2 Exit criteria** satisfied.

---

## 21. Relation to automated tests

Automated tests in [4-test-plan.md](./4-test-plan.md) cover many of the same
rules faster and repeatedly. **UAT remains necessary** because humans catch:

- Copy and comprehension issues
- Real-world admin judgment workflows
- Timing / cache / multi-tab behavior
- Cross-browser layout problems
- Product regret (“this feels wrong”) before code is “correct”

Do **not** treat passing automation as replacing §10 suites **F–G** (admin UX)
or pairwise visibility **D-P\***.
