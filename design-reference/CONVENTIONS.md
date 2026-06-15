# StudioCreation — build conventions (new design)

Read this before converting any page. The design system is already built and
**proven against the real backend**. Your job per page: rebuild the existing
page's UI in this system, keeping ALL functionality and wiring to the same
endpoints. Reference implementations: `app/page.tsx` (Dashboard) and
`app/create/page.tsx` (Create) — match their structure and quality.

## Hard rules
1. **Do NOT edit `app/globals.css`.** Use only the existing classes + component
   props below. For one-off layout, use inline `style` with **token vars**
   (`var(--tx-2)`, `var(--accent-hi)`, `var(--bg-1)`, `var(--line-1)`, `var(--r-md)`,
   `var(--s4)`, status vars `var(--ok-tx)/--warn-tx/--bad-tx/--run-tx`). Never hardcode
   hex colours — both skins (onyx dark + lumen light) come free from the tokens.
2. **No `<main>`, no `<Nav>`, no `<html>`.** The shell (sidebar, rail, ribbon, toasts)
   is provided by `AppShell` in the layout. Each page's root is just
   `<div className="screen-pad"> … </div>` (add `narrow` for tighter pages).
3. Keep `"use client";` at the top (these are client pages).
4. Money: use `money(n)` (smart decimals) / `usd(n, dp)` from `../components/studio`.
   All numbers/prices render in mono (`className="mono"`).
5. Preserve every API call, request body, and error branch from the current page.

## Page header pattern
```tsx
<div className="screen-hd">
  <div className="titles">
    <p className="t-label t-eyebrow">Costs · Ledger</p>
    <h1 className="t-h1">$3.00 spent today</h1>
    <p className="t-body">$4.50 of $7.50 left · 12 jobs logged</p>
  </div>
  <div className="actions">{/* buttons / seg */}</div>
</div>
```

## Components (all from `../components/ui` unless noted)
- `Card({pad, glass, sel, className, ...})` — surface. `card-hd` for a header strip.
- `Btn({variant: "primary"|"ghost"|"quiet"|"danger", size: "sm"|"lg", icon})`.
- `Chip({on, dot, onRemove})` — toggle/filter pills.
- `Pill({state})` — status (`queued|running|done|ready|error|new|approved|delivered|flagged`).
- `Cost({usd, variant})`, `ProviderBadge({provider})`.
- `FuelGauge({spent, cap, projected, warnPct})` — budget gauge with striped projection + warn tick.
- `ScoreStrip({value, onChange})` — the 0–10 quality gate (selected ≥8 glows green).
- `StatCard({label, value, unit, desc, tone, onClick})` — KPI card.
- `Seg({options:[{value,label}], value, onChange})` — segmented control.
- `Switch({on, onChange})` — toggle.
- `Overlay({onClose, children})` — modal scrim (Esc closes); put a `Card`/`sheet` inside.
- `useToast()` → `toast({kind:"ok"|"bad"|"info", title, sub})`.
- `Icon({name, size})` from `../components/Icon` — names: dashboard, create, queue, gallery,
  costs, briefs, handoff, deliver, settings, workflows, bolt, gauge, trophy, play, image,
  video, check, checkcircle, chevronRight, chevronDown, arrowRight, x, search, sun, moon,
  spark, shield, refresh, bell, lock, dot, film, copy, download, alert, clock, cpu, wand, hourglass.
- `Media({src, kind, hueKey, label, aspect, blurry, style})` and
  `Tile({asset:{id,blob_url,content_type,score,status,hueKey,aspect,duration_s}, onClick})`
  from `../components/Media` — mesh-gradient thumbnails; Tile glows in its own colour & shows HERO/score.
- `useStudio()` from `../components/AppShell` → `{operator, role, budget, activeJobs, needsScoring, refresh}`.
  `budget` is the BudgetView (settings.dailyCapUsd, spentTodayUsd, remainingTodayUsd, spentMonthUsd,
  settings.monthlyPoolUsd, settings.confirmThresholdUsd, level, message, suggestConcept). Call
  `refresh()` after any spend so the rail gauge + dashboard update.
- studio helpers: `glowVars(key)` (spread into a row/tile style to make it glow in its colour),
  `hueFor(key)`, `money`, `usd`, `modelShort(model)`, `relTime(iso)`.

## Layout classes
`screen-pad` (+`narrow`), `screen-hd`, `kpi-row` (4 cols), `split` (1.6/1) / `split even`,
`grid-4`, `grid-6`, `masonry` (4-col), `rail-strip` (5-col), `linerow` (+`click`), `empty`,
`row`/`col`/`between`/`wrap`/`grow`/`gap1..6`, `hr`/`vr`, `t-display`/`t-h1`/`t-h2`/`t-h3`/
`t-body`/`t-sm`/`t-xs`/`t-label`/`t-eyebrow`, `mono`/`tnum`/`muted`/`dim`, `err`,
`meta-rows`/`meta-row`+`.k`, `review`/`review-art`/`review-side`/`review-nav`/`review-prompt`/
`hero-banner` (for the gallery lightbox), `spend-overlay`/`spend-card`/`hold-btn` (hold-to-commit),
`field-label`, `input` (on input/textarea/select).

## Voice
Warm producer, not a terminal. Eyebrow + title + status-sentence headers. Spend framed as
something to earn. Empty states encouraging ("Line is idle. Send something from Create.").
Quality gate = "the gate"; ≥8 = hero. Mono for all money/metrics. A few signpost emojis only.
