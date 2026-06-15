# StudioCreation

Creative production engine — a Vercel-hosted generation studio with a fal
adapter, cost preflight, and File-Law local archive. See [PLAN.md](PLAN.md)
for the full foundation plan and `CLAUDE.md` for house rules.

**v2 — Quality-Max:** the studio runs entirely on the **fal.ai API SDK** and
its premium lineup, with full control. **There is no concept tier — every
job runs on a top model** (GPT Image 2 is the default for images; Nano
Banana Pro/2, Seedance 2.0 incl. reference-to-video, Kling 3.0 Pro, Veo 3.1
Fast), plus a finishing tier (Topaz 4K + fps interpolation). Iterate cheaply
by dialing quality down on the same model (GPT Image 2 `quality=low` ≈ $0.01,
video Fast lane), never by routing to a lesser model. Pages: `/` generate (tiered models,
quality, reference picker), `/workflows` (storyboard, character pack,
motion graphics, concept ladder), `/gallery` (✅ approve / 🚩 flag /
🙈 hide + filters), `/deliver` Finalize Center (4K masters, platform
exports incl. 2.35:1 cinemascope, tags, 🚀 delivered), `/settings`
budget governance (roles: creative/producer/finance/admin; monthly pool,
daily cap, per-operator guide — editable live by finance/admin).

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
scripts/              fal_pull.sh (fal MCP pull → manifest) · studio_sync.sh (Blob → File Law)
assets/               File-Law archive + manifest.jsonl (local truth)
```

## Sessions

Built in 6 runnable increments (PLAN.md §3). This is Session 1:
bootstrap + first light — one cheap model, preflight, live deployment.
