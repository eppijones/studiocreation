# SIGN_OFF — Studio OS audit & hardening engagement

_Date: 2026-06-14 · Branch: `studio-audit-fixes` (off `fix/model-constraints-create`) · 6 commits_

## What shipped this session

| # | Change | Type | Files |
|---|---|---|---|
| 1 | Audit artifacts (AUDIT, GAP_MATRIX, TODO) | docs | `docs/audit/*` |
| 2 | ESLint flat config + `lint`/`typecheck`/`test` scripts; pin workspace root; clean all violations | tooling/P2 | `eslint.config.mjs`, `next.config.ts`, `package.json` |
| 3 | Vitest suite — 36 DB-free tests over the money/correctness core | tests/P2 | `vitest.config.ts`, `test/*`, `lib/budget.ts` (export `levelFor`) |
| 4 | Permanent-delete role gate + audit line; client hides delete for creatives | security/P2 | `app/api/assets/[id]/route.ts`, `app/gallery/page.tsx` |
| 5 | Cinema camera-control prompt modifiers (shot/lens/light) in Create | feature/P1 | `app/create/page.tsx` |
| 6 | Reconcile BREAKDOWN/PLAN docs with shipped reality | docs | `BREAKDOWN.md`, `PLAN.md` |

### Continuation (after first sign-off, same session)
BACKLOG items pulled forward and shipped (build/typecheck/lint/test green):
- **B12 Job cancel** — cancel an in-flight job end-to-end (provider + API + `canceled` status + UI).
- **B13 `/roles` discovery page** — nine-employees cast made legible; `?role=` preselect.
- **B13b First-run onboarding banner** — dismissible flow nudge in the shell.
- **B15 Accessibility** — skip-to-content link + consistent keyboard focus ring.
- **B18 Reference-URL allowlist** — refs restricted to studio Blob/fal hosts.
- **B21 Session token expiry** — signed issued-at + 30-day window (+7 tests).

Together these resolve the UI/UX lens's top objections (job cancel, legibility, first-run) and two
deferred-hardening items. Remaining backlog is now either multi-day (workflow node editor,
storyboard→shots, timeline, reference-sheet generator, real brand formula), decision/credential-gated
(lipsync endpoint, caption transcription, platform-preset specifics, speed-to-publish OAuth), or
constitution-conflicting (Higgsfield provider) — see `TODO.md` for the crisp asks.

### ⚠️ Verification note (B21 side-effect)
The session-token change (B21) **invalidated the existing preview login** — exactly its intended
"re-authenticate once" behavior, and good evidence it works (the app correctly redirects to `/login`).
As a result, the **authenticated-shell UI shipped in the continuation** (onboarding banner, skip link,
cancel buttons, `/roles` while logged in) was verified by **build + typecheck + lint + tests + code
review**, and the CSS/markup was confirmed loaded on `/login`, but **not re-confirmed visually in the
authenticated shell** — re-auth requires entering the studio password, which I will not do (prohibited
action). Earlier (pre-B21) the camera rack, `/roles`, queue and create were visually verified live.
**To eyeball the rest, log in once.** Note also: a cold `rm -rf .next && next build` can hit a Next 15
webpack-cache flake (`index.pack_` ENOENT) on the first run; a retry builds clean — it is not a code defect.

### Verification (all green)
- `pnpm build` ✅ · `pnpm typecheck` ✅ · `pnpm lint` ✅ (0/0) · `pnpm test` ✅ (36/36)
- Fresh `next dev` boots clean: APIs return 200, **zero console errors**, no workspace-root warning.
- Camera feature exercised live in `/create`: rack expands (Shot/Lens/Light), chips toggle,
  "Camera · N" counter updates, selections append to the prompt preview, persists across re-render.
- Narrow-viewport check: Create role tiles + composer + camera rack stack cleanly (mobile sanity).
- Secrets: no `FAL_KEY`/`DATABASE_URL` in any client bundle, response, network URL, or commit
  (server-only guards intact; `.env*` gitignored).

### Error/edge paths covered
- Over-budget (weekly/monthly 403), confirm-gate (402), empty prompt (400), illegal model param
  (server clamp) — verified by code reading of `app/api/generate/route.ts` (already correct).
- Creative delete → 403 `delete_forbidden` (new), with the client surfacing a clear message and
  hiding the affordance. Verified by code + client logic; a live role-cookie run was not performed
  to avoid mutating shared preview/DB state.

---

## The four lenses

### 1. Senior UI/UX Lead — **APPROVE with objections**
The IA, budget legibility, gallery review flow, and the create→see→iterate loop are strong, and the
new camera rack adds real creative control on-pattern. **Remaining objections (BACKLOG):** no job
cancel; the nine-employees metaphor still needs first-run legibility (`/roles` + onboarding); a full
mobile pass at 390px and an accessibility pass (skip link, focus rings, non-colour status) are owed.

### 2. Senior Frontend + Full-Stack — **APPROVE**
Single-source model registry, provider abstraction, idempotent claim-atomic finalize, and real
budget enforcement are best-in-class. The repo now has a working lint gate and a test suite over the
money path, and the destructive-delete hole is closed and attributable. **Objection (flagged, not a
defect):** the mission's fal↔Higgsfield provider fallback is **deliberately not built** — it
contradicts CLAUDE.md §2 (see flag below). Minor deferred hardening (ref-URL allowlist, upload
duration check, token expiry) is enumerated in TODO BACKLOG.

### 3. Professional TV/Film creator — **APPROVE with objections**
Camera/lens/light modifiers, multi-image refs, i2v bridge, brand-DNA lock, and 4K finishing cover a
lot. **Remaining objections (BACKLOG):** storyboard→discrete-shots, lipsync, color/LUT grade,
start/end-frame, and in-app timeline assembly — all sizeable features requiring product decisions
and (lipsync) a chosen fal endpoint.

### 4. Professional Social/SoMe creator — **APPROVE with objections**
Vertical defaults, the some-strategist role, export aspects, and the camera rack help. **Remaining
objections (BACKLOG):** named platform presets (TikTok/Reels/Shorts), burned-in captions, viral
preset chains, and one-click A/B hook variants. Caption burn-in needs a transcription decision
(local vs API — cost implication).

---

## 🚩 Loud flags (per guardrails)

1. **Provider fallback contradicts the constitution.** The mission asks to keep generation
   "provider-agnostic across fal.ai and Higgsfield MCP," but **CLAUDE.md §2 explicitly forbids any
   Higgsfield path** ("no MCP, no web-UI handoff, no credit ledger; everything routes through fal in
   dollars"). I followed CLAUDE.md and did **not** build Higgsfield routing. The `Provider` interface
   (`lib/providers/types.ts`) already abstracts backends, so a second provider can be added later
   with no call-site rework **if** you decide to amend the constitution. _Decision needed: keep
   fal-only (recommended) or amend CLAUDE.md._

2. **Several exploration "P0/P1" findings were false** and are recorded in `AUDIT.md §6` so they
   aren't "fixed" into regressions (webhook jobId "bypass", finish 60fps ordering, settings role
   gate, JWKS replay). Nothing was changed based on them.

3. **Pre-existing uncommitted WIP.** The working tree had **extensive uncommitted WIP at session
   start** (the entire current app — most `app/`, `lib/`, new skills — was never committed on the
   base branch). My branch was cut from that WIP, so my commits **bundle pre-existing WIP for the
   files I touched** (notably `app/gallery/page.tsx`, `app/create/page.tsx`, `app/overview/page.tsx`,
   `app/components/Media.tsx`, `lib/budget.ts`, `app/api/assets/[id]/route.ts`). My commit messages
   describe only *my* changes. **Nothing was lost; `main` and the base branch are untouched; nothing
   was pushed.** Before merging, review `git diff fix/model-constraints-create..studio-audit-fixes`
   and decide how to land the WIP. The audit-specific edits are the ones enumerated in the table above.

---

## Assumptions made (senior calls, logged)

1. **fal-only is authoritative** over the mission's Higgsfield-fallback ask (CLAUDE.md wins). Flagged above.
2. **Delete = producer/finance/admin; creatives Hide only.** Chosen to protect the shared archive
   under File Law while keeping a non-destructive path for everyone. Server-enforced + UI-hidden.
3. **"9 employees" is correct** for the user-facing roster (9 creative roles; prompt-optimizer and
   quality-gate are `system: true` and intentionally hidden). Docs corrected to say so.
4. **Camera modifiers apply to both image and video** (camera/lens/light language helps stills too),
   and are **not persisted to localStorage** (per-shot creative choice; avoids touching the persist effect).
5. **Vitest + ESLint are acceptable new dev-deps** — the mission asks for tests and a clean lint gate,
   and the repo had neither.
6. **Historical docs are annotated, not rewritten** (PLAN/BREAKDOWN get "superseded" banners) to
   honor the no-history-rewrite guardrail while removing the contradiction.
7. **The transient `tsc` `GalleryView` error was a stale `.next/types` artifact**, not a real type
   error — confirmed by a clean post-build typecheck.
8. **`~/package-lock.json` is the user's and not deleted**; instead the workspace root is pinned in
   `next.config.ts` (non-destructive fix for the same warning).

---

## BACKLOG (what I need from you to unblock)

See `docs/audit/TODO.md` for the full list. The decisions that gate the biggest items:
- **B1 Provider fallback** → keep fal-only, or amend CLAUDE.md + add a provider impl?
- **B4 Lipsync** → which fal lipsync endpoint(s) to standardize on?
- **B9/B10 Platform presets + caption burn-in** → which platforms first; transcription local vs API (cost)?
- **B2 Speed-to-publish** → in scope vs CLAUDE.md's "deliver, don't publish"? needs OAuth creds.

Everything else in BACKLOG is buildable without you — scoped out of DO-NOW only to keep this session
verifiable in one pass (job cancel, onboarding/`/roles`, mobile pass, a11y pass, workflow node editor,
real brand formula, deferred hardening).
