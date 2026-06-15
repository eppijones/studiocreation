# StudioCreation — Backend + Page Contract

Wiring reference for a full UI rebuild against the **real** Next.js (App Router)
endpoints. Every shape below is taken verbatim from the route handlers, lib code,
and config. Source of truth, not aspiration.

> **Type gotcha that bites every rebuild:** money columns (`est_usd`,
> `actual_usd`) come back from Neon Postgres as **strings**, not numbers
> (`NUMERIC(10,4)`). `score` is a number-or-null, `tags` is `string[]`.
> The `/api/assets` and `/api/jobs/:id` handlers `SELECT a.*` / `SELECT *`, so
> the JSON keys are the raw **snake_case** column names (`blob_url`,
> `content_type`, `duration_s`, `est_usd`, `actual_usd`, `approved_by`,
> `source_asset_id`, …). The estimator/budget endpoints use **camelCase**.
> Both conventions coexist — match each endpoint exactly.

---

## 0. Auth, cookies, middleware

`lib/auth.ts`:

```ts
SESSION_COOKIE  = "studio_session"   // httpOnly, HMAC-SHA256(STUDIO_PASSWORD, "studiocreation-v1")
OPERATOR_COOKIE = "studio_operator"  // NOT httpOnly → readable in client JS (Nav.readCookie)
ROLE_COOKIE     = "studio_role"      // NOT httpOnly → readable in client JS
```

- All three cookies: `secure: true`, `sameSite: "lax"`, `maxAge: 1 year`, `path: "/"`.
- `studio_session` is `httpOnly`; the other two are deliberately readable so the SPA
  can show the operator/role without an API call (`readCookie()` in `app/components/Nav.tsx`).
- Roles: `type StudioRole = "creative" | "producer" | "finance" | "admin"`.
  `parseRole()` falls back to `"creative"` for any unknown value.
- `GOVERNOR_ROLES = ["finance", "admin"]` — the only roles allowed to edit budget settings.

**`middleware.ts`** gates everything except public paths:

```ts
PUBLIC_PATHS = ["/login", "/api/auth", "/api/webhooks/fal", "/api/reconcile"]
```

- Matcher: `/((?!_next/static|_next/image|favicon.ico).*)`.
- If `STUDIO_PASSWORD` env is unset → gate is OFF (local dev).
- Unauthenticated `/api/*` → `401 {"error":"unauthorized"}`. Unauthenticated page → `302` redirect to `/login`.
- `/api/reconcile` is "public" to the middleware but does its own auth (session cookie OR `Bearer ${CRON_SECRET}`).

---

## 1. Canonical route list

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth` | Login — sets the 3 cookies |
| POST | `/api/generate` | Queue a single billable generation (preflight + budget gate) |
| GET | `/api/jobs` | Last 30 jobs + their assets (dashboard feed) |
| GET | `/api/jobs/[id]` | One job + its assets, with poll-fallback completion |
| GET | `/api/assets` | Asset feed (gallery / deliver / ref picker / sync) |
| PATCH | `/api/assets/[id]` | Update one asset: status / score / tags |
| GET | `/api/budget` | Live `BudgetState` for the current operator |
| GET | `/api/models` | Full model catalog + param schemas + brands |
| GET | `/api/skills` | Employees / personas (from `.claude/skills`) |
| GET | `/api/costs` | Spend aggregations (day/project/model/operator/totals) |
| GET | `/api/briefs` | Parsed briefs with shot tables + per-batch totals |
| POST | `/api/briefs/run` | Queue a whole brief as one batch |
| POST | `/api/finish` | Queue a Topaz/Recraft finishing job on an asset |
| GET / PUT | `/api/settings` | Budget governance settings (PUT = finance/admin only) |
| GET | `/api/accuracy` | Per-model estimate-vs-actual drift |
| GET / POST | `/api/reconcile` | Match ledger rows to fal billing events |
| POST | `/api/import/manifest` | Bulk-import legacy MCP/Higgsfield manifest rows |
| POST | `/api/webhooks/fal` | fal queue completion webhook (ED25519-verified) |

---

## 2. `/api/auth` — POST (login)

Public. Sets cookies on success.

**Request body:**
```ts
{ password: string, operator?: string, role?: string }
```
- `operator`: trimmed, capped at 40 chars, defaults to `"unknown"`.
- `role`: passed through `parseRole` → one of the 4 roles, default `"creative"`.

**Success `200`:** `{ "ok": true }` + `Set-Cookie` for `studio_session`, `studio_operator`, `studio_role`.

**Errors:**
| status | body |
|---|---|
| 500 | `{ "error": "STUDIO_PASSWORD is not configured" }` |
| 401 | `{ "error": "Wrong password" }` (wrong or non-string password) |

---

## 3. `/api/generate` — POST (the core billable call)

**Request body** (all optional except `prompt`; defaults shown):
```ts
{
  prompt: string,                  // REQUIRED, trimmed
  model?: string,                  // default "fal-ai/flux/schnell"; must be a known model id
  numImages?: number,              // clamped 1..4, default 1
  seconds?: number,                // clamped 1..15, default 5
  ratio?: string,                  // default "1:1"
  audio?: boolean,                 // default false
  fast?: boolean,                  // default false
  tier?: "4k",                     // only "4k" is honored; anything else → undefined
  quality?: string,                // only applied if model.qualities includes it
  project?: string,                // default "studio"
  label?: string,                  // default "asset"
  refImageUrls?: string[],         // http(s) only, sliced to model.refImages
  refVideoUrls?: string[],         // http(s) only, sliced to model.refVideos
  refAudioUrls?: string[],         // http(s) only, sliced to model.refAudio
  negativePrompt?: string,         // trimmed, max 500 chars
  confirmed?: boolean              // must be true to bypass the confirm gate
}
```
`kind` is derived: `image` unless the model's unit is `video_second`. `count` = `seconds` for video, `numImages` for image.

**Success `200`:**
```ts
{ jobId: number, requestId: string, estimate: Estimate, model: string }
```

**`Estimate` shape** (from `lib/pricing.ts`, returned in several endpoints):
```ts
{ usd: number, unit: string, unitUsd: number, count: number, breakdown: string }
// breakdown e.g. "1 × $0.1600/image (high) = $0.1600"
```

**Errors:**
| status | error / body | when |
|---|---|---|
| 400 | `{ "error": "Prompt is required" }` | empty prompt |
| 400 | `{ "error": "Unknown model: <id>" }` | model not in catalog |
| 400 | `{ "error": "Finishing models run from the Finalize Center" }` | a `tier:"finish"` model id |
| 402 | `{ "error": "confirm_required", "estimate": Estimate, "threshold": number }` | est > `confirmThresholdUsd` and `confirmed !== true` |
| 403 | `{ "error": "daily_cap_exceeded", "estimate": Estimate, "budget": BudgetState }` | est > remaining today |
| 403 | `{ "error": "monthly_pool_exceeded", "estimate": Estimate, "budget": BudgetState }` | est > remaining this month |
| 502 | `{ "error": "<fal submit message>" }` | fal queue submission threw |

Note: the 402 carries `threshold` (flat), not `budget`; the two 403s carry `budget` (full `BudgetState`). The SPA reads `data.budget.settings.dailyCapUsd` / `.monthlyPoolUsd` for its toast copy.

---

## 4. `/api/jobs` — GET (dashboard feed)

No params. Returns the 30 most-recent jobs, each with a nested `assets` array (only `id`/`blob_url`/`content_type`).

**Success `200`:**
```ts
{
  jobs: Array<{
    id: number, model: string, prompt: string,
    status: "queued" | "running" | "done" | "error",
    est_usd: string,            // NUMERIC → string
    operator: string, project: string, label: string,
    error: string | null,
    created_at: string,         // ISO
    completed_at: string | null,
    assets: Array<{ id: number, blob_url: string, content_type: string | null }>
  }>
}
```

---

## 5. `/api/jobs/[id]` — GET (single job, poll fallback)

Path param `id` (numeric). If the job is `queued`/`running`, has a `request_id`, and is older than 20s, this handler **actively polls fal** and may complete the job before responding (mirrors media into Blob, inserts asset rows). After ~5 min of fal 4xx it marks the job `error`.

**Success `200`:**
```ts
{ job: JobRow, assets: AssetRow[] }   // both raw rows, full columns (snake_case)
```

**`JobRow`** (full row; `est_usd`/`actual_usd` are strings):
```ts
{
  id: number, provider: string, model: string, request_id: string | null,
  prompt: string, params: object, status: "queued"|"running"|"done"|"error",
  est_usd: string, actual_usd: string | null,
  operator: string, project: string, label: string,
  error: string | null, created_at: string, completed_at: string | null,
  source_asset_id: number | null
}
```

**`AssetRow`**:
```ts
{
  id: number, job_id: number, blob_url: string, source_url: string | null,
  content_type: string | null, width: number | null, height: number | null,
  duration_s: number | null,                 // REAL
  score: number | null,                       // SMALLINT 0..10
  status: "new"|"flagged"|"hidden"|"approved"|"delivered",
  tags: string[], approved_by: string | null, approved_at: string | null,
  created_at: string
}
```

**Error:** `404 { "error": "not found" }`.

---

## 6. `/api/assets` — GET (gallery / deliver / ref picker / sync)

**Query params** (all optional):
| param | type | meaning |
|---|---|---|
| `after_id` | number | only assets with `id > after_id` (incremental pulls; default 0) |
| `project` | string | filter `jobs.project` exactly |
| `status` | string | filter `assets.status` exactly |

Always `ORDER BY a.id DESC LIMIT 200`.

**Success `200`:**
```ts
{ assets: Array<AssetRow & {
    // joined from the parent job:
    model: string, project: string, label: string, operator: string,
    prompt: string, est_usd: string, actual_usd: string | null,
    request_id: string | null, source_asset_id: number | null
  }>
}
```
This is the richest asset shape — gallery, Finalize Center, and the generate-page reference picker all consume it. (The gallery filters client-side; only `project`/`status` are server-filterable.)

---

## 7. `/api/assets/[id]` — PATCH (review actions)

Path param `id`. Body may contain any subset of `score` / `status` / `tags`; at least one required. Sets `approved_by`/`approved_at` to the current operator when `status` becomes `approved` or `delivered`.

**Request body:**
```ts
{
  score?: number | null,   // integer 0..10, or null to clear
  status?: "new" | "flagged" | "hidden" | "approved" | "delivered",
  tags?: string[]          // each trimmed to 40 chars, max 12 tags, blanks dropped
}
```

**Success `200`** (only the changed columns):
```ts
{ id: number, score: number | null, status: AssetStatus,
  tags: string[], approved_by: string | null, approved_at: string | null }
```

**Errors:**
| status | body |
|---|---|
| 400 | `{ "error": "score must be 0-10 or null" }` |
| 400 | `{ "error": "status must be one of new, flagged, hidden, approved, delivered" }` |
| 400 | `{ "error": "tags must be a string array" }` |
| 400 | `{ "error": "nothing to update" }` (empty/unknown body) |
| 404 | `{ "error": "not found" }` |

---

## 8. `/api/budget` — GET (`BudgetState`)

No params; reads the operator from `studio_operator`. Returns the full `BudgetState` (`lib/budget.ts`). Spend is UTC day / calendar month, estimates until reconciled, excludes `status='error'` jobs.

**Success `200` — `BudgetState`:**
```ts
{
  settings: BudgetSettings,          // see /api/settings below
  spentTodayUsd: number,
  spentMonthUsd: number,
  operatorTodayUsd: number,
  remainingTodayUsd: number,         // max(dailyCap - spentToday, 0)
  remainingMonthUsd: number,         // max(monthlyPool - spentMonth, 0)
  level: "ok" | "notice" | "warn" | "blocked",
  message: string,                   // human banner copy
  suggestConcept: boolean            // true once level >= "warn"
}
```
Level math: `blocked` at spend ≥ cap, `warn` at ≥ `warnPct`, `notice` at ≥ `noticePct`. Worst of day/month/operator wins, but the per-operator signal is clamped at `warn` (a nudge, never a wall). The `BudgetBanner` component (`app/components/BudgetBanner.tsx`) consumes a trimmed `BudgetView` — same fields, `settings` narrowed to the 4 cap numbers.

---

## 9. `/api/models` — GET (catalog — drives the model router UI)

No params. Merges pricing capabilities + native param schemas + brand profiles in one call.

**Success `200`:**
```ts
{
  models: Array<{
    // from listModels() (lib/pricing.ts):
    id: string, label: string, unit: string, usd: number,
    tier: "concept" | "production" | "hero" | "finish",
    kind: string, has4k: boolean, hasAudio: boolean, hasFast: boolean,
    qualities: string[], refImages: number, refVideos: number, refAudio: number,
    notes: string,
    // merged from config/modelParams.json:
    family: string | null, promptHint: string, params: ParamSpec[],
    // raw price tables for client-side preflight math:
    pricing: {
      usd: number,
      qualities: Record<string, number> | null,
      tiers: Record<string, number> | null,   // e.g. { "4k": 0.41 }
      audioOn: number | null,
      fast: number | null
    }
  }>,
  brands: BrandProfiles   // = config/brands.json `profiles` (see §17)
}
```

**`ParamSpec`** (the schema that renders each model's native param panel; `config/modelParams.json`):
```ts
{ key: string, label: string,
  type: "range" | "select" | "toggle" | "text" | "refs",
  // range:  min, max, step, default, unit?
  // select: options: string[], default, hint?, unit?
  // toggle: default: boolean, hint?
  // text:   placeholder?
  // refs:   accepts: "image" | "media"
}
```
`param.key` values (`numImages`, `ratio`, `quality`, `seconds`, `audio`, `fast`, `tier4k`, `negativePrompt`, `refs`) map 1:1 onto `/api/generate` body fields (`tier4k` toggle → send `tier:"4k"`; `refs` → `refImageUrls`/`refVideoUrls`).

---

## 10. `/api/skills` — GET (employees / personas)

No params. Reads `.claude/skills/*/SKILL.md` front-matter.

**Success `200`:**
```ts
{ employees: Array<{
    id: string, name: string, description: string,
    studio: null | {
      kind: "image" | "video",
      model: string,            // default "fal-ai/flux/schnell"
      ratio: string,            // default "1:1"
      seconds?: number,
      style: string             // appended to the prompt when picked
    }
  }>
}
```
Used by the generate page (employee preset → sets model/ratio/seconds + style suffix) and the handoff page.

---

## 11. `/api/costs` — GET (spend aggregations)

No params. Five aggregations in one call; all exclude `status='error'`. Numeric sums come back as **strings**.

**Success `200`:**
```ts
{
  byDay:      Array<{ day: string, usd: string, jobs: string }>,      // last 30d, UTC, desc
  byProject:  Array<{ project: string, usd: string, jobs: string }>,
  byModel:    Array<{ model: string, usd: string, jobs: string }>,
  byOperator: Array<{ operator: string, usd: string, jobs: string }>,
  totals: {
    total_usd: string | null,
    reconciled_usd: string | null,
    reconciled_jobs: string,     // count of jobs with actual_usd
    jobs: string,                // total non-error jobs
    month_usd: string | null     // current calendar month
  }
}
```
`usd` = `SUM(COALESCE(actual_usd, est_usd))` — actuals where reconciled, estimates otherwise.

---

## 12. `/api/briefs` — GET + `/api/briefs/run` — POST

**GET `/api/briefs`** — parses `briefs/*.md` shot tables (`| label | model | prompt | ratio | count |`).
```ts
{ briefs: Array<{
    id: string, title: string, project: string, totalUsd: number,
    shots: Array<{
      label: string, model: string, prompt: string, ratio: string,
      count: number, kind: "image" | "video", estUsd: number
    }>
  }>
}
```
- `id` = filename without `.md`; `project` = id before the first `-`; `title` = first `# ` heading.
- Rows whose model isn't `fal-ai/...` or isn't in the catalog are silently skipped.

**POST `/api/briefs/run`** — queue the whole brief as one batch (one spend card).

Request: `{ briefId: string, confirmed: boolean }`.

**Success `200`:**
```ts
{ queued: Array<{ jobId: number, label: string, requestId?: string, error?: string }>,
  totalUsd: number }
```
Each shot is queued independently; a failed `submitJob` leaves an `error` on that entry but doesn't abort the batch.

**Errors:**
| status | body |
|---|---|
| 404 | `{ "error": "brief not found" }` |
| 400 | `{ "error": "brief has no parsable shots" }` |
| 402 | `{ "error": "confirm_required", "totalUsd": number, "shots": Shot[] }` (when `confirmed !== true`) |
| 403 | `{ "error": "cap_exceeded", "totalUsd": number, "budget": BudgetState }` |

> Note: the briefs page client checks `data.error === "daily_cap_exceeded"`, but this route only ever returns `cap_exceeded` for the 403 — the daily branch is effectively dead copy. Treat **`cap_exceeded`** as the canonical 403 here.

---

## 13. `/api/finish` — POST (Topaz / Recraft finishing)

Queues a cloud finishing job on an existing asset. `source_asset_id` links the derived master back to its origin.

**Request body:**
```ts
{
  assetId: number,                          // REQUIRED
  action: "upscale-video-4k" | "upscale-image-4k" | "upscale-image-crisp",  // REQUIRED
  targetFps?: number,                       // video only, clamped 16..60
  upscaleFactor?: number,                   // clamped 1..4, default 2
  confirmed?: boolean
}
```
- `upscale-video-4k` requires a video asset; the image actions require an image asset.
- Topaz video price **doubles** when `targetFps >= 50` (60fps tier).

**Success `200`:** `{ jobId: number, requestId: string, estimate: Estimate }`.

**Errors:**
| status | body |
|---|---|
| 400 | `{ "error": "assetId and a valid action are required" }` |
| 400 | `{ "error": "asset is not a video" }` / `{ "error": "asset is not an image" }` |
| 404 | `{ "error": "asset not found" }` |
| 402 | `{ "error": "confirm_required", "estimate": Estimate, "threshold": number }` |
| 403 | `{ "error": "cap_exceeded", "estimate": Estimate, "budget": BudgetState }` |
| 502 | `{ "error": "<fal submit message>" }` |

---

## 14. `/api/settings` — GET + PUT (budget governance)

**GET** (any authenticated role):
```ts
{ budget: BudgetSettings, role: StudioRole, canEdit: boolean }   // canEdit = role in {finance, admin}
```

**`BudgetSettings`** (`lib/settings.ts`; defaults from `config/budget.json`):
```ts
{
  dailyCapUsd: number,          // 7.5   shared hard stop / UTC day
  monthlyPoolUsd: number,       // 120   team pool hard stop / month
  perOperatorDailyUsd: number,  // 5     soft per-operator guide
  confirmThresholdUsd: number,  // 1.25  per-job confirm gate
  noticePct: number,            // 0.6
  warnPct: number               // 0.85
}
```

**PUT** (finance/admin only). Body = partial `BudgetSettings`. Only finite numbers ≥ 0 are applied; `noticePct`/`warnPct` are clamped to ≤ 1. Persists to the `settings` table keyed `'budget'`.

**Success `200`:** `{ budget: BudgetSettings }` (the merged, saved settings).

**Error:** `403 { "error": "Budget governance is finance/admin only — switch role at login." }`.

---

## 15. Secondary / ops routes (brief notes)

**`/api/accuracy` — GET.** Estimate-vs-actual drift per model over reconciled (`status='done'`, `actual_usd` set) jobs.
```ts
{ byModel: Record<string, { reconciledJobs: number, meanDriftPct: number, maxDriftPct: number }> }
```

**`/api/reconcile` — GET & POST.** Own auth: session cookie OR `Authorization: Bearer ${CRON_SECRET}`; if `STUDIO_PASSWORD` unset, open. Pulls fal Platform billing events (90-day window, paginated), writes `actual_usd` onto matching jobs, flags >10% drift. **Always responds `200`** (even on a fal key error, which is surfaced inside the body):
```ts
{ matched: number,
  driftFlags: Array<{ jobId: number, estUsd: number, actualUsd: number }>,
  message?: string, error?: string }       // unauthorized → 401 { error: "unauthorized" }
```

**`/api/import/manifest` — POST.** Body is JSONL or a JSON array of legacy manifest rows (`ts, project, model, label, cost_usd, cost_credits, file, url, request_id`). `?pack=` selects the Higgsfield credit→USD rate. Idempotent on `request_id` (synthesized from a URL hash if absent). Inserts `done` jobs + assets.
```ts
{ imported: number, skipped: number, hfUsdPerCredit: number }   // 400 on unparseable body
```

**`/api/webhooks/fal` — POST.** fal queue completion callback. ED25519-verified over JWKS (`x-fal-webhook-*` headers; 5-min timestamp tolerance). Looks up the job by `?jobId=` (preferred) or `request_id`, then completes (mirror media → Blob, insert assets, mark `done`) or fails it. Returns `{ ok: true }`; `401` bad signature, `404` job not found, `400` request_id mismatch, `500` on completion error (fal then retries; the poll fallback also covers it).

---

## 16. `config/pricing.json` — full fal model table

Keyed by model id under `providers.fal.models`. `tier` ∈ `concept|production|hero|finish`. Flags shown are what `listModels()` derives: `has4k` (a `tiers["4k"]`), `hasAudio` (`audio_on`), `hasFast` (`fast`), `qualities` (keys), refs (`refs.images/videos/audio`).

| model id | label | unit | base usd | tier | kind | 4k | audio_on | fast | qualities | refs (img/vid/aud) |
|---|---|---|---|---|---|---|---|---|---|---|
| `fal-ai/flux/schnell` | FLUX schnell | image | 0.004 | concept | text-to-image | — | — | — | — | — |
| `openai/gpt-image-2` | GPT Image 2 | image | 0.16 | hero | text-to-image | 0.41 | — | — | low 0.01 / med 0.06 / high 0.16 | — |
| `openai/gpt-image-2/edit` | GPT Image 2 Edit | image | 0.16 | hero | image-edit | 0.41 | — | — | low 0.01 / med 0.06 / high 0.16 | 10 / 0 / 0 |
| `fal-ai/nano-banana-2` | Nano Banana 2 | image | 0.08 | production | text-to-image | 0.16 | — | — | — | — |
| `fal-ai/nano-banana-pro` | Nano Banana Pro | image | 0.15 | hero | text-to-image | 0.30 | — | — | — | — |
| `fal-ai/wan-25-preview/text-to-video` | Wan 2.5 | video_second | 0.05 | concept | text-to-video | — | — | — | — | — |
| `fal-ai/kling-video/v2.5-turbo/pro/text-to-video` | Kling 2.5 Turbo Pro | video_second | 0.07 | concept | text-to-video | — | — | — | — | — |
| `fal-ai/kling-video/v3/pro/text-to-video` | Kling 3.0 Pro | video_second | 0.14 | hero | text-to-video | — | 0.21 | — | — | — |
| `fal-ai/kling-video/v3/pro/image-to-video` | Kling 3.0 Pro (image) | video_second | 0.14 | hero | image-to-video | — | 0.21 | — | — | 1 / 0 / 0 |
| `bytedance/seedance-2.0/text-to-video` | Seedance 2.0 | video_second | 0.3034 | hero | text-to-video | — | — | 0.2419 | — | — |
| `bytedance/seedance-2.0/image-to-video` | Seedance 2.0 (image) | video_second | 0.3024 | hero | image-to-video | — | — | 0.2419 | — | 1 / 0 / 0 |
| `bytedance/seedance-2.0/reference-to-video` | Seedance 2.0 (refs) | video_second | 0.3024 | hero | reference-to-video | — | — | 0.2419 | — | 9 / 3 / 3 |
| `fal-ai/veo3.1/fast` | Veo 3.1 Fast | video_second | 0.10 | production | text-to-video | — | 0.15 | — | — | — |
| `fal-ai/topaz/upscale/video` | Topaz Video Upscale | video_second | 0.08 | finish | upscale-video | — | — | — | — | — |
| `fal-ai/topaz/upscale/image` | Topaz Image Upscale | image | 0.08 | finish | upscale-image | — | — | — | — | — |
| `fal-ai/recraft/upscale/crisp` | Recraft Crisp Upscale | image | 0.004 | finish | upscale-image | — | — | — | — | — |

Notes carried in `pricing.json` and surfaced in the UI: GPT Image 2 `quality=low ≈ $0.01` concept pass; Seedance ref2v is the consistency hero (`@Image1` syntax, 1080p); Topaz video `$0.08/s` for 4K (doubles at 60fps); Recraft crisp is the cheap draft upscaler. `finish`-tier models are blocked at `/api/generate` and only reachable via `/api/finish`.

Also under `providers.higgsfield`: `usd_per_credit_by_pack = { "26": 0.052, "49": 0.049, "95": 0.0475, "190": 0.0475 }` (used only by `/api/import/manifest`).

---

## 17. `config/brands.json` — brand profiles

Returned as `brands` by `/api/models`; also imported directly by the generate / handoff pages.

```jsonc
{
  "none":      { "label": "No brand",   "style": "", "palette": [], "notes": "" },
  "starxi":    { "label": "StarXI",
                 "style": "StarXI brand: collectible figurine style, slim athletic build, sculpted cultural platform base, gold cream and deep green palette, shield crest with star and XI, stadium energy, premium-but-playful",
                 "palette": ["gold", "cream", "deep green"],
                 "notes": "Chroma key background: flat magenta #FF1FB4. 96 nation characters." },
  "strikelab": { "label": "StrikeLab",
                 "style": "StrikeLab brand: clean, technical, precise, modern golf aesthetic, minimal composition",
                 "palette": ["black", "white", "signal green"],
                 "notes": "strikelab.golf" }
}
```
The generate page appends `brand.style` (and the chosen employee's `studio.style`) to the prompt as a comma-joined suffix before submitting.

---

## 18. `config/budget.json` — defaults

```json
{ "dailyCapUsd": 7.5, "monthlyPoolUsd": 120, "perOperatorDailyUsd": 5,
  "confirmThresholdUsd": 1.25, "noticePct": 0.6, "warnPct": 0.85 }
```
Live values come from the `settings` table (`key='budget'`), merged over these defaults. Editable at `/settings` by finance/admin.

---

## 19. `lib/finishing.ts` — delivery presets + finishing actions

**Finishing actions** (`/api/finish` `action` field), via `buildFinishPlan`:
| action | model | input | count (estimator) | label |
|---|---|---|---|---|
| `upscale-video-4k` | `fal-ai/topaz/upscale/video` | `{ video_url, model:"Proteus", upscale_factor:1-4, H264_output:true, target_fps?:16-60 }` | `ceil(duration_s)` | `4k-<fps>fps` |
| `upscale-image-4k` | `fal-ai/topaz/upscale/image` | `{ image_url, upscale_factor }` | 1 | `4k-print` |
| `upscale-image-crisp` | `fal-ai/recraft/upscale/crisp` | `{ image_url }` | 1 | `crisp-2x` |

**`DELIVERY_PRESETS`** (local `$0` ffmpeg exports — used purely client-side in `/deliver`, no endpoint):
`tiktok` (1080×1920 9:16 30 crop), `yt-4k-24` / `yt-4k-25` / `yt-4k-30` (3840×2160 16:9 crop), `yt-hd` (1920×1080 30 crop), `scope-24` (3840×1634 2.35:1 24 crop), `scope-letterbox` (3840×2160 24 pad), `ig-feed` (1080×1350 4:5 30 crop), `square` (1080×1080 1:1 30 crop). Each: `{ id, label, width, height, ratio, fps, fit:"crop"|"pad", notes }`. `ffmpegCommand` / `ffmpegImageCommand` build the copy-pasteable command strings.

---

## 20. Pages — render + endpoints + key state

| Route | File | Renders | Calls | Key local state |
|---|---|---|---|---|
| `/` (generate) | `app/page.tsx` | The main generate console: employee/brand pickers, prompt, model `<optgroup>` by tier, dynamic ratio/seconds/images, quality/audio/fast/4k toggles, gallery reference picker (`@Image1` UX), live preflight, budget banner, and a polling "Jobs" feed. | `GET /api/jobs`, `GET /api/budget`, `GET /api/skills`, `GET /api/assets` (ref pool), `POST /api/generate`. Polls `GET /api/jobs/:id` for each active job every 3s, then refreshes jobs+budget. | `prompt, model, employeeId, brandId, ratio, numImages, seconds, audio, fast, tier4k, quality, refIds[], refPool[], project, label, jobs[], budget, operator, role` |
| `/login` | `app/login/page.tsx` | Studio-password form + operator (`Eppi`/teammates/custom) and role dropdowns. On success routes to `/`. | `POST /api/auth`. | `password, operator, customOperator, role, error, busy` |
| `/gallery` | `app/gallery/page.tsx` | Filterable asset grid with status badges, score `<select>`, ✅/🚩/🙈 toggle buttons, and a click-through lightbox. All filtering is client-side. | `GET /api/assets` (once), `PATCH /api/assets/:id` (status/score/tags). | `assets[], projectFilter, modelFilter, statusFilter ("active"), kindFilter, minScore, lightbox` |
| `/briefs` | `app/briefs/page.tsx` | Brief picker + shot table + one batch spend card; queues the whole brief. | `GET /api/briefs`, `POST /api/briefs/run` (`{briefId, confirmed:true}`). | `briefs[], selected, busy, result, error` |
| `/costs` | `app/costs/page.tsx` | All-time/month banner, a "Reconcile vs fal" button, and four bar-chart sections (day/project/model/operator). | `GET /api/costs`, `POST /api/reconcile`. | `data (CostsData), reconciling, reconcileResult` |
| `/handoff` | `app/handoff/page.tsx` | Legacy Higgsfield handoff builder — composes a paste-ready markdown package from feature + employee + brand + brief, copy button. | `GET /api/skills`. (`brands.json` imported directly.) | `employees[], employeeId, brandId, feature, brief, copied` |
| `/deliver` | `app/deliver/page.tsx` | Finalize Center: lists approved/delivered assets, Topaz 4K master buttons (fps select), tag editor, derived-masters links, ffmpeg export preset + copy, and 🚀 mark-delivered. Handles the `402` finish gate with a `window.confirm`. | `GET /api/assets`, `PATCH /api/assets/:id`, `POST /api/finish`. | `assets[], presetByAsset, fpsByAsset, tagDraft, busyId, message, copied` |
| `/settings` | `app/settings/page.tsx` | Budget governance form (6 numeric fields). Read-only banner for non-governor roles; PUT only enabled for finance/admin. | `GET /api/settings`, `PUT /api/settings`. | `budget, canEdit, role, draft, busy, message` |
| `/workflows` | `app/workflows/page.tsx` | Four canned production recipes (storyboard / character-pack / motion-graphics / concept-ladder), each with baked-in prompt engineering; expands to fields, shows client-side preflight, queues 1-N jobs. | `POST /api/generate` (looped per job). Uses `estimate()` from `lib/pricing` client-side for preflight. | `open, values, project, busy, result` |

**Navigation** (`app/components/Nav.tsx`): links in order — generate `/`, workflows, gallery, deliver, costs, settings, briefs, handoff — plus the operator·role label read from the non-httpOnly cookies via `readCookie()`.

---

## 21. DB schema (for reference)

`jobs`: `id SERIAL, provider, model, request_id UNIQUE, prompt, params JSONB, status, est_usd NUMERIC(10,4), actual_usd NUMERIC(10,4), operator, project, label, error, created_at, completed_at, source_asset_id`.

`assets`: `id SERIAL, job_id→jobs, blob_url, source_url, content_type, width, height, duration_s REAL, score SMALLINT(0..10), status (default 'new'), tags TEXT[] (default '{}'), approved_by, approved_at, created_at`.

`settings`: `key PK, value JSONB, updated_by, updated_at` (only the `'budget'` key is used today).

Job status lifecycle: `queued → running → done | error`. Asset lifecycle: `new → flagged | hidden | approved → delivered`.
