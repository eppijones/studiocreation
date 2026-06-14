# Changelog

All notable changes to StudioCreation. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — studio-audit-fixes (2026-06-14)

Autonomous four-lens audit + hardening pass. See `docs/audit/` for the full
audit, gap matrix, TODO split, and sign-off.

### Added
- **Cinema camera-control modifiers** in the Create composer — shot size, lens,
  and lighting presets that append to the prompt (like brand style / motion),
  for both image and video. $0, pure prompt composition.
- **ESLint** (flat config: `next/core-web-vitals` + `next/typescript`) with
  `lint`, `typecheck`, and `test` package scripts — the repo now has a working
  quality gate it previously lacked.
- **Vitest** test suite (36 tests) covering the money/correctness core:
  pricing estimate + param coercion, fal input mapping + fast-lane routing,
  ETA banding, and the budget cap→level mapping.
- Audit artifacts under `docs/audit/` and a top-level `CHANGELOG.md`.

### Changed
- **Permanent asset delete is now role-gated** — `DELETE /api/assets/[id]`
  requires producer/finance/admin and logs the operator; creatives can only
  Hide. The gallery hides delete affordances for creatives and degrades cleanly
  on a 403.
- `next.config.ts` pins `outputFileTracingRoot`/`turbopack.root` to the repo,
  eliminating the wrong-workspace-root build warning caused by a stray parent
  lockfile.
- Internal Create links use `next/link` instead of `<a>`.
- Docs reconciled with reality: `BREAKDOWN.md` skill roster corrected (9 creative
  + 2 system) and `BREAKDOWN.md`/`PLAN.md` annotated as superseded by CLAUDE.md
  where they describe the removed Higgsfield-hybrid path and the old daily cap.
- `lib/budget.ts` exports `levelFor` for unit testing.

### Notes
- No behavior in CLAUDE.md's budget/model constitution was changed. The mission's
  fal↔Higgsfield provider-fallback expectation conflicts with CLAUDE.md (fal-only)
  and was intentionally not implemented — flagged in `docs/audit/SIGN_OFF.md`.
- The working tree carried extensive pre-existing uncommitted WIP at session start;
  this branch bundles it. `main` and the base branch are untouched. Review
  `git diff fix/model-constraints-create..studio-audit-fixes` before merging.
