# StudioCreation — Full Project Breakdown (as of 2026-06-12)

> Purpose of this document: a complete, honest snapshot of what we've built,
> the decisions behind it, and where it's fragile — written to be fed to an
> outside AI reviewer. **Reviewer: your job is to challenge this, not
> summarize it.** Specific challenge prompts are at the end.
>
> **STATUS NOTE (2026-06-14):** This is a historical build narrative.
> Where it differs from `CLAUDE.md`, **CLAUDE.md is authoritative.** Two areas
> have since changed: (1) the **Higgsfield-hybrid** path described below was
> dropped — the studio is **fal-only** (no MCP, no web-UI handoff, no credit
> ledger); `scripts/hf_pull.sh` and `app/handoff/page.tsx` were removed.
> (2) the skill roster was renamed — see the corrected list in §"Employees".

---

## 1. What this is

StudioCreation is a self-hosted creative production engine for a small team
(roughly 1 builder + a handful of creatives). It generates images and video
via fal.ai's model marketplace, governs spend with hard budget caps, reviews
output through a quality gate, and archives everything both in the cloud and
on a local machine.

It replaced a Higgsfield-subscription workflow. The thesis: **own the
tooling, route to the best model per job, pay per-use, keep every asset and
every dollar in our own ledger.** Higgsfield is being sunset by Jul 4, 2026
(log-only legacy until then).

Primary use case feeding it: short-form social/brand content — notably
"StarXI" (a figurine-style brand with 96 nation characters needing identity
consistency across shots) and "StrikeLab" (technical golf aesthetic).

## 2. Operating philosophy (the "house rules")

These are enforced by the app and by agent instructions (CLAUDE.md):

1. **Preflight always.** Every billable generation shows a dollar estimate
   from `config/pricing.json` before submit. Approving a plan ≠ approving
   the spend.
2. **Quality-max routing.** Concept/ideation on cheap models (FLUX schnell
   $0.004/img, Wan 2.5 $0.05/s); deliverables only on top-tier models
   (GPT Image 2, Nano Banana Pro, Seedance 2.0, Kling 3.0 Pro). Cheap
   models are for finding the idea, never for shipping.
3. **Everything lands in the archive.** Cloud originals → Vercel Blob;
   a sync script mirrors to local `assets/<project>/<date>/<time>_<model>_<label>.<ext>`
   plus an append-only `manifest.jsonl`. Local machine = permanent archive,
   cloud = working surface. Nothing lives only in a provider's library.
4. **One variable per iteration.** Failed draft → change one thing
   (subject/camera/light/motion), regenerate cheap, re-review.
5. **Quality gate before money.** No hero render, upscale, or delivery
   without a scored review: Hook / Composition / Motion integrity /
   Brand DNA / Finish, each 0–2, pass ≥ 8/10. Video reviewed via extracted
   still frames (ffmpeg), never from memory.
6. **Brand profiles, not hard-coded brands.** Editable presets (palette,
   character style, tone, chroma rules, style strings) selected at
   generate time. Brand-DNA drift = automatic gate failure.

## 3. Budget law (governed in-app, stored in DB, defaults in config)

- Monthly team pool: **$120** (hard stop)
- Daily shared cap: **$7.50** (hard stop)
- Per-job confirm threshold: **>$1.25** requires explicit confirmation
- Per-operator daily guide: **$5** (soft, banner-only)
- Warning thresholds: heads-up at 60%, warning + cheap-model suggestion at 85%
- Roles: creative/producer can generate; finance/admin edit caps (role
  picked at login, shared password — no per-user auth)
- Current fal prepaid balance: **~$70** (finite; app must recommend top-ups
  when the approved queue exceeds balance)
- A nightly reconciler pulls fal billing events and flags estimate-vs-actual
  drift per model.

## 4. Architecture

**Stack:** Next.js 15 (App Router) + React 19 + TypeScript, deployed on
Vercel (Hobby tier, push-to-deploy from `main`). Neon Postgres (free tier,
raw SQL via `@neondatabase/serverless` — no ORM). Vercel Blob for media.
fal.ai via `@fal-ai/client` with queue + webhooks (public URL makes webhooks
the completion signal; no polling loops).

**Flow:** Generate panel → cost preflight → budget gates → fal queue submit
→ fal webhook on completion → media copied to Vercel Blob → `assets` row in
Postgres → appears in gallery → review/score → approve → Finalize Center
(Topaz 4K upscale, fps choice, platform crops via generated ffmpeg recipes
at $0) → delivered.

**Pages:** generate panel (`/`), preset workflows (`/workflows`), gallery
with asset lifecycle (new → approved/flagged/hidden → delivered), Finalize
Center (`/deliver`), costs dashboard (`/costs`), budget governance
(`/settings`), batch-brief runner (`/briefs` — markdown shot tables →
queued jobs), Higgsfield handoff page (`/handoff`, legacy).

**Database (3 tables):** `jobs` (the spend ledger: model, prompt, params,
est_usd, actual_usd, operator, project, status, finish-lineage), `assets`
(blob_url, score 0–10, status lifecycle, tags, approval), `settings`
(JSONB budget config editable by governor roles).

**Dual ledger:** Postgres is the queryable index; `assets/manifest.jsonl`
on the local machine is the append-only File-Law log. MCP-driven jobs
(generations done by Claude Code/Cursor agents via hosted fal MCP) enter
via shell scripts (`fal_pull.sh`) that download the file and append a
manifest row, then an import endpoint pushes manifest rows into Postgres.
`studio_sync.sh` pulls cloud assets down to local File-Law folders.

**Auth:** ~20-line shared-password middleware (HMAC-signed cookie), operator
name + role picked at login. Real per-user auth (Clerk) explicitly deferred.

**"Employees":** the studio ships **9 selectable creative roles** plus **2
system skills**, all as `.claude/skills/*/SKILL.md` that double as picker
presets in the app. Current roster (corrected 2026-06-14):
premium-motion-designer, some-strategist, graphic-designer, video-editor,
concept-artist, audio-engineer, product-photographer, keynote-designer,
upscaler (the 9 creative roles); prompt-optimizer and quality-gate carry
`system: true` and are filtered out of the role picker (`lib/skills.ts`). The
app parses their frontmatter (default model, style string, ratio); the same
files instruct AI agents working in the repo. One source, two consumers.

**Agent division of labor:** Claude Code owns batches/subagents/overnight
queues; Cursor owns editing briefs/skills/scripts and one-off generations.
Both must preflight from pricing.json and log via the pull scripts.

## 5. Model router & economics

Single source of truth `config/pricing.json`. Current lineup (USD):

| Job | Concept tier | Hero tier |
|---|---|---|
| Image | FLUX schnell $0.004 | GPT Image 2 $0.01–0.41 by quality · Nano Banana Pro $0.15/$0.30 4K · Nano Banana 2 $0.08/$0.16 4K |
| Image edit/refs | — | GPT Image 2 edit (≤10 reference images) |
| Video | Wan 2.5 $0.05/s · Kling 2.5 Turbo Pro $0.07/s | Kling 3.0 Pro $0.14/s ($0.21 w/ audio) · Seedance 2.0 $0.3034/s · Veo 3.1 fast $0.10/s ($0.15 w/ audio) |
| Consistency | — | Seedance 2.0 reference-to-video $0.3024/s (9 imgs + 3 vids + 3 audio refs, `@Image1` syntax) |
| Finishing | — | Topaz video upscale $0.08/s 4K · Topaz image $0.08 · Recraft crisp $0.004 |

Character consistency pipeline: GPT Image 2 reference sheets → Seedance 2.0
reference-to-video. This is the load-bearing answer to "96 figurines must
not morph between shots."

**Cost scenarios modeled at planning time (monthly):**
- LIGHT (100 img, 20 draft clips, 5 hero clips): all-fal ≈ $16
- STANDARD (500 img, 100 drafts, 20 heroes): all-fal ≈ $73
- HEAVY (2,000 img, 500 drafts, 60 heroes): all-fal ≈ $295 — exceeds both
  the $70 balance and the $120/month pool; requires explicit top-up decision.

**The Higgsfield decision (war-room, 14–1):** stay hybrid (free Higgsfield
web-UI drafts + fal heroes) until Jul 4, then full fal. The one dissent
(FinOps): hybrid hides manual web-UI labor cost that the ledger never sees.
Kill-criteria for flipping early: fair-use throttling, passive credit drain
>50/week, a fal-only model we need, or the date. Flip-back criteria: fal
prices rise >25% or fal failure rate >5%.

## 6. Current state — honest assessment

**Working and deployed (committed, sessions 1–7):** fal adapter with
queue/webhooks, generate with full budget gating, Postgres + Blob lifecycle,
gallery with scoring/status, costs dashboard, nightly reconcile cron,
manifest import, brief batch runner, Higgsfield handoff, skills-based
employee picker, shared-password auth.

**Built locally but NOT committed (significant):** the entire v2 layer —
Finalize Center (`/deliver`), settings governance (`/settings`), workflows
presets, finish API, accuracy API, `config/budget.json`,
`config/modelParams.json`, **and an entire parallel Vite SPA in `web/`**
(React Router 7 + Zustand + Motion, richer UI, proxies to the Next.js API).
Two UIs now exist for the same backend; the SPA is untracked in git and not
deployed.

**Known gaps / debt:**
- **Zero tests.** No unit, integration, or e2e tests anywhere. No CI.
- **Two parallel UIs** with no decided winner (Next.js pages vs Vite SPA).
- Shared password + honor-system roles; anyone with the password can pick
  "admin" at login.
- GitHub repo was public at planning time (flagged, unclear if flipped).
- `.env.example` documents only 1 of ~6 required env vars.
- ffmpeg exports are copy-paste commands, not executed server-side.
- Quality-gate scoring is a number field on assets; the rubric itself
  (5 axes, 0–2 each) lives only in a skill doc, not in the UI.
- `hf_pull.sh` references a missing `gallery.py`.
- Single maintainer; mitigation is "every session ends deployed" + fully
  managed infra (nothing to operate).
- Usage so far: 4 test images, 1 example brief. The system is built ahead
  of its real production load.

**Top risks as we see them:** fal spend creep (mitigated by gates),
model churn (mitigated by pricing.json + adapter), scope creep (the OUT
list is law: no per-user auth, no editing suite, no mobile, no LoRA
training until at least August), single-maintainer burnout, Higgsfield
fair-use loss (already absorbed — heroes routed to fal).

---

## 7. Reviewer: challenge these

Don't be polite. Specifically attack:

1. **The premise.** Is a custom-built studio app the right call for a
   ~$120/month generation budget and a tiny team, vs. just using fal's
   own UI / an off-the-shelf tool and a spreadsheet? At what spend level
   does this build pay for itself, counting maintainer hours?
2. **The dual ledger.** Postgres + manifest.jsonl + sync scripts + import
   endpoints is a lot of moving parts for "remember what we made and what
   it cost." Is File Law (local Finder-browsable archive as source of
   truth) worth this complexity, or is it nostalgia?
3. **The two-UI fork.** A parallel Vite SPA was built instead of evolving
   the deployed Next.js UI. Is this a healthy rewrite or classic
   single-maintainer scope drift that violates our own "OUT list is law"
   rule?
4. **Quality-max routing.** Does the concept-cheap / hero-expensive split
   actually hold in practice, or does it double work (every shot made
   twice)? Is the $1.25 confirm threshold calibrated to anything real?
5. **The budget law itself.** $120/month pool vs a $70 prepaid balance vs
   a HEAVY scenario at $295 — are the caps coherent with the ambition, or
   will the first real campaign immediately demand exceptions that erode
   the whole governance story?
6. **Skills-as-employees.** Is parsing SKILL.md frontmatter into a UI
   picker a clever single-source design, or a coupling that breaks the
   moment the app and the agent workflows need different things?
7. **No tests, no CI, raw SQL, shared password.** Which of these is
   actually fine at this scale, and which is the one that bites first?
8. **The Jul 4 fal pivot.** The FinOps dissent said hybrid hides labor
   cost. Was the 14–1 majority right? And does going all-in on one
   aggregator (fal) recreate the same platform dependency we just left
   Higgsfield to escape?
9. **What's missing entirely.** Audio/music pipeline is local-ffmpeg only;
   no LLM-in-the-loop prompt optimization in-app (delegated to agents);
   no team review/comments on assets; no delivery tracking beyond a status
   flag. Which absence will hurt first given the short-form social use case?
10. **Sequencing.** Given 4 test images of real usage, what should the
    next 2 weeks actually be: committing/consolidating v2, shipping real
    campaigns to stress the system, or cutting features?
