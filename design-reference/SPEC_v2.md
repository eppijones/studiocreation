# StudioCreation — Design System Spec (v2)

> **Aesthetic in one line:** A cinema-grade **production cockpit / trading-floor** — a near-black canvas where *content is the light source*. Glowing gradient media on glass chrome, a fixed **top horizontal nav**, uppercase monospace labels for telemetry, and a warm "the floor is live" voice. Two-brand toggle (StarXI / StrikeLab), a live cost ticker, and an ATMOSPHERE/MOTION **Tweaks panel**.

This document is a complete rebuild reference. Every token, class, value, layout and interaction below is taken verbatim from the v2 source (`StudioCreation.html` + 7 `.jsx` bundles). Where the value is computed at runtime (e.g. a tweak mapping), the formula is given.

Source files reverse-engineered:
- `StudioCreation.html` — self-contained shell: `<head>` inline CSS design system + bootstrap (React 18.3.1 UMD + Babel standalone, all from unpkg).
- `tweaks-panel.jsx` — generic Tweaks shell + `useTweaks` hook (reusable scaffold, light-themed glass).
- `sc-data.jsx` — mock data: models, palettes, employees, brands, content types, briefs, handoff packages, budget constants.
- `sc-core.jsx` — shared primitives + helpers (RenderTile, FuelGauge, RollingNumber, ScoreStrip, ToastStack, Avatar, art generator).
- `sc-screens.jsx` — Dashboard, Queue, Gallery, Review overlay, JobRow.
- `sc-composer.jsx` — Create screen + Pre-flight HUD + Spend card.
- `sc-screens2.jsx` — Costs, Briefs (batch runner), Handoff.
- `sc-app.jsx` — app shell, topbar, global ticker, state store, tweak→CSS wiring.

**Platform constraint:** Desktop only. `html,body{min-width:1024px}`, viewport hard-locked to `width=1280`. Designed for a 13–15" laptop. `overflow-x:auto`. There is **no mobile/responsive breakpoint system** — layout is fixed-grid and assumes ≥1024px.

---

## 1. Design Tokens

All tokens live as CSS custom properties on `:root`. The four runtime-tweakable vars (`--glow`, `--glass-a`, `--motion`, `--canvas`) are also written imperatively by the Tweaks panel (see §6).

### 1.1 Root custom properties (exact)

```css
:root{
  --glow:1;            /* tweak: glow intensity (0–2), 1 = 100% */
  --glass-a:.72;       /* tweak: glass opacity (0–1) */
  --motion:1;          /* tweak: motion amplitude (0–2), 1 = 100% */
  --canvas:#07090d;    /* tweak: canvas warmth — cool→warm near-black */

  /* ink (text) */
  --ink:#eceef2;       /* primary text */
  --ink-dim:#9aa0ad;   /* secondary / muted text */
  --ink-faint:#5e6470; /* tertiary / label text, disabled */

  /* lines / borders */
  --line:rgba(255,255,255,.07);        /* default hairline border */
  --line-bright:rgba(255,255,255,.14); /* emphasized border, focus */

  /* system / semantic colors — reserved for MEANING only */
  --warn:#ffb02e;      /* amber — warning / approaching cap */
  --danger:#ff5470;    /* red — danger / over-cap / negative prompt */
  --pass:#3ddc97;      /* green — pass / hero / live */

  /* type */
  --sans:'Archivo',system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
```

**Discipline rule (from source comments):** "Reserved system colors ONLY for meaning: amber=warn, red=danger/over-cap, green=pass." The UI is otherwise monochrome (white-on-near-black); all *color* comes from the generated render art and per-card `--p0/--p1` palette vars.

### 1.2 Body / global base

```css
*{box-sizing:border-box;margin:0;padding:0}
html,body{min-width:1024px}
body{
  background:var(--canvas);
  color:var(--ink);
  font-family:var(--sans);
  font-size:14px;          /* global base size */
  line-height:1.45;
  -webkit-font-smoothing:antialiased;
  overflow-x:auto;
}
::selection{background:rgba(255,255,255,.18)}
button{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
input,textarea,select{font:inherit;color:inherit}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
```

### 1.3 Per-card palette variables (`--p0`, `--p1`)

Render cards, job rows, toasts, spend cards, brief/handoff cards all set **inline** CSS vars from the asset palette:

```jsx
style={{ '--p0': r.palette[0], '--p1': r.palette[1] }}
```

- `--p0` = primary glow / accent color of that asset (drives box-shadow glow, hero border, badge fill).
- `--p1` = secondary color (used in the job-progress flowing gradient).
- Default fallback when unset: `--p0` → `#888`, `#fff`, or `#bbb` depending on context (see individual `color-mix` usages).

These are the **gradient-glow colors**: there is no global accent — each card glows in its own asset color.

### 1.4 The 8 named palettes (`SC_DATA.PALETTES`)

Each palette is a 3-stop array `[a, b, c]` (a = brightest accent, c = darkest base). Used for both the generated art and the `--p0/--p1` glow.

```js
pitchGold:     ['#E8B84B','#1E5B38','#0D1F14']  // StarXI brand
emberTeal:     ['#FF8C42','#2A9DB8','#0B1B26']
violetRun:     ['#B14BE8','#4A2BD9','#16093A']
coolStrike:    ['#7FE8C0','#2E7F66','#0A1F18']  // StrikeLab brand
crimsonNight:  ['#FF4D5E','#7A1B4D','#1A0A14']
arcticBlue:    ['#9AD8FF','#2B66D9','#0A1226']
sunsetMagenta: ['#FF7AC8','#FF9A3C','#2A0E22']
limeNoir:      ['#CFFF5E','#2E8C4A','#0E1A0C']
```

### 1.5 Generated render art (the "content")

There are **no images** — every thumbnail is a procedural multi-radial-gradient generated from `(palette, seed)`. This is the signature visual. Function `artBackground(palette, seed)`:

```js
function artBackground(palette, seed){
  seed = seed || 1;
  const [a,b,c] = palette;
  const r  = (n) => Math.sin(seed*99.7 + n*37.3) * 0.5 + 0.5;   // deterministic 0..1 from seed
  const px = (n,lo,hi) => Math.round(lo + r(n)*(hi-lo));
  return [
    `radial-gradient(42% 30% at ${px(7,52,82)}% ${px(8,8,30)}%, rgba(255,255,255,.42) 0%, transparent 70%)`, // white hotspot
    `radial-gradient(95% 75% at ${px(1,8,42)}% ${px(2,5,35)}%, ${a} 0%, transparent 62%)`,                    // accent a
    `radial-gradient(115% 85% at ${px(3,58,92)}% ${px(4,12,48)}%, ${b} 0%, transparent 64%)`,                 // mid b
    `radial-gradient(150% 115% at ${px(5,28,72)}% ${px(6,78,112)}%, ${c} 0%, transparent 75%)`,               // base c
    `linear-gradient(180deg, ${c}, #05060a)`                                                                  // ground to near-black
  ].join(',');
}
```

Seed makes each asset's gradient placement stable but unique. Bottom always sinks to `#05060a`.

### 1.6 Glass surface (`.glass`)

The chrome material — frosted dark glass over the canvas. Opacity driven by `--glass-a`.

```css
.glass{
  background:
    linear-gradient(160deg, rgba(255,255,255,.05), rgba(255,255,255,0) 42%),  /* top-left sheen */
    rgba(13,15,20, var(--glass-a));                                            /* tinted dark fill */
  -webkit-backdrop-filter:blur(22px) saturate(140%);
  backdrop-filter:blur(22px) saturate(140%);
  border:1px solid var(--line);
  border-radius:18px;
  box-shadow:0 24px 70px -20px rgba(0,0,0,.65);
}
```

- Blur: **22px**, saturate **140%**.
- Fill tint base: `rgb(13,15,20)` at `--glass-a` (default `.72`).
- Drop shadow: `0 24px 70px -20px rgba(0,0,0,.65)`.

### 1.7 Radii scale (observed)

| Token use | Radius |
|---|---|
| Glass panels / cards | `18px` |
| Topbar | `16px` |
| Tiles (render thumbs) | `14px` |
| Buttons | `11px` (sm: `9px`) |
| Chips | `8px` |
| Inputs / textareas | `10–13px` |
| Score ticks | `9px` |
| Pills / score-pill / nav-badge | `6–7px` |
| Review card / spend card | `22px` |
| Gauges, progress bars, toggles | `99px` (pill) |
| Avatar | `99px` (circle) |

### 1.8 Spacing rhythm (observed)

- Page padding (`.main`): `100px 26px 140px` (huge top offset to clear the fixed topbar; huge bottom for breathing room).
- Panel padding (`.panel`): `22px`. Stat-card: `18px 20px`. Brief/handoff/pkg/preflight cards: `20px`. Spend card / review side: `26–28px`.
- Grid gaps: dashboard `16px`; create grid `18px`; tile rails `12–14px`.
- Button padding: `10px 18px` (default), `6px 12px` (sm), `8px 12px` (ghost).

### 1.9 Shadows / glows (the gradient-glow system)

Glow is everywhere keyed to `--p0` and scaled by `--glow` via `color-mix`. The pattern:

```css
box-shadow: ... color-mix(in srgb, var(--p0,#888) calc(var(--glow) * <pct>%), transparent);
```

| Element | Resting glow | Hover glow |
|---|---|---|
| `.tile` | `0 16px 50px -10px color-mix(... --p0 calc(--glow*38%) ...)` | `0 26px 70px -10px (... --glow*55% ...)` |
| `.tile.hero` | ring `0 0 0 1px (--p0 55%)` + `0 18px 70px -8px (--glow*70%)` + `0 0 34px (--glow*30%)` | (same, hero is always lit) |
| `.tile-herobadge` | `0 0 14px color-mix(... --p0 70% ...)` | — |
| `.job-art` | `0 8px 28px -4px (... --glow*45% ...)` | — |
| `.toast-art` | `0 6px 22px (... --glow*50% ...)` | — |
| `Avatar` | `0 2px 10px (... p0 calc(--glow*45%) ...)` | — |
| `.pkg` thumbnail | `0 10px 34px -6px (... --glow*45% ...)` | — |

So **glow intensity scales linearly with `--glow` (0–200%)** for every lit element, in each asset's own color.

---

## 2. Typography

### 2.1 Web fonts (loaded)

Loaded from **Google Fonts** in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- **`Archivo`** — engineered grotesk, the display/UI sans. Weights loaded: **400, 500, 600, 700, 800, 900**. Used at heavy weights for headlines (900) and labels (700–800). Var: `--sans:'Archivo',system-ui,sans-serif`.
- **`JetBrains Mono`** — the telemetry/metrics face: prices, timers, IDs, percentages, ledger times, unit labels. Weights: **400, 500, 700**. Var: `--mono:'JetBrains Mono',ui-monospace,monospace`. Always `font-variant-numeric:tabular-nums` (via `.mono`) so rolling numbers don't jitter.

Design intent (source comment): *"Type: Archivo (engineered grotesk, real display weights) + JetBrains Mono (prices/timers/IDs)."*

### 2.2 Type ramp (exact)

| Role | Class / selector | Size | Weight | Tracking | Notes |
|---|---|---|---|---|---|
| **Big display headline** ("The floor is live.") | `.hero-h` | `34px` | `900` | `-.035em` | `line-height:1.05`. The signature page title. |
| Sub-headline | `.sub-h` | `17px` | `800` | `-.02em` | section/card titles in review, briefs, handoff |
| Stat value | `.stat-card .v` | `30px` | `500` | `-.02em` | numbers in mono where tabular |
| Spend amount | `.spend-amount` | `52px` | `500` | `-.03em` | `line-height:1`, mono — the takeover hero number |
| HUD estimate value | `.hud-estimate .v` | `31px` | `500` | `-.02em` | mono |
| Wordmark | `.wordmark` | `15px` | `900` | `-.03em` | `STUDIO` + `<em>CREATION</em>` (em = dim, weight 600) |
| Body base | `body` | `14px` | `400` | — | line-height 1.45 |
| Nav tab | `.nav-tab` | `13.5px` | `600` | `-.01em` | |
| Button | `.btn` | `13.5px` | `700` | `-.01em` | sm: `12.5px` |
| Final-prompt block | `.final-prompt` | `11.5px` | mono | — | line-height 1.7 |

### 2.3 The uppercase-tracked mono label (signature treatment)

This is the **trading-floor telemetry label** — used as `.panel-label` and many one-offs. It marks every section header and key/value telemetry key.

```css
.panel-label{
  font-family:var(--mono);
  font-size:10.5px;
  font-weight:500;
  letter-spacing:.14em;     /* wide tracking */
  color:var(--ink-faint);   /* dim */
  text-transform:uppercase;
  margin-bottom:14px;
  white-space:nowrap;
}
```

Related uppercase-mono treatments and their tracking:
- `.hud-row .k`, `.meta-row .k`, `.knob label` — `10px`/`.12em` uppercase mono, `--ink-faint`.
- `.ledger-head` — `9.5px`/`.14em` uppercase mono.
- `.job-state` — `10px`/`.12em` uppercase mono (`QUEUED`, `34%`).
- `.tile-herobadge` — `9.5px`/`.18em` mono, dark text on glowing fill (`HERO`).
- `.spend-label` — `10px`/`.2em` uppercase mono, **amber** (`SPEND CONFIRMATION · OVER $1.25`).
- Date stamp ("THU JUN 12 · SHIFT 2") — `11px`/`.1em` mono `--ink-faint`.

**Rule of thumb:** anything that is a *label, status, ID, price, or timestamp* is uppercase JetBrains Mono with wide tracking; anything that is *content or a headline* is Archivo with tight negative tracking.

---

## 3. Layout System

### 3.1 Shell composition

Three fixed/flow layers:
1. **Topbar** — `position:fixed`, glass, top of viewport.
2. **`.main`** — centered content column, scrolls under topbar.
3. **Overlays** — toasts (bottom-right), review/spend full-screen takeovers, Tweaks panel (bottom-right floating).

### 3.2 Top nav (`.topbar`)

```css
.topbar{
  position:fixed; inset:14px 18px auto 18px; z-index:60; height:58px;
  display:flex; align-items:center; gap:22px; padding:0 18px 0 20px;
  border-radius:16px;
}  /* also has .glass */
```

- Floats **14px from top, 18px from each side** (not edge-to-edge — a glass bar with margin).
- Height **58px**, `z-index:60`.
- Horizontal flex, left→right: **wordmark → nav tabs (flex:1) → topbar-right cluster**.

Structure (from `sc-app.jsx`):
```
.topbar.glass
├─ .wordmark            STUDIO<em>CREATION</em>
├─ .nav                 [Dashboard][Create][Queue][Gallery][Costs][Briefs][Handoff]  (flex:1)
└─ .topbar-right
   ├─ .brandlock        [StarXI][StrikeLab]   (segmented toggle)
   ├─ .topbar-budget    "today  $3.00 / $7.50" + FuelGauge (148px wide)
   └─ .topbar-balance   small "BALANCE" + RollingNumber($23.84)
```

The **7-item nav** (`NAV` array): `dashboard, create, queue, gallery, costs, briefs, handoff`. Queue and Gallery tabs carry live badges (live job count / unscored count).

### 3.3 Content column (`.main`)

```css
.main{max-width:1480px;margin:0 auto;padding:100px 26px 140px}
.screen{display:none}
.screen.visible{display:block}
```

- **Max content width: `1480px`**, centered.
- Top padding **100px** clears the fixed topbar (58px bar + 14px gap + breathing room).
- Screens are swapped by toggling `display` on wrapper `<div>`s (Create stays mounted; others mount on demand — see `sc-app.jsx` render block).

### 3.4 Dashboard grid (the stat-card row + panels)

```css
.dash-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.stat-card{grid-column:span 3; ...}   /* 4 stat cards across the top, span 3 each */
.dash-line{grid-column:span 8}        /* "On the line" — left, 2/3 */
.dash-next{grid-column:span 4}        /* "What next" — right, 1/3 */
.dash-wide{grid-column:span 12}       /* "Fresh from the queue" rail — full width */
```

A **12-col grid**: 4 stat cards (span-3 each) on top, then an 8/4 two-column row, then a full-width rail.

### 3.5 Two-column composer layout (Create)

```css
.create-grid{display:grid;grid-template-columns:1fr 372px;gap:18px;align-items:start}
```

- Left: fluid `create-main` (stacked glass panels).
- Right: fixed **372px** rail holding the **sticky Pre-flight HUD** (`.preflight{position:sticky;top:88px}`).

### 3.6 Horizontal card rail ("fresh from the queue")

```css
.strip{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
```

5 equal tiles across, each forced to `height:200px` with `aspectRatio:auto` so the rail is uniform regardless of source aspect ratio.

### 3.7 Gallery — masonry

```css
.gal-grid{column-count:4;column-gap:14px}
.gal-grid .tile{width:100%;margin-bottom:14px;break-inside:avoid}
```

CSS **multi-column masonry**, 4 columns. Tiles keep their native aspect ratio (`aspectRatio` set inline from `r.aspect`), giving a Pinterest-style staggered wall.

### 3.8 Other per-screen grids

- Costs top: `grid-template-columns:repeat(3,1fr)`; body `380px 1fr` (bars / ledger).
- Briefs: `grid-template-columns:repeat(3,1fr)`.
- Handoff: `grid-template-columns:repeat(2,1fr)`.
- Ledger row: `grid-template-columns:64px 1fr 150px 92px 80px`.
- Bar row: `grid-template-columns:150px 1fr 72px`.

### 3.9 Responsive behavior

**None beyond the min-width floor.** Single `@media` query in the whole system is `prefers-reduced-motion: reduce` (kills `.premiere`, spend/review card-in animations, and the job-progress flow). No width breakpoints; the app is a fixed desktop cockpit.

---

## 4. Component Inventory

### 4.1 Top nav tab (`.nav-tab`) + badge

```css
.nav-tab{position:relative;display:flex;align-items:center;gap:7px;
  padding:9px 13px;border-radius:10px;font-weight:600;font-size:13.5px;
  color:var(--ink-dim);letter-spacing:-.01em;transition:color .15s,background .15s}
.nav-tab:hover{color:var(--ink);background:rgba(255,255,255,.05)}
.nav-tab.active{color:var(--ink);background:rgba(255,255,255,.08)}
.nav-badge{font-family:var(--mono);font-size:10.5px;padding:1px 6px;border-radius:7px;
  background:rgba(255,255,255,.1);color:var(--ink)}
.nav-badge.live{background:rgba(61,220,151,.16);color:var(--pass)}   /* green = live jobs */
```

Active = brighter ink + faint white fill (no underline/indicator bar). Badges are mono pills; the **`.live` variant glows green** for in-flight queue count, the plain variant counts unscored gallery items.

### 4.2 Brand toggle / brand-lock (`.brandlock`)

The StarXI / StrikeLab segmented switch — appears in topbar (toggle on/off) and in Create (with a third "None" option).

```css
.brandlock{display:flex;gap:4px;padding:4px;border-radius:11px;
  background:rgba(255,255,255,.05);border:1px solid var(--line)}
.brandlock button{padding:5px 11px;border-radius:8px;font-size:12px;font-weight:700;
  letter-spacing:.01em;color:var(--ink-faint);transition:all .15s}
.brandlock button.on{color:#0a0c10;background:#e9ebef}   /* selected = dark text on near-white */
```

Selected segment inverts to **near-white fill, near-black text** (`#e9ebef` / `#0a0c10`) — the universal "active/selected" treatment across the whole app (also `.gal-filter.on`, `.btn-primary`). In the topbar it's a toggle (clicking the active brand sets `brandLock=null`); in Create it's a 3-way (StarXI / StrikeLab / None). It's also reused as a generic mini-segmented control in the "Log Higgsfield" modal (Kind / Brand).

### 4.3 Stat card (`.stat-card`)

```css
.stat-card{grid-column:span 3;padding:18px 20px;display:flex;flex-direction:column;gap:8px}
.stat-card .v{font-size:30px;font-weight:500;letter-spacing:-.02em}
.stat-card .v .unit{font-size:14px;color:var(--ink-faint)}   /* trailing unit, e.g. " renders" */
.stat-card .d{font-size:11.5px;color:var(--ink-dim)}          /* descriptor line */
```

Structure: `.panel-label` (tiny mono cap) → `.v` (big 30px number, often a `RollingNumber` or with embedded `FuelGauge`) → `.d` (descriptor). Glass background. The "Needs scoring" card is clickable (jumps to Gallery, filter=needs).

### 4.4 "On the line" job row (`.job-row`)

The queue/dashboard live-job row with art thumbnail, progress bar, cost, and the **"banks on completion"** microcopy.

```css
.job-row{display:flex;align-items:center;gap:16px;padding:14px 16px;border-radius:14px;
  background:rgba(255,255,255,.035);border:1px solid var(--line)}
.job-art{width:74px;height:48px;border-radius:9px;flex:none;position:relative;overflow:hidden;
  box-shadow:0 8px 28px -4px color-mix(in srgb,var(--p0,#888) calc(var(--glow)*45%),transparent)}
.job-art .veil{position:absolute;inset:0;background:rgba(6,7,10,.55);transition:opacity .4s}
.job-main{flex:1;min-width:0}
.job-title{font-weight:700;font-size:13.5px;letter-spacing:-.01em;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.job-sub{font-size:10.5px;color:var(--ink-dim);margin-top:2px}   /* mono meta line */
.job-progress{position:relative;height:5px;border-radius:99px;background:rgba(255,255,255,.08);
  overflow:hidden;margin-top:8px}
.job-progress .fill{
  position:absolute;inset:0 auto 0 0;border-radius:99px;
  background:linear-gradient(90deg,var(--p1,#777),var(--p0,#bbb),var(--p1,#777));
  background-size:200% 100%;animation:flow 1.6s linear infinite;
  transition:width .8s cubic-bezier(.2,.8,.2,1)}
@keyframes flow{from{background-position:0% 0}to{background-position:200% 0}}
.job-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none;min-width:130px}
.job-cost{font-size:13px}
.job-state{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--ink-faint);white-space:nowrap}
.job-state.gen{color:var(--ink)}   /* % readout when generating */
```

Behavior: while `generating`, the art `.veil` opacity = `max(0, 1 - progress/100)` (the thumbnail **brightens as it renders**), the progress fill is a flowing 3-stop gradient in the asset's own colors, the state shows `34%` (mono, bright), and the right column reads **"banks on completion"** (cost is only charged when the job finishes). While `queued`, state reads `QUEUED` and a ghost **Cancel** button replaces the microcopy. The meta line: `persona · model · aspect · 8s/×N · audio · BrandName`.

### 4.5 "What next" list item (`.next-item`)

```css
.next-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;
  background:rgba(255,255,255,.04);border:1px solid var(--line);cursor:pointer;transition:background .15s}
.next-item:hover{background:rgba(255,255,255,.08)}
.next-item .t{font-weight:700;font-size:13px;line-height:1.35}   /* title */
.next-item .s{font-size:11px;color:var(--ink-dim);margin-top:2px} /* subtitle */
.next-item .arrow{margin-left:auto;color:var(--ink-faint)}        /* → */
```

A dynamic recommendation list (score N renders, run a brief, N packages ready, budget past 75%) — each row is a CTA that routes to the relevant screen.

### 4.6 Render tile (`.tile`) — HERO badge + score + gradient glow

The hero component. 3D-tilt-on-hover gradient thumbnail.

```css
.tile{position:relative;border-radius:14px;overflow:hidden;cursor:pointer;
  background:#0a0b0f;border:1px solid rgba(255,255,255,.06);
  box-shadow:0 16px 50px -10px color-mix(in srgb,var(--p0,#888) calc(var(--glow)*38%),transparent);
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s;
  transform:perspective(900px)}
.tile:hover{
  transform:perspective(900px) translateY(calc(-5px*var(--motion)))
            rotateX(calc(1.4deg*var(--motion))) scale(calc(1 + .012*var(--motion)));
  box-shadow:0 26px 70px -10px color-mix(in srgb,var(--p0,#888) calc(var(--glow)*55%),transparent)}
.tile.hero{box-shadow:
  0 0 0 1px color-mix(in srgb,var(--p0,#fff) 55%,transparent),       /* lit ring */
  0 18px 70px -8px color-mix(in srgb,var(--p0,#888) calc(var(--glow)*70%),transparent),
  0 0 34px color-mix(in srgb,var(--p0,#888) calc(var(--glow)*30%),transparent)}
.tile-art{position:absolute;inset:0;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.tile:hover .tile-art{transform:scale(calc(1 + .04*var(--motion)))}   /* art parallax-zoom */
```

Sub-elements:
- **`.tile-herobadge`** (top-left): mono `HERO`, dark text on a near-white fill mixed from `--p0`, with a `--p0` glow. Only when `r.hero`.
- **`.tile-dur`** (top-right, video only): `{n}s` mono pill on blurred dark bg.
- **`.tile-shimmer`** + **`.tile-scrubline`** (video only): a 54px specular sweep + a scrub dot that **follow the cursor's x-position** when hovering a video tile (mock "scrubbing"). `mix-blend-mode:screen`.
- **`.tile-meta`** (bottom): gradient-to-dark overlay holding `.tile-title` (full-width), `.tile-sub` (mono `model · cost`), a spacer, `ProviderBadge`, and either a **`SCORE` chip** (unscored) or a **`.score-pill`** (scored; `.hi` = green when ≥8).
- **`.premiere`** class fires a one-shot `@keyframes premiere` (scale-up + brightness flash) when a freshly delivered render lands.

```css
.score-pill{font-family:var(--mono);font-size:10.5px;padding:2px 8px;border-radius:7px;background:rgba(255,255,255,.12)}
.score-pill.hi{background:rgba(61,220,151,.18);color:var(--pass)}
@keyframes premiere{
  0%{transform:scale(.9) translateY(calc(16px*var(--motion)));filter:brightness(2.4) saturate(1.4)}
  55%{filter:brightness(1.35)}
  100%{transform:none;filter:none}}
```

### 4.7 Provider badge (`.provider-badge`)

```css
.provider-badge{font-family:var(--mono);font-size:10px;font-weight:500;padding:2px 7px;
  border-radius:6px;letter-spacing:.04em}
.provider-badge.fal{border:1px solid var(--line-bright);color:var(--ink-dim)}        /* outlined */
.provider-badge.higgsfield{background:rgba(255,255,255,.12);color:var(--ink)}         /* filled */
```

Renders lowercase `fal` / `higgsfield`. fal = ghost outline; higgsfield = filled (legacy provider stands out).

### 4.8 Buttons (`.btn` family) + chips

```css
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:10px 18px;border-radius:11px;font-weight:700;font-size:13.5px;letter-spacing:-.01em;
  border:1px solid var(--line-bright);background:rgba(255,255,255,.06);transition:all .15s;white-space:nowrap}
.btn:hover{background:rgba(255,255,255,.11);transform:translateY(calc(-1px*var(--motion)))}
.btn-primary{background:#eef0f3;color:#0a0c10;border-color:transparent}   /* near-white, dark text */
.btn-primary:hover{background:#fff}
.btn-primary:disabled{opacity:.35;cursor:not-allowed;transform:none}
.btn-ghost{border-color:transparent;background:transparent;color:var(--ink-dim);padding:8px 12px}
.btn-ghost:hover{color:var(--ink);background:rgba(255,255,255,.06)}
.btn-sm{padding:6px 12px;font-size:12.5px;border-radius:9px}

.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:8px;
  font-size:11px;font-weight:700;letter-spacing:.04em;
  background:rgba(255,255,255,.08);color:var(--ink-dim);white-space:nowrap}
.chip.needs{background:rgba(255,176,46,.16);color:var(--warn)}    /* amber */
.chip.pass{background:rgba(61,220,151,.15);color:var(--pass)}     /* green */
.chip.danger{background:rgba(255,84,112,.15);color:var(--danger)} /* red */
```

Three button tiers: **primary** (near-white inverted), **default** (faint glass), **ghost** (transparent). Hover lift scales with `--motion`. Chips are semantic status tags (needs/pass/danger), default = neutral.

### 4.9 Fuel gauge / pre-flight HUD bar (`.gauge`)

The budget fuel gauge — used in topbar, stat cards, HUD, spend card, and (repurposed) brief progress.

```css
.gauge{position:relative;height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.gauge-fill{position:absolute;inset:0 auto 0 0;border-radius:99px;background:#e9ebef;
  transition:width .6s cubic-bezier(.2,.8,.2,1)}
.gauge.warn .gauge-fill{background:var(--warn)}    /* amber ≥75% */
.gauge.over .gauge-fill{background:var(--danger)}  /* red >100% */
.gauge-proj{position:absolute;top:0;bottom:0;border-radius:0 99px 99px 0;
  background:repeating-linear-gradient(135deg,rgba(255,255,255,.75) 0 3px,rgba(255,255,255,.25) 3px 6px);
  transition:left .4s,width .4s}                   /* hatched "projected spend" segment */
.gauge-mark{position:absolute;top:-2px;bottom:-2px;width:2px;background:rgba(255,176,46,.7)} /* warn tick */
```

`FuelGauge({spent, cap, projected, height, showMark})`:
- Fill width = `spent/cap`.
- Optional **hatched projected segment** appended after the fill (the cost of the job you're about to run) — this is the pre-flight "what this job adds" visualization.
- A `.gauge-mark` tick at the **75% warn line**.
- Color: green→amber (`warn` ≥ `BUDGET.warnAt` = 0.75) → red (`over` > 1.0). Threshold uses `(spent+projected)/cap`.

### 4.10 Score strip (the 0–10 quality gate, keyboard-scorable)

```css
.score-strip{display:flex;gap:4px}
.score-tick{width:32px;height:32px;border-radius:9px;font-family:var(--mono);font-size:12px;
  border:1px solid var(--line);color:var(--ink-dim);background:rgba(255,255,255,.03);transition:all .12s}
.score-tick:hover{transform:translateY(calc(-3px*var(--motion)));color:var(--ink);
  border-color:var(--line-bright);background:rgba(255,255,255,.09)}
.score-tick.hi:hover{border-color:rgba(61,220,151,.5);color:var(--pass)}   /* ≥8 hint green */
.score-tick.sel{background:#e9ebef;color:#0a0c10;border-color:transparent;font-weight:700}
.score-tick.sel.hi{background:var(--pass);box-shadow:0 0 18px rgba(61,220,151,.5)}  /* passing = green glow */
```

`ScoreStrip` renders **11 buttons (0–10)**. Ticks `≥8` carry the `.hi` class (green hover hint). Selected tick inverts; if selected AND ≥8, it turns green and glows. Scoring `≥8` flips the render to **hero**.

### 4.11 Toasts (`.toast` in `.toasts`)

```css
.toasts{position:fixed;right:22px;bottom:22px;z-index:90;display:flex;flex-direction:column;gap:10px;width:380px}
.toast{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px}  /* + .glass .premiere */
.toast-art{width:52px;height:38px;border-radius:8px;flex:none;
  box-shadow:0 6px 22px color-mix(in srgb,var(--p0,#888) calc(var(--glow)*50%),transparent)}
.toast-body{flex:1;min-width:0}
.toast-title{font-weight:700;font-size:13px;letter-spacing:-.01em}
.toast-sub{font-size:10.5px;color:var(--ink-dim);margin-top:2px}    /* mono */
.toast-x{color:var(--ink-faint);font-size:16px;padding:4px 8px;border-radius:8px}
```

Bottom-right glass cards with a glowing thumbnail of the relevant render, title + mono sub, optional action button ("Score"), and a × dismiss. Auto-dismiss after **6500ms**; max 3 stacked (`ts.slice(-2)` + new). Each enters with the `premiere` animation.

### 4.12 Spend card / hold-to-commit full-screen takeover

```css
.spend-overlay{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center}
.spend-dim{position:absolute;inset:0;background:rgba(3,4,6,.74);
  -webkit-backdrop-filter:blur(18px) saturate(.8);backdrop-filter:blur(18px) saturate(.8)}
.spend-card{position:relative;width:460px;padding:28px;border-radius:22px;display:flex;flex-direction:column;gap:18px;
  animation:cardIn .45s cubic-bezier(.2,.9,.25,1.06)}   /* + .glass, --p0 set inline */
.spend-amount{font-size:52px;font-weight:500;letter-spacing:-.03em;line-height:1}
.spend-label{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--warn);text-transform:uppercase}
.hold-btn{position:relative;overflow:hidden;width:100%;padding:15px;border-radius:13px;
  background:rgba(255,255,255,.08);border:1px solid var(--line-bright);
  font-weight:800;font-size:14px;letter-spacing:.02em;user-select:none}
.hold-btn .hold-fill{position:absolute;inset:0 auto 0 0;background:#e9ebef;width:0%}
.hold-btn .hold-label{position:relative;mix-blend-mode:difference;color:#fff}  /* inverts over the fill */
```

The **confirm-to-spend** takeover, triggered for any job over the `$1.25` threshold. Layout: amber `SPEND CONFIRMATION · OVER $1.25` label → giant **$amount** (52px mono) → meta rows (job/model/duration/count, budget-after, balance-after) → projected `FuelGauge` → the **hold button** → "Back off · esc". The hold button physically fills over **900ms** while the pointer is held; releasing early resets. Label reads `HOLD TO COMMIT $X.XX` → `KEEP HOLDING…`, with `mix-blend-mode:difference` so the text inverts as the white fill sweeps under it. Esc cancels. (Reused as a plain modal shell for the "Log Higgsfield work" form.)

### 4.13 Review overlay (quality gate) — keyboard scoring

```css
.overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:40px}
.overlay-dim{position:absolute;inset:0;background:rgba(4,5,8,.62);backdrop-filter:blur(14px)}
.review-card{position:relative;display:flex;width:min(1180px,94vw);height:min(680px,86vh);
  border-radius:22px;overflow:hidden;animation:cardIn .4s cubic-bezier(.2,.9,.25,1.05)}  /* + .glass */
.review-art{flex:1.45;position:relative;min-width:0}      /* the big media — ~59% */
.review-art.bloom::after{content:'';position:absolute;inset:0;
  background:radial-gradient(60% 60% at 50% 45%,rgba(255,255,255,.55),transparent 70%);
  animation:bloomOut 1.1s forwards}                        /* white bloom flash when a hero is unlocked */
.review-side{width:392px;flex:none;padding:26px;display:flex;flex-direction:column;gap:16px;
  border-left:1px solid var(--line);overflow-y:auto}
.review-prompt{font-size:12.5px;color:var(--ink-dim);line-height:1.6;
  background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:11px;padding:12px}
.review-nav{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:99px;
  background:rgba(10,12,16,.7);border:1px solid var(--line-bright);font-size:17px;z-index:5;backdrop-filter:blur(8px)}
.hero-banner{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:11px;
  background:rgba(61,220,151,.1);border:1px solid rgba(61,220,151,.3);color:var(--pass);
  font-weight:800;font-size:13px;letter-spacing:.02em;animation:premiere .7s}
@keyframes cardIn{from{transform:scale(.95) translateY(calc(14px*var(--motion)))}to{transform:none}}
@keyframes bloomOut{from{opacity:1}to{opacity:0}}
```

Split card: **left = big render art** (flex 1.45) with prev/next nav arrows and hero/dur badges; **right 392px side** = title + mono ID/time, the prompt block, a `.meta-rows` key/value grid (employee+avatar, model, brand, provider badge, cost, frame), an optional green **hero-banner**, the **`.panel-label`** "Quality gate — one tap, 8+ passes", and the `ScoreStrip`. **Keyboard:** `Esc` closes, `←/→` navigates prev/next, **`0`–`9` directly scores** the asset. Scoring ≥8 (when not already hero) triggers the `.bloom` flash.

### 4.14 Composer controls (content-type card, employee chip, model chip, toggle, stepper)

```css
/* content-type picker — 6-col grid */
.ct-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.ct-card{position:relative;display:flex;flex-direction:column;gap:8px;align-items:flex-start;
  padding:14px 12px;border-radius:13px;border:1px solid var(--line);background:rgba(255,255,255,.03);
  text-align:left;transition:all .15s;overflow:hidden}
.ct-card.on{border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.09)}
.ct-glyph{width:30px;height:22px;border-radius:5px;opacity:.9}   /* mini gradient art swatch */
.ct-name{font-weight:800;font-size:12px}
.ct-sub{font-family:var(--mono);font-size:9.5px;color:var(--ink-faint)}  /* "9:16 · video" */

/* employee persona chip — pill with avatar */
.emp-chip{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:99px;
  border:1px solid var(--line);background:rgba(255,255,255,.03);font-size:12px;font-weight:700;
  transition:all .15s;color:var(--ink-dim)}
.emp-chip.on{border-color:rgba(255,255,255,.5);color:var(--ink);background:rgba(255,255,255,.09)}

/* model chip — stacked name + mono price */
.model-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 13px;border-radius:11px;
  border:1px solid var(--line);background:rgba(255,255,255,.03);transition:all .15s}
.model-chip.on{border-color:rgba(255,255,255,.5);background:rgba(255,255,255,.09)}
.model-chip .n{font-weight:800;font-size:12px}
.model-chip .p{font-family:var(--mono);font-size:10px;color:var(--ink-dim)}  /* "$0.062/s" */

/* iOS-style toggle (audio, 4K) */
.toggle .tk{width:34px;height:19px;border-radius:99px;background:rgba(255,255,255,.12);position:relative}
.toggle .tk::after{content:'';position:absolute;top:2.5px;left:3px;width:14px;height:14px;border-radius:99px;
  background:#fff;transition:transform .18s}
.toggle.on .tk{background:var(--pass)}                /* on = green */
.toggle.on .tk::after{transform:translateX(14px)}

/* count stepper */
.stepper{display:flex;align-items:center;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.stepper button{width:32px;height:32px;font-size:15px;color:var(--ink-dim)}
.stepper .val{width:42px;text-align:center;font-family:var(--mono);font-size:13px}

/* duration slider */
.dur-slider input[type=range]{width:150px;accent-color:#e9ebef}
```

Note the **`.on`-state divergence**: ct/emp/model chips highlight with a *brighter border + subtle white fill* (`rgba(255,255,255,.45–.5)` border, `.09` fill) — distinct from the invert-to-white treatment used by `.brandlock`/`.gal-filter`/`.btn-primary`. Toggles light **green** when on.

### 4.15 Prompt box, rewrite rows, final-prompt preview

```css
.prompt-box{width:100%;min-height:108px;resize:vertical;padding:14px 16px;border-radius:13px;
  background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--ink);
  font-size:15px;line-height:1.55;outline:none;transition:border-color .15s}
.prompt-box:focus{border-color:var(--line-bright)}
.rewrite{display:block;width:100%;text-align:left;padding:11px 14px;border-radius:11px;font-size:13px;
  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink-dim)}  /* Improve/History suggestions */
.rewrite:hover{color:var(--ink);background:rgba(255,255,255,.07)}
.final-prompt{font-family:var(--mono);font-size:11.5px;line-height:1.7;padding:14px 16px;border-radius:12px;
  background:rgba(0,0,0,.32);border:1px solid var(--line);color:var(--ink-dim)}
.final-prompt .fp-base{color:var(--ink)}                                        /* user text — brightest */
.final-prompt .fp-emp{color:color-mix(in srgb,var(--ink) 60%,var(--p0,#9ad))}   /* employee style — tinted */
.final-prompt .fp-brand{opacity:.85}                                            /* brand lock — dim */
```

The **live final-prompt preview** is the inspectable "exactly what gets sent" block. It color-codes the three concatenated segments: user base (bright), employee style (tinted toward the asset color), brand-lock style (dim), and (if present) negative prompt in **red** (`avoid: …`). This is the transparency centerpiece of the composer.

### 4.16 Pre-flight HUD (`.preflight`)

```css
.preflight{position:sticky;top:88px;padding:20px;display:flex;flex-direction:column;gap:14px}  /* + .glass */
.hud-rows{display:flex;flex-direction:column;gap:7px}
.hud-row{display:flex;justify-content:space-between;align-items:baseline;gap:14px;
  font-family:var(--mono);font-size:11.5px;color:var(--ink-dim)}
.hud-row .k{font-size:10px;letter-spacing:.12em;color:var(--ink-faint);text-transform:uppercase;white-space:nowrap}
.hud-row.em{color:var(--ink)}
.hud-divider{height:1px;background:var(--line);margin:4px 0}
.hud-estimate .v{font-size:31px;font-weight:500;letter-spacing:-.02em}
.hud-warning{display:flex;gap:9px;align-items:center;padding:10px 12px;border-radius:10px;font-size:12px;font-weight:700}
.hud-warning.warn{background:rgba(255,176,46,.1);border:1px solid rgba(255,176,46,.3);color:var(--warn)}
.hud-warning.danger{background:rgba(255,84,112,.1);border:1px solid rgba(255,84,112,.32);color:var(--danger)}
```

The sticky right-rail cost readout. Telemetry rows (unit / count / duration / audio / 4K) → divider → big **Estimate** (RollingNumber) → projected `FuelGauge` → spent-today / after-this-job / cap / balance rows → contextual warning banners → the primary CTA button ("Send to the line · $X.XX", or "CAP REACHED" disabled). Warnings escalate: amber at >75% projected, amber for >$1.25 confirm-required, red for over-cap.

---

## 5. Per-Screen Layout

### 5.1 Dashboard

Headline row: **`The floor is live.`** (`.hero-h`) on the left, date/shift stamp `THU JUN 12 · SHIFT 2` (mono, dim, wide-tracked) on the right.

12-col grid:
1. **4 stat cards** (span-3): *Made today* (N renders + hero-eligible count), *Spent today* (RollingNumber + FuelGauge), *Budget left* (RollingNumber, colored by ratio), *Needs scoring* (count; clickable → Gallery filter=needs; copy flips between "Tap to open the gate" / "Gate is clear").
2. **`On the line — N jobs`** (span-8): list of live `JobRow`s, empty state "Line is idle. Send something from Create."
3. **`What next`** (span-4): dynamic `.next-item` CTAs.
4. **`Fresh from the queue`** (span-12): the 5-up horizontal tile rail (each `height:200px`), freshly delivered ones flash `premiere`. Click → review overlay.

### 5.2 Create (composer)

Headline: **`What are we making?`**. Two columns (`1fr / 372px`):

**Left (`create-main`)** — stacked glass panels:
1. **Content-type picker** — 6-card grid (`Social vertical`, `Hero film`, `Ref sheet`, `Storyboard`, `Infographic`, `Typography card`), each with a mini gradient glyph, name, and mono spec sub. Picking one auto-selects its default employee/model/count/duration.
2. **`Who's on it`** — employee persona chips (avatar + name + mono id) for the 9 personas (Vega, Juno, Sable, Otis, Pim, Ilsa, Rooke, Calder, Nyx); plus inline **Brand lock** segmented control (StarXI / StrikeLab / None) and a "<Brand> style appended" chip.
3. **Prompt box** + composer tools row: **`✦ Improve`** (generates 3 mock rewrite rows), **`History (N)`** (recent prompts), and **`More`/`Less`** (reveals Native-audio toggle [+$0.02/s], 4K-master toggle [×2.0], and negative-prompt input).
4. **`Model router — every selection shows unit price`** — model chips filtered to the current kind (image/video), each showing the mono unit price; plus a knob row (Count stepper, Duration slider for video, Frame readout).
5. **`Final prompt — exactly what gets sent`** — the color-coded live preview (§4.15).

**Right rail** — the **sticky Pre-flight HUD** (§4.16). Submitting under $1.25 sends straight to the line (toast "On the line"); over $1.25 opens the **Spend card** takeover.

### 5.3 Queue

Headline `Queue`. Three stacked glass sections:
1. **`Generating — N of 2 slots`** — active `JobRow`s (the system runs **max 2 concurrent**), empty "Both slots open."
2. **`Waiting — N`** — queued jobs, each prefixed with a mono position number (1, 2, …).
3. **`Recently delivered`** — last 6 ready jobs (reversed), compact rows with an "In gallery →" link that opens the matching render in the review overlay.

### 5.4 Gallery

Headline `Gallery` + an amber `N AWAITING THE GATE` chip. Filter bar (`.gal-filter`): **All / Needs scoring / Heroes / StarXI / StrikeLab / Video / Stills** (active filter inverts to near-white). Below: the 4-column masonry tile wall. Clicking a tile opens the **Review overlay** (§4.13). Empty state per-filter.

### 5.5 Costs

Headline `Costs` + a **`+ Log Higgsfield work`** button (opens a modal reusing the spend-card shell). Top row of 3 stat cards: *Spent today* (FuelGauge + "% of $7.50 shared cap · warn at 75%"), *Left today*, *fal balance*. Body grid (`380px / 1fr`):
- **`Today by model`** — horizontal bar chart (`.bar-row`: label / bar / mono cost), bars sorted desc, normalized to the top spender.
- **`One ledger — both providers`** — a unified ledger table (`.ledger-row`: time / item / model / provider-badge / cost), mono head row. The point: fal auto-spend and manually-logged Higgsfield spend share one ledger.

### 5.6 Briefs (batch runner)

Headline `Briefs` + sub "Batch runner — one brief, many jobs, one preflight." 3-col grid of **brief cards**, each: title + brand chip, description, an itemized list (`.brief-item`: title / mono `model · cost`), a divider, a mono **`Batch estimate`** total, and a **`Run brief · $X.XX`** primary button (disabled "EXCEEDS REMAINING BUDGET" if over remaining). Running a brief enqueues all its jobs at once; once running, the button is replaced by a **progress FuelGauge** (repurposed: spent=`done`, cap=`item count`) + status text (`RUNNING · 1/4 delivered` → green `✓ DELIVERED — 4/4`). Over-$1.25 batches route through the Spend card first.

### 5.7 Handoff (Higgsfield legacy)

Headline `Handoff` + sub "Higgsfield paste packages — copy, run on the web, log the result back into the one ledger." 2-col grid of **package cards**, each: title + brand chip (or green `LOGGED` chip), a gradient thumbnail + a monospace **paste-ready prompt block** (`.pkg-prompt`, preserves newlines, includes brand lock-style and `[aspect · duration]`), then a row with **Copy package** (→ "✓ Copied" for 1600ms, writes to clipboard), an `actual cost` mono input, and a **Log result** primary button that writes to the shared ledger and marks the card logged (dims to 0.65 opacity). This is the manual bridge for the not-yet-automated Higgsfield provider.

---

## 6. The Tweaks Panel

Two distinct pieces of UI live under "tweaks":

### 6.1 The app's tweak controls (`sc-app.jsx`)

The four app-specific tweaks, defaults persisted in the `/*EDITMODE-BEGIN*/…/*END*/` JSON block:

```js
const TWEAK_DEFAULTS = {
  "glowIntensity": 100,   // %
  "glassOpacity": 72,     // %
  "motionAmplitude": 100, // %
  "canvasWarmth": 25      // 0–100 mix amount
};
```

Rendered into two labeled sections:

| Section | Control (label) | Min | Max | Step | Default | Unit | Drives |
|---|---|---|---|---|---|---|---|
| **ATMOSPHERE** | Glow intensity | 0 | 200 | 5 | 100 | `%` | `--glow = value/100` → scales every `color-mix` glow / shadow on tiles, job-art, toasts, avatars, hero rings. |
| ATMOSPHERE | Glass opacity | 35 | 95 | 1 | 72 | `%` | `--glass-a = value/100` → alpha of the `.glass` dark fill (more opaque = more solid chrome). |
| ATMOSPHERE | Canvas warmth | 0 | 100 | 5 | 25 | (none) | `--canvas = mixHex('#06080d','#0e0b07', value/100)` → blends the near-black bg from **cool blue-black → warm brown-black**. |
| **MOTION** | Motion amplitude | 0 | 200 | 10 | 100 | `%` | `--motion = value/100` → scales hover-lift translate, tile tilt/zoom, premiere/cardIn entrance offsets, score-tick lift. 0 = static. |

Wiring (`sc-app.jsx`, in a `useEffect` on `[t]`):
```js
r.setProperty('--glow', t.glowIntensity / 100);
r.setProperty('--glass-a', t.glassOpacity / 100);
r.setProperty('--motion', t.motionAmplitude / 100);
r.setProperty('--canvas', mixHex('#06080d', '#0e0b07', t.canvasWarmth / 100));
```

`mixHex(h1,h2,t)` linearly interpolates two hex colors channel-by-channel (defined in `sc-core.jsx`). Note: `--canvas` warmth interpolates between `#06080d` and `#0e0b07`, **not** the literal default token `#07090d` — at warmth 25 it lands close to it.

### 6.2 The reusable Tweaks shell (`tweaks-panel.jsx`)

A generic, *separately-themed* floating panel (light glass — deliberately not part of the dark app skin; it's host chrome). Key facts for a rebuild:

- **Position:** `position:fixed; right:16px; bottom:16px; z-index:2147483646; width:280px`, draggable by its header, clamped to viewport.
- **Look:** `background:rgba(250,249,247,.78)` (warm near-white), `color:#29261b`, `backdrop-filter:blur(24px) saturate(160%)`, `border:.5px solid rgba(255,255,255,.6)`, `border-radius:14px`, `font:11.5px/1.4 ui-sans-serif`. (This is a light "macOS inspector" aesthetic, intentionally divorced from the cockpit.)
- **Hidden by default** — only opens when the host posts `__activate_edit_mode`. Announces `__edit_mode_available` on mount; persists edits via `postMessage({type:'__edit_mode_set_keys', edits})` (host rewrites the EDITMODE block on disk) and dispatches a same-window `tweakchange` event.
- **`useTweaks(defaults)`** returns `[values, setTweak]`; `setTweak('key', val)` or `setTweak({…})`.
- **Control library** (the floor of available inputs): `TweakSection` (uppercase cap heading), `TweakSlider`, `TweakToggle` (iOS switch, green when on), `TweakRadio` (segmented control, auto-falls-back to `TweakSelect` when labels are long / >3 options), `TweakSelect`, `TweakText`, `TweakNumber` (with horizontal scrub-to-change on the label), `TweakColor` (curated swatch/palette chips with contrast-aware checkmark), `TweakButton`. The app only uses `TweakSection` + `TweakSlider`.

---

## 7. Motion & Interaction

The app is **alive**: a global ticker drives a self-running production line.

### 7.1 Global ticker (`sc-app.jsx`)

`useInterval(…, 900)` — every **900ms**:
- Advances each `generating` job's `progress` by `3.5 + random()*8.5`.
- A job hitting 100% flips to `ready` and fires `handleComplete` → creates a render, appends to ledger, **banks the cost** (`spentToday += cost`, `balance -= cost`), marks it "fresh" for 4500ms, pushes a "Render delivered · banked $X" toast, and (crossing 75%) a budget toast.
- Promotes `queued` → `generating` while fewer than **2** slots are busy.

### 7.2 Rolling numbers (`RollingNumber`)

Every money/balance/estimate that changes animates: `requestAnimationFrame` tween over **650ms** with **cubic ease-out** (`1 - (1-k)^3`) from old to new value. Mono + tabular-nums so width is stable. Used in topbar balance, stat cards, HUD estimate/spent/balance, spend card.

### 7.3 Job state transitions

- Art `.veil` opacity = `1 - progress/100` → thumbnail **clears/brightens** as it renders.
- Progress fill = a 200%-wide 3-stop gradient (`--p1, --p0, --p1`) animated by `@keyframes flow` (`background-position` 0→200% over 1.6s, infinite) → a **flowing energy bar** in the asset's color. Width transitions over 0.8s ease.
- State text flips `QUEUED` → live `%` (brightens via `.gen`).

### 7.4 Toasts

Slide in with `premiere`, auto-dismiss at 6500ms, capped at 3, glow in the asset color, optional one-tap action.

### 7.5 Hover / glow

- Tiles: 3D perspective tilt (`translateY -5px`, `rotateX 1.4deg`, `scale 1.012`) + glow grows (38%→55% of `--glow`) + inner art zooms 4% — all scaled by `--motion`.
- Buttons / chips / score-ticks: subtle lift (`translateY -1px/-3px * --motion`) + brighten.
- Video tiles: cursor-following specular shimmer + scrub dot (mock scrubbing).

### 7.6 Hold-to-commit (spend card)

`onPointerDown` starts a `requestAnimationFrame` loop that fills `.hold-fill` 0→100% over **900ms**; reaching 1.0 commits the spend; `onPointerUp`/`onPointerLeave` cancels and resets. The label inverts under the sweeping white fill via `mix-blend-mode:difference`. `Esc` cancels. This is a **deliberate friction gate** — you must physically hold to spend over $1.25.

### 7.7 Keyboard scoring (review overlay)

While open: `Esc` close, `←/→` prev/next asset, **`0`–`9` instantly set the score**. Scoring ≥8 (newly) fires the white `bloom` radial flash and unlocks hero (green hero-banner + glowing border + gallery hero status). One-tap, keyboard-first — built for fast triage of a render queue.

### 7.8 Entrance / premiere animations

- `@keyframes premiere` (0.7–0.8s): scale-up from 0.9 + brightness/saturation flash → settles. Fires on new renders, toasts, hero-banner.
- `@keyframes cardIn` (0.4–0.45s): scale 0.95 + translateY → none. Spend card, review card.
- `@keyframes shimmer` / `.skeleton`: loading sweep (defined, for skeleton states).
- All entrance offsets scale with `--motion`; `prefers-reduced-motion` disables premiere/cardIn/flow.

---

## 8. Voice & Copy

The microcopy is the personality: a **warm, confident floor manager** running a live production room — never a terminal, never corporate. Momentum-forward, second-person, slightly swaggering.

Signature lines (verbatim):
- **"The floor is live."** — the Dashboard headline. The thesis of the whole product.
- **"What are we making?"** — Create headline (collaborative, present-tense).
- **"On the line"** — the live job zone (a job is "on the line", a brief goes "on the line"). Submitting fires a toast titled **"On the line"**.
- **"banks on completion"** — the per-job microcopy explaining cost is only charged when a render lands. Completed renders are **"banked"** ("banked $0.50", "Render delivered · banked $X").
- **"Send to the line · $X.XX"** — the primary submit CTA.
- **"Tap to open the gate"** / **"Gate is clear"** — the Needs-scoring stat-card states. The quality review is **"the gate"**.
- **"N AWAITING THE GATE"** / **"Quality gate — one tap, 8+ passes"** — gallery + review.
- **"Hero unlocked"** / **"★ HERO — scored 9 · shines in the gallery"** — scoring ≥8. Top assets are **"heroes"** that **"shine"**.
- **"HOLD TO COMMIT $X.XX"** → **"KEEP HOLDING…"** / **"Back off · esc"** — the spend gate.
- **"Spend confirmation · over $1.25"** — amber spend label.
- **"$ Over $1.25 — explicit confirm required"**, **"▲ This job takes you past 75% of the daily cap"**, **"▲ Exceeds today's remaining budget"** / **"CAP REACHED"** — escalating budget warnings.
- **"Line is idle. Send something from Create."**, **"Both slots open."**, **"Nothing waiting."**, **"No prompts sent yet this shift."** — empty states (note "this shift" — the studio runs in shifts; the date stamp reads `· SHIFT 2`).
- **"Batch runner — one brief, many jobs, one preflight."** — Briefs sub.
- **"One ledger — both providers"**, **"Higgsfield spend logged manually, same ledger"** — Costs framing (one source of truth).
- **"Higgsfield paste packages — copy, run on the web, log the result back into the one ledger."** — Handoff sub.
- **"every selection shows unit price"**, **"Final prompt — exactly what gets sent"** — radical cost/output transparency.
- **"Route remaining jobs to schnell"** — the concept-vs-hero budget nudge.

Symbol vocabulary: `✦` (improve/AI), `★` (hero), `▲` (warning), `$` (cost confirm), `→` (next/route), `✓` (done/copied), `×`/`✕` (dismiss). Telemetry words are clipped and uppercase (`QUEUED`, `HERO`, `LOGGED`, `RUNNING`, `BALANCE`, `SHIFT 2`); human words are warm and lowercase.

---

## Appendix — constants & data shapes (for parity)

```js
BUDGET = { cap: 7.50, warnAt: 0.75, spendCardThreshold: 1.25 }   // daily shared cap, 75% warn, $1.25 confirm gate
initial: spentToday = 3.00, balance = 23.84, brandLock = 'starxi'
concurrency: max 2 generating slots; ticker 900ms; fresh window 4500ms; toast TTL 6500ms; hold 900ms
```

Estimate formula (`estimateFor`): `per = video ? unit*duration : unit` (+`audioUnit*duration` if audio) `× count`, `×2` if 4K, rounded to 3 decimals.

Models (id · kind · unit · label): `flux-schnell` img $0.004 · `flux-dev` img $0.025 · `nano-banana-pro` img $0.039 · `gpt-image-2` img $0.06 · `seedance-1` vid $0.062/s · `veo-3.1` vid $0.12/s (+$0.02/s audio) · `kling-3-pro` vid $0.14/s.

Brands: **StarXI** (`pitchGold`, gold+cream+pitch-green figurine finish — 2026 World Cup squad-drafting) · **StrikeLab** (`coolStrike`, cool-green precision-grid matte — golf). Brand lock appends a `lockStyle` string to the final prompt.
