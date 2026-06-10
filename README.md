# StudioCreation

Creative production engine — a Vercel-hosted generation studio with a fal
adapter, cost preflight, and File-Law local archive. See [PLAN.md](PLAN.md)
for the full foundation plan and `CLAUDE.md` for house rules.

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel (`studiocreation`)
- `@fal-ai/client` server-side adapter (`lib/providers/fal.ts`)
- `config/pricing.json` — single source of truth for model pricing
- `lib/pricing.ts` — preflight estimator + budget-law thresholds

## Local development

```bash
pnpm install
cp .env.example .env   # then fill in FAL_KEY
pnpm dev
```

`FAL_KEY` is gitignored locally and lives as a server-only env var on
Vercel. It must never appear in client bundles, logs, or commits.

## Deploy

Push to `main` → Vercel auto-deploys. PRs get preview URLs.

## Repo layout

```
app/                  Next.js app (generate page + /api/generate)
lib/                  pricing estimator + provider adapters
config/pricing.json   model price table (editable)
.claude/skills/       the 9 studio employees (Agent Skills)
scripts/              hf_pull.sh (Higgsfield MCP pull → manifest)
assets/               File-Law archive + manifest.jsonl (local truth)
```

## Sessions

Built in 6 runnable increments (PLAN.md §3). This is Session 1:
bootstrap + first light — one cheap model, preflight, live deployment.
