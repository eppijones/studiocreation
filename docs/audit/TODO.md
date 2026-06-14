# TODO — prioritized, self-contained

Scope discipline: **DO NOW** = surgical, verifiable, completable in this session without
your taste/credentials. **BACKLOG** = needs a product decision, design taste, an external
account, or is a multi-day feature. Anything touching CLAUDE.md's constitution is flagged.

---

## DO NOW (this session)

- [x] **Configure ESLint (flat config)** so `pnpm lint` runs non-interactively and is clean.
      Verification gates require a clean lint. _(eslint.config.mjs + `lint`/`typecheck`/`test` scripts)_
- [x] **Silence the workspace-root build warning** — set `turbopack.root`/`outputFileTracingRoot`
      in `next.config.ts` to this repo so a stray `~/package-lock.json` can't mislead tracing.
- [x] **Add a test runner + unit tests for the money/correctness core** (vitest, `@/` alias):
      `lib/pricing.ts` (`estimate`, `coerceSeconds`, `defaultSeconds`, ratios/constraints),
      `lib/providers/falInput.ts` (`buildFalInput`, `falEndpoint`), `lib/budget.ts` (`levelFor`
      via projection helper), `lib/eta.ts`. Pure functions → no external calls.
- [x] **Harden permanent delete (P2):** gate `DELETE /api/assets/[id]` so `creative` role can
      only hide (non-destructive), while `producer`/`finance`/`admin` may hard-delete; record the
      operator on the server log line. Make the gallery degrade cleanly on a 403.
- [x] **Cinema camera-control modifiers (P1 feature):** add a tasteful lens / shot-size /
      camera-move / lighting modifier rack to the Create composer that appends to the prompt via
      the existing `styleSuffix` pipeline (works for image + video, $0, on-pattern with Motion
      presets and brand style). Film + social both win.
- [x] **Reconcile docs with reality:** fix `BREAKDOWN.md` stale skill list; add a "superseded —
      CLAUDE.md is authoritative" banner to `PLAN.md`/`BREAKDOWN.md` where they describe the
      removed Higgsfield-hybrid / daily-cap / `hf_pull.sh` (preserve history per guardrails).

## VERIFY (gate — all must pass)
- [x] `pnpm build` ✅, `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test` ✅.
- [x] App boots; exercise touched surfaces happy-path + one error path (over-budget 403,
      empty prompt, creative-delete 403, illegal model param clamp).
- [x] No secret in client bundle / logs / network URLs / committed files.
- [x] Mobile sanity at ~390px for touched screens.

---

## BACKLOG (needs your taste / credentials / external accounts)

### Product decisions
- **B1 — Provider fallback (Higgsfield MCP).** The mission asks for fal ↔ Higgsfield routing,
  but **CLAUDE.md §2 explicitly forbids any Higgsfield path** (fal-only, dollars). These
  conflict. _Need from you:_ confirm whether to (a) keep fal-only per the constitution
  [recommended — flagged in SIGN_OFF], or (b) amend CLAUDE.md and add a second `Provider`
  implementation. The `Provider` interface already abstracts this; no rework needed to add one.
- **B2 — Speed-to-publish (direct post to TikTok/IG/YouTube).** Needs OAuth apps + tokens and
  is arguably out of scope vs CLAUDE.md's "deliver, don't publish." _Need:_ go/no-go + creds.

### Film/TV features
- **B3 — Storyboard → N discrete sequenced shots** with continuity notes (replace the single
  grid image), feeding the brief runner. (Design + build.)
- **B4 — Lipsync studio** — add a lipsync model to `config/pricing.json` + a UI flow (audio
  ref + video/portrait). _Need:_ pick the fal lipsync endpoint(s) to standardize on.
- **B5 — Color/LUT/grade step** in `/deliver` (ffmpeg LUT apply at $0 + optional AI grade).
- **B6 — Reference-sheet generator** (turnaround / expression sheet) as a first-class concept
  artist output + character bible persistence.
- **B7 — In-app multi-shot timeline assembly** (stitch approved shots; today it's an ffmpeg skill).
- **B8 — Start/end-frame control** for models that support it.

### Social features
- **B9 — Named platform presets + viral preset chains** in `/deliver` and a new composer chain
  (TikTok/Reels/Shorts intent, one-action multi-format). _Need:_ which platforms/specs to ship first.
- **B10 — Burned-in captions / auto-subtitles** in the finishing pipeline (whisper transcript +
  ffmpeg burn). _Need:_ transcription approach (local vs API) — has a cost implication.
- **B11 — A/B "make 3 hook variants" preset.**

### UX / platform
- [x] **B12 — Job cancel** end-to-end — DONE (continuation). Provider `cancelJob` + `POST
  /api/jobs/[id]`, `canceled` status (race-safe, budget-excluded), Cancel buttons in queue + Create.
- [x] **B13 — `/roles` discovery page** — DONE (continuation). Lists the cast + `?role=` preselect +
  nav entry. _(First-run onboarding tour still open — see below.)_
- **B13b — First-run onboarding tour** (dismissible "roles → create → queue → review → deliver").
- **B14 — Full mobile/responsive pass** at 390px across all 13 screens.
- **B15 — Accessibility pass** (skip link, focus rings, non-colour status, axe-core audit).
- **B16 — Workflow node editor** (outputs feed inputs) — the big Open-Gen-AI "Workflow Studio."
- **B17 — Real brand "formula"** (replace the demo stub in `app/brands/page.tsx` with a model call).

### Engineering hardening (low risk, deferred for focused review)
- **B18 — Reference-URL allowlist** to the studio Blob host in `/api/generate` `cleanUrls`.
- **B19 — Server-side reference-duration validation** on `/api/uploads`.
- **B20 — Client fetch timeouts + manual retry** affordance; replace `window.confirm()` with the
  app modal in gallery/deliver.
- **B21 — Session token expiry** (HMAC payload currently has no timestamp; 1-year cookie).
