# AGENTS.md — cross-tool entry point

**Source of truth: `CLAUDE.md`** (router, budget law, quality gates, brand
profiles). Read it first and obey it fully — it applies to every agent in
this repo (Claude Code, Cursor, Codex, or anything else).

- Skills live in `.claude/skills/<name>/SKILL.md` (open Agent Skills
  standard). Load the relevant skill before acting on its domain:
  premium-motion-designer · reference-sheets · infographic-animator ·
  typography-animator · vertical-social-formats · storyboard-moodboard ·
  prompt-optimizer · quality-gate · audio-master
- Generation runs through the fal adapter (app + `@fal-ai/client`) or the
  hosted MCPs (mcp.fal.ai, Higgsfield). ALWAYS preflight cost from
  `config/pricing.json`; > $1.25/job requires explicit user approval.
- Log every MCP-driven result via `scripts/fal_pull.sh` (fal) or
  `scripts/hf_pull.sh` (Higgsfield) into `assets/manifest.jsonl`.
- Division of labor: Claude Code owns batches, subagents and overnight
  queues; Cursor owns editing briefs/skills/scripts and quick one-off
  generations in the same workspace.
- `FAL_KEY` is in `.env` (gitignored) — never print or commit it.
