# StudioCreation — Studio OS Audit

_Date: 2026-06-14 · Branch baseline: `fix/model-constraints-create` · Auditor: autonomous senior engagement (4 lenses)_

## 0. Headline

StudioCreation is a **genuinely mature, well-architected app**, not a prototype. The
engineering foundation is strong and several "blocker" suspicions did **not** hold up
under code reading (see §6, _Claims that did not survive verification_). The real work is
(a) a handful of correctness/hardening fixes, (b) tooling the repo was missing (lint
config, tests), (c) reconciling stale planning docs with the shipped reality, and (d) a
large, clearly-scoped feature backlog measured against the competitive references.

### Baseline build state (measured)

| Check | Result | Notes |
|---|---|---|
| `next build` | ✅ pass | All 13 routes + 19 API routes compile. |
| `tsc --noEmit` | ✅ pass (clean) | The transient `GalleryView` page-export error was a **stale `.next/types` artifact**; a fresh typecheck after build is clean. |
| `next lint` | ⚠️ not configured | Drops into interactive ESLint setup — there is **no ESLint config**, so lint never actually runs in CI/local. |
| Tests | ❌ none | No test runner, no test files, no `test` script. |
| Secrets hygiene | ✅ strong | `FAL_KEY`/`DATABASE_URL` server-only; client-bundle guards in `lib/db.ts:3`, `lib/providers/fal.ts:12`, `lib/settings.ts:4`; `.env*` gitignored; no secret in any JSON response. |
| Build warning | ⚠️ workspace root | A stray `~/package-lock.json` makes Next infer the wrong workspace root (`next.config.ts` sets no `outputFileTracingRoot`). |

---

## 1. Senior UI/UX Lead

### What's strong
- **Information architecture is clean and creative-first.** `app/components/AppShell.tsx:17` splits a primary rail (Showcase / Create / Brands / Gallery) from "go deeper" views (Overview / Generations / Costs / Settings) with an animated active-ink indicator and live badges (active jobs, needs-scoring).
- **Create→see→iterate loop is closed in one screen.** The composer lands its own render inline with Iterate / Animate-next-shot / Keep / Download actions (`app/create/page.tsx:1109` `ResultDock`), so an operator never has to hop to the gallery to react.
- **Budget is calm-by-default, loud-near-the-cap** — the composer only swells to the full fuel gauge past 75% (`app/create/page.tsx:898`); the rail always shows week %, team pool and run-rate projection.
- **Gallery review flow is excellent**: keyboard cull (`U`/`H`/`←`/`→`/`f`/`esc`), filmstrip, deep-linkable `/gallery/<id>`, drag-to-project organizer, bulk bar (`app/gallery/page.tsx`).
- **Honest feedback during long generations**: live progress bar + ETA capped at 96% until truly done (`app/components/JobProgress.tsx`), OS notification + chime on completion (`app/components/AppShell.tsx:65` `JobWatcher`).

### Gaps (severity · file)
- **P1 — No cancel for an in-flight job.** Queue and composer show progress but offer no "stop". A stuck/queued job can only be waited out. (`app/queue/page.tsx`, `app/components/JobProgress.tsx`)
- **P1 — "Nine employees" metaphor is under-surfaced.** Roles only appear as Create tiles; no home/onboarding mention, no `/roles` discovery, no one-line "these are preset specialist styles" explainer. A new user won't grasp the cast. (`app/create/page.tsx:679`)
- **P1 — No first-run / onboarding state.** No guided "roles → create → queue → review → deliver" tour for an empty studio.
- **P2 — Mobile/responsive unverified at ~390px.** The split layouts (gallery `224px 1fr`, deliver ffmpeg `<pre>` blocks) likely need stacking/overflow handling.
- **P2 — Accessibility gaps.** No skip-to-content link; some status is colour-only (pills/bars); deliver tag input focus is faint; home hero carousel lacks the keyboard support `Spotlight.tsx` already models.
- **P3 — Two destructive confirms use `window.confirm()`** (gallery delete, deliver) instead of the app's own modal pattern (`app/workflows/page.tsx` has the nicer takeover). Inconsistent.

---

## 2. Senior Frontend + Full-Stack Engineer

### What's strong
- **Single source of truth for the model registry.** `config/pricing.json` carries price **and** native constraints per model; `lib/pricing.ts` derives `ModelInfo`; the composer, `/api/generate`, and `lib/providers/falInput.ts` all re-validate from the same fields (`coerceSeconds`, `getModel`). The UI can't offer an illegal job and the server never trusts the client (`app/api/generate/route.ts:50`). This is the spine of the app and it's done right.
- **Provider abstraction exists.** `lib/providers/types.ts` defines a `Provider` interface (submit/status/queue/result); `falProvider` implements it. A second backend could slot in without touching call sites.
- **Job lifecycle is robust.** Submit → fal queue → **signature-verified webhook** (`lib/falWebhook.ts`, Ed25519 over JWKS, 300s replay window) **with a polling/reconcile fallback** (`lib/reconcileJobs.ts`). `completeJob` is **claim-atomic and idempotent** (`lib/jobs.ts:42`): a `finalizing_at` claim guarantees one finalizer, stored `source_url`s dedupe re-mirrors, and a zero-media result releases the claim to retry rather than marking an empty done.
- **Budget enforcement is real, not cosmetic.** `/api/generate` hard-stops on weekly cap and monthly pool (403), gates >$1.25 with a 402 `confirm_required`, and clamps every param server-side (`app/api/generate/route.ts:91`). `lib/budget.ts` computes shared week/month/operator spend with a run-rate projection. Same gates in `/api/finish` and `/api/briefs/run`.
- **Secrets hygiene is correct** (see §0).

### Gaps (severity · file)
- **P2 — Permanent asset delete has no role gate and no audit.** `DELETE /api/assets/[id]` (`app/api/assets/[id]/route.ts:69`) lets **any** authenticated role hard-delete the Blob + row with no record of who. Under File Law the archive is meant to be permanent; a junior `creative` shouldn't be able to nuke the library, and a deletion should be attributable. PATCH already records `approved_by`; delete records nothing.
- **P2 — No lint config.** `next lint` is interactive-only; lint is effectively off, so style/`no-explicit-any`/hooks-deps regressions can't be caught. (repo root)
- **P2 — No tests.** Pure, high-value logic (`estimate`, `coerceSeconds`, `buildFalInput`, `falEndpoint`, budget `levelFor`, eta) has zero coverage despite being the money/correctness core.
- **P3 — Workspace-root build warning** from a stray `~/package-lock.json`; `next.config.ts` sets no `outputFileTracingRoot`/`turbopack.root`.
- **P3 — Reference URLs are accepted as any `https://` URL** (`app/api/generate/route.ts:23` `cleanUrls`). These are forwarded to fal (fal fetches them, not our server, so this is not a self-SSRF), but tightening to the studio's own Blob host would prevent a client from steering spend toward arbitrary remote refs. Low risk; note only.
- **P3 — Server-side reference *duration* isn't re-validated on upload** (`app/api/uploads/route.ts`): type and size are enforced server-side, but clip length is only probed client-side. A long clip could slip past for a model with a `maxVideoSec` cap. Bounded by the 256 MB hard ceiling.
- **P3 — No client-side fetch timeouts / retry affordance.** Failed loads surface as silent empties or toasts; no manual retry.

---

## 3. Professional TV/Film Content Creator

### What's there
- Per-model **aspect** + **duration** controls with native envelopes (range vs discrete, snapped everywhere).
- **Multi-image reference** input (up to 9 img + 3 vid + 3 audio on Seedance reference-to-video; 10 on GPT edit), with `@Image1/@Vid1/@Aud1` handle hints wired to the prompt (`app/create/page.tsx:1346`).
- **Image→video bridge** ("Animate next shot" attaches a still and switches to the top i2v model).
- **Upscaling / finishing**: Topaz 4K video (fps interpolation 16–60) + Topaz/Recraft image, in the `/deliver` Finalize Center with platform-aspect ffmpeg export recipes at $0.
- **Brand-DNA lock** (palette/material/motion) appended to every shot of a sequence; concept-artist role for boards.
- **Continuity primitives**: Seedance reference-to-video + a "Character Pack" workflow + edit models.

### Gaps (severity)
- **P1 — No cinema camera-control modifiers.** No lens / focal-length / shot-size / aperture / camera-move vocabulary surfaced as prompt modifiers (the Open-Gen-AI "Cinema Studio" pattern). Only a small video-only "Motion" preset row exists. _(Addressed this session — see TODO DO-NOW.)_
- **P2 — Storyboard workflow yields one grid image, not N discrete, sequenced shots** with continuity notes (`app/workflows/page.tsx`).
- **P2 — No lipsync** model/flow anywhere in the registry or UI.
- **P2 — No color/LUT or grade step**; finishing is upscale + container export only.
- **P3 — No start/end-frame control** (only start-frame via i2v).
- **P3 — No multi-shot timeline assembly** in-app (briefs batch-queue but don't stitch; video-editor is an ffmpeg skill, not a UI pipeline).

---

## 4. Professional Social / SoMe Creator

### What's there
- some-strategist role (vertical, hook-first presets), 9:16 defaults for video, `/deliver` exports to 9:16/16:9/4:5/1:1/2.35:1.
- Batch variations via `numImages` (≤4) and the brief runner; "Quality Ladder" workflow.
- Brand kit with sub-brands.

### Gaps (severity)
- **P1 — No named platform presets** (TikTok / Reels / Shorts) — exports show raw dimensions, not platform intent (`app/deliver/page.tsx`).
- **P1 — No burned-in captions / subtitle burn** in the finishing pipeline.
- **P2 — No viral preset *chains*** (e.g. "15s + 30s + 60s vertical hooks, captions on" queued in one action).
- **P2 — No A/B "make 3 hook variants" one-click** beyond raw image count.
- **P3 — No speed-to-publish handoff** (direct post / scheduled publish) — out of scope vs CLAUDE.md but a competitive gap.

---

## 5. Docs ↔ reality drift

- **BREAKDOWN.md:102–104** lists picker presets that **no longer exist** (`reference-sheets, infographic-animator, typography-animator, vertical-social-formats, storyboard-moodboard, audio-master`). The real on-disk roster is the 9 creative skills + 2 system skills. _(Fixed this session.)_
- **PLAN.md** is a pre-build planning artifact describing a **Higgsfield-hybrid architecture, a hosted-MCP bridge, `scripts/hf_pull.sh`, and a daily $7.50 cap** — all superseded by CLAUDE.md (fal-only; no Higgsfield/MCP/handoff; weekly $50 / monthly $120). `scripts/hf_pull.sh` and `app/handoff/page.tsx` are deleted on this branch. _(Added a "superseded — see CLAUDE.md" banner this session; history preserved per guardrails.)_
- README.md / AGENTS.md are **current and accurate** ("9 studio employees", fal-only, File Law).
- The subagent recon referenced `INTEGRATION.md` / `SPEC_v1.md`; **these files do not exist** — those specific claims are discarded.

---

## 6. Claims that did NOT survive verification (recorded so they aren't re-litigated)

These were flagged by exploration but are **false on the actual code** — important to log so they don't get "fixed" into regressions:

- **"Webhook `jobId` param bypasses signature."** False. `verifyFalWebhook` runs first and 401s on failure (`app/api/webhooks/fal/route.ts:18`); `jobId` only selects the row *after* a valid fal signature, and a `request_id` cross-check guards mismatch (`:34`). The body is cryptographically signed by fal — unforgeable.
- **"Finish 60fps doubles cost *after* the budget check."** False. `est.usd *= 2` is at `app/api/finish/route.ts:57`, **before** the cap check at `:60`.
- **"Finish inserts the job before budget validation."** False. The cap/confirm gates (`:60`/`:63`) precede the insert (`:73`); failed submits are marked `error` and excluded from budget sums (`status != 'error'` in `lib/budget.ts:54`).
- **"Settings editable by non-finance."** False. `PUT /api/settings` enforces `GOVERNOR_ROLES` and 403s otherwise (`app/api/settings/route.ts:25`).
- **"Stale JWKS cache enables replay."** Overstated. A 300s timestamp tolerance (`lib/falWebhook.ts:7,37`) bounds replay; a 10-min key cache is standard.

---

## 7. Severity roll-up (verified)

| Sev | Count | Items |
|---|---|---|
| P0 | 0 | — |
| P1 | 6 | no job-cancel; nine-employees legibility; no first-run; no camera modifiers; no platform presets; no caption burn-in |
| P2 | ~9 | delete role/audit; no lint; no tests; mobile; a11y; storyboard→shots; lipsync; LUT/grade; viral chains |
| P3 | ~8 | workspace-root warning; ref-URL allowlist; upload duration check; fetch timeouts; window.confirm; start/end frame; timeline assembly; speed-to-publish |

See `GAP_MATRIX.md` for the competitive feature table and `TODO.md` for the DO-NOW / BACKLOG split.
