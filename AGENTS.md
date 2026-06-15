# AGENTS.md — cross-tool entry point

**Source of truth: `CLAUDE.md`** (router, budget law, quality gates, brand
profiles). Read it first and obey it fully — it applies to every agent in
this repo (Claude Code, Cursor, Codex, or anything else).

- Skills live in `.claude/skills/<name>/SKILL.md` (open Agent Skills
  standard). Load the relevant skill before acting on its domain.
  Selectable creative ROLES (shown in the app as "Role"):
  premium-motion-designer · video-editor · graphic-designer ·
  concept-artist · audio-engineer · some-strategist · keynote-designer ·
  product-photographer · upscaler
  Always-on SYSTEM skills (`system: true`, hidden from the Role picker):
  prompt-optimizer · quality-gate
- Generation runs through the fal.ai adapter (`@fal-ai/client`) — the single
  generation engine, no other providers. ALWAYS preflight cost from
  `config/pricing.json`; > $1.25/job requires explicit user approval.
- Log every agent/MCP-driven fal result via `scripts/fal_pull.sh` into
  `assets/manifest.jsonl`.
- Division of labor: Claude Code owns batches, subagents and overnight
  queues; Cursor owns editing briefs/skills/scripts and quick one-off
  generations in the same workspace.
- `FAL_KEY` is in `.env` (gitignored) — never print or commit it.
