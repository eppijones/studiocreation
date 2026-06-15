# StudioCreation — Design v1 ("Production Cockpit") Build Spec

> Reverse-engineered from `design-reference/v1/` (`styles v2.css`, `app_v2.jsx`,
> the `screen_*.jsx` set, `tweaks-panel.jsx`, `store.jsx`, `data.jsx`, `ui.jsx`,
> `ui_v2_patch.jsx`, `StudioCreation v2.html`).
>
> **Signature:** a dark, "kinetic production cockpit" with a fixed **left sidebar
> (rail)**, a warm time-aware greeting ("Good afternoon, Alex."), animated mesh-gradient
> media thumbnails, a sliding "ink" nav indicator, count-up budget numbers, and a live
> floating **Tweaks** panel that re-skins the whole app between three skins —
> **onyx** (default, electric cobalt on blue-black), **volt** (neon lime on near-black),
> and **lumen** (ink + indigo on light studio paper).
>
> All screens share one class contract. The CSS file is the single source of truth for
> tokens; the Tweaks panel overrides a handful of them live at runtime via inline
> `documentElement.style` properties.

---

## 0. Stack & Bootstrap

- React 18.3.1 (UMD `react.development.js` + `react-dom`) compiled in-browser with
  **Babel Standalone 7.29**. Each screen is a `<script type="text/babel">`.
- No bundler, no JSX build step. Components register themselves on `window.*`
  (`window.DashboardScreen`, `window.Btn`, `window.DATA`, `window.Icon`, …) and resolve
  peers lazily at render time — that is how `ui_v2_patch.jsx` can override `Media`/`Spark`
  after `ui.jsx` defines them.
- Mount point `<div id="root">`. Boot loop polls until all globals exist, then calls
  `window.__renderApp()`.
- **Web fonts (Google Fonts):** loaded in `<head>`:
  `Space Grotesk` 500/600/700, `Archivo` 400/500/600/700, `JetBrains Mono` 400/500/600.
- `<body>` has `overflow:hidden`; `#root` is `height:100vh`. The shell scrolls internally,
  never the page.
- Script load order (matters — patch & app come last):
  `data → store → ui → ui_v2_patch → screens → tweaks-panel → app_v2 → boot`.

---

## 1. Design Tokens

All tokens are CSS custom properties on `:root`. Skins override a **subset** via
`[data-skin="volt"]` / `[data-skin="lumen"]` attribute selectors on `<html>`. The
Tweaks panel additionally overrides the accent family and radii inline at runtime.

### 1.1 Surfaces — onyx (default `:root`)
```css
--bg-0: #07090f;   /* app canvas / deepest */
--bg-1: #0a0d15;   /* rail bg, inset wells, inputs */
--bg-2: #10141d;   /* card bg */
--bg-3: #171c28;   /* buttons, chips, raised nav ink */
--bg-4: #202635;   /* button hover, tooltip */
--scrim: rgba(4,6,12,0.72);   /* modal backdrop */
```

### 1.2 Hairlines (borders)
```css
--line-1: rgba(160,180,255,0.07);  /* faintest — card borders */
--line-2: rgba(170,188,255,0.12);  /* button/input borders */
--line-3: rgba(180,196,255,0.19);  /* hover borders */
--inset-hi: rgba(190,205,255,0.06); /* top inset highlight (the 1px sheen) */
```

### 1.3 Text
```css
--tx-1: #f1f3f9;  /* primary */
--tx-2: #aab1c2;  /* secondary / body */
--tx-3: #737b90;  /* muted / labels */
--tx-4: #494f61;  /* faintest / placeholders, footnotes */
```

### 1.4 Accent (named `--gold*` for legacy screen compat — onyx = cobalt blue)
```css
--gold:      #5b6cff;  /* base accent */
--gold-hi:   #8392ff;  /* bright accent (text, glow) */
--gold-dim:  #3a47c2;  /* deep accent (button bottom of gradient) */
--gold-wash: rgba(91,108,255,0.13);  /* tinted fill */
--gold-line: rgba(91,108,255,0.36);  /* accent border */
--gold-glow: rgba(91,108,255,0.30);  /* shadow/glow */
--accent-tx: #ffffff;  /* text on accent (auto-flips to #101207 on light accents) */
```
> NOTE: the class/variable name is `gold` everywhere but the **default color is cobalt
> blue**, not gold. "Gold" survives only as `--starxi` brand DNA. When rebuilding, rename
> to `--accent*` but keep the mapping.

### 1.5 Status colors (each has base / `-wash` fill / `-tx` text)
```css
--ok:    #3fd68f;  --ok-wash: rgba(63,214,143,0.12);   --ok-tx: #7ce8b8;   /* pass/ready */
--run:   #4da3ff;  --run-wash: rgba(77,163,255,0.12);  --run-tx: #93c5ff;  /* generating */
--warn:  #e3a93c;  --warn-wash: rgba(227,169,60,0.14); --warn-tx: #f0c46e; /* budget warn */
--bad:   #ff5f57;  --bad-wash: rgba(255,95,87,0.13);   --bad-tx: #ff9b95;  /* fail/over-cap */
--queued:#8a90a0;  --queued-wash: rgba(138,144,160,0.12); --queued-tx: #b6bbc8;
```

### 1.6 Brand DNA & Providers
```css
--starxi:    #d8b24a;  --starxi-2: #2f6b4a;  --starxi-3: #efe6cf; /* gold/green/cream */
--strikelab: #6fb7c4;  --strikelab-2: #cfd6da;                    /* teal/silver */
--fal:   #c98bff;  /* provider violet */
--higgs: #7fd1c0;  /* provider mint */
```

### 1.7 Media tile + ambient glow
```css
--m2-base: #0a0d18;   /* media tile base under the mesh gradient */
--m2-sat: 1;          /* mesh saturation multiplier */
--amb-1: rgba(91,108,255,0.07);  /* top-right canvas glow */
--amb-2: rgba(201,139,255,0.05); /* bottom-left canvas glow */
--thumb: rgba(170,188,255,0.12);        /* scrollbar */
--thumb-hover: rgba(170,188,255,0.22);
```

### 1.8 Radius scale
```css
--r-xs: 6px;  --r-sm: 9px;  --r-md: 12px;  --r-lg: 16px;  --r-xl: 22px;  --r-pill: 999px;
```
> Tweaks panel drives radius live from one slider (`--r-lg`); see §6.

### 1.9 Spacing scale
```css
--s1:4px --s2:8px --s3:12px --s4:16px --s5:20px --s6:24px --s7:32px --s8:40px --s9:56px
```
Helper classes: `.gap1`…`.gap6` map `--s1`…`--s6`.

### 1.10 Elevation / shadows
```css
--el-1:   0 1px 0 0 var(--inset-hi) inset, 0 1px 2px rgba(0,0,0,0.4);      /* cards */
--el-2:   0 1px 0 0 var(--inset-hi) inset, 0 8px 24px -10px rgba(0,0,0,0.65);
--el-3:   0 1px 0 0 var(--inset-hi) inset, 0 18px 50px -16px rgba(0,0,0,0.7);
--el-pop: 0 1px 0 0 var(--inset-hi) inset, 0 28px 80px -20px rgba(0,0,0,0.85); /* modals/menus */
--glow-gold: 0 0 0 1px var(--gold-line), 0 8px 30px -8px var(--gold-glow);  /* selected card halo */
```
Every elevation carries the `inset-hi` top-edge sheen — this is what gives cards their
"lit from above" look.

### 1.11 Motion tokens
```css
--ease-spring: cubic-bezier(0.32, 0.72, 0, 1);   /* nav ink, primary settle */
--ease-out:    cubic-bezier(0.22, 1, 0.36, 1);    /* default */
--ease-snap:   cubic-bezier(0.34, 1.56, 0.64, 1); /* overshoot pop */
--t-fast: 140ms;  --t-base: 220ms;  --t-slow: 380ms;
```

### 1.12 Glass / blur values (used as raw values, not tokens)
- Modal overlay: `backdrop-filter: blur(10px) saturate(1.1)`.
- Tweaks panel: `backdrop-filter: blur(24px) saturate(160%)` on a `rgba(250,249,247,.78)` base.
- Media `.ph-label`: `backdrop-filter: blur(3px)` on `rgba(0,0,0,0.35)`.
- Score badges / video play button: `backdrop-filter: blur(4px)` / `blur(3px)`.

### 1.13 Skin overrides

The skin attribute lands on `<html data-skin="…">`. Only the listed vars change; everything
else inherits onyx.

**VOLT — near-black, neon lime** `[data-skin="volt"]`
```css
--bg-0:#050505 --bg-1:#0a0a0a --bg-2:#0f0f10 --bg-3:#171716 --bg-4:#20201e
--scrim: rgba(2,3,0,0.76);
--line-1: rgba(230,255,140,0.06);  --line-2: rgba(235,255,160,0.11);
--line-3: rgba(240,255,180,0.18);  --inset-hi: rgba(245,255,200,0.05);
--tx-1:#f4f5ee --tx-2:#b0b2a4 --tx-3:#797b6e --tx-4:#4d4f44
--m2-base:#090b05
--amb-1: rgba(198,242,34,0.05);  --amb-2: rgba(127,209,192,0.04);
--thumb: rgba(235,255,160,0.1);  --thumb-hover: rgba(235,255,160,0.2);
```
Accent (set by Tweaks when skin picked): `--gold #c6f222`, `--gold-hi #d8ff45`.
The lime accent's luminance is high, so `--accent-tx` auto-flips to `#101207` (dark text on lime buttons).

**LUMEN — light studio** `[data-skin="lumen"]`
```css
--bg-0:#f1f0ed --bg-1:#f8f7f5 --bg-2:#ffffff --bg-3:#efeeea --bg-4:#e5e3de
--scrim: rgba(24,26,34,0.42);
--line-1: rgba(22,26,40,0.08);  --line-2: rgba(22,26,40,0.13);
--line-3: rgba(22,26,40,0.22);  --inset-hi: rgba(255,255,255,0.8);
--tx-1:#15161c --tx-2:#4b4e59 --tx-3:#83868f --tx-4:#b5b6bd
/* status re-tuned darker for light bg */
--ok:#18915c (-tx #11724a) --run:#1d6fd6 (-tx #1858ac)
--warn:#b07a18 (-tx #8d6212) --bad:#d23f38 (-tx #ad2f29) --queued:#888b95 (-tx #5e616b)
--m2-base:#12141d  --m2-sat:1.05
--amb-1: rgba(70,85,240,0.05);  --amb-2: rgba(255,140,99,0.05);
/* shadows softened & re-colored toward ink */
--el-1: 0 1px 0 0 var(--inset-hi) inset, 0 1px 2px rgba(24,26,40,0.07);
--el-2: 0 1px 0 0 var(--inset-hi) inset, 0 8px 24px -10px rgba(24,26,40,0.16);
--el-3: 0 18px 50px -16px rgba(24,26,40,0.22);
--el-pop: 0 28px 80px -20px rgba(24,26,40,0.3);
--thumb: rgba(22,26,40,0.14);  --thumb-hover: rgba(22,26,40,0.26);
```
Accent (Tweaks): `--gold #4655f0`, and for lumen the bright variant is forced to
`color-mix(in oklab, #4655f0 78%, #14151c)` so accent text reads on white.

**Skin → accent map** (`SKIN_ACCENT` in `app_v2.jsx`):
| skin | `--gold` | `--gold-hi` |
|---|---|---|
| onyx | `#5b6cff` | `#8392ff` |
| volt | `#c6f222` | `#d8ff45` |
| lumen | `#4655f0` | `#6470ff` |

---

## 2. Typography

### 2.1 Families
```css
--font-display: "Space Grotesk", "Archivo", system-ui, sans-serif;  /* headings, numbers, labels */
--font-sans:    "Archivo", system-ui, "Segoe UI", Helvetica, Arial, sans-serif; /* body / default */
--font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace; /* all money & metrics */
```
- **Space Grotesk** is the brand voice: used for the display heading, h1/h2, ALL-CAPS
  micro-labels (`.t-label`), and big tabular numbers (`.tnum`).
- **Archivo** is the workhorse body sans.
- **JetBrains Mono** carries *every* cost, percentage, timecode, ETA, count and ledger value.
  This mono-for-numbers discipline is a core identity move — dollars never render in the body sans.

### 2.2 Base
`body`: 14px / 1.45, `letter-spacing:-0.005em`, antialiased, `optimizeLegibility`.

### 2.3 Type roles (classes)
| class | font | size | weight | tracking | use |
|---|---|---|---|---|---|
| `.t-display` | display | 32px | 700 | -0.035em / lh 1.05 | greeting hero ("Good afternoon, Alex.") |
| `.t-h1` | display | 22px | 700 | -0.025em | screen titles |
| `.t-h2` | display | 17px | 600 | -0.015em | sub-headers, modal titles |
| `.t-h3` | sans | 14px | 620 | -0.01em | card headers |
| `.t-body` | sans | 13.5px | 440 | — (color tx-2) | sub-line under titles |
| `.t-sm` | sans | 12.5px | 460 | — (tx-2) | dense rows |
| `.t-xs` | sans | 11px | 500 | — (tx-3) | captions |
| `.t-label` | display | 10.5px | 600 | **0.14em UPPERCASE** (tx-3) | section eyebrows / kickers |
| `.mono` | mono | inherit | — | -0.02em, tabular-nums | all metrics |
| `.tnum` | display | inherit | — | tabular-nums | big KPI counters |

Big counters in screens override size/weight inline (e.g. KPI value `28px/660`, cost total
`30px/680`, estimate `30px`, KPI accent colors).

### 2.4 Uppercase / tracking treatments
- Eyebrows (`.t-label`) are uppercase, 0.14em tracked, colored `--gold` on screen headers
  to act as a "you-are-here" kicker (`Create`, `Gallery · Review`, `Costs · Ledger`).
- Ledger header row (`.lhead`) uses uppercase 0.08em.
- Rail sub-name "PRODUCTION COCKPIT" is uppercase 0.2em at 8.5px in `--tx-4`.
- `::selection` is `--gold-wash` bg with `--gold-hi` text.

---

## 3. Layout System

### 3.1 Shell composition (`App` in `app_v2.jsx`)
```
<div.row height:100vh>           // flex, align-items:stretch
  <aside.rail width:236px>       // fixed left sidebar (see §4.1)
  <main flex:1 overflow:hidden>  // column
    <ActivityRibbon/>            // 2px top progress sweep when jobs run
    <div.screen-wrap overflow:auto key={screen}>  // scroll container, remounts per screen
      {ScreenComponent}
  <ToastHost/>                   // fixed bottom-right
  <TweakLayer/>                  // floating Tweaks panel (bottom-right)
```
- Only the `.screen-wrap` scrolls; the rail and chrome are fixed.
- `key={s.screen}` forces a remount on navigation → re-triggers the entrance animation.
- Ambient glow comes from `body::before` (two radial gradients, top-right `--amb-1` &
  bottom-left `--amb-2`), `position:fixed; z-index:0; pointer-events:none`. Keeps the dark
  canvas from reading flat.

### 3.2 Screen scaffold
```css
.screen-pad { padding: 26px 32px 64px; max-width: 1340px; margin: 0 auto; }
.screen-hd  { display:flex; align-items:flex-end; justify-content:space-between;
              margin-bottom:24px; gap:16px; }
```
Per-screen `max-width` overrides: Composer 1280, Costs 1200, Briefs 1200, Handoff 1120,
Queue 1040. Dashboard uses the default 1340.

### 3.3 Common content grids
- **Dashboard / Costs main grid:** `grid-template-columns: minmax(0,1.6fr) minmax(0,1fr)` (Costs `1.5fr`), `gap:18px`, `align-items:start`. Right column on Costs/Composer is `position:sticky; top:0`.
- **Composer main grid:** `minmax(0,1.55fr) minmax(0,1fr)`.
- **Dashboard KPI row:** flexbox `.row.gap4`, four equal `flex:1` cards.
- **Content-type picker:** `grid repeat(6, minmax(0,1fr))`, gap 10.
- **Latest renders / recent:** `grid repeat(4, minmax(0,1fr))`, gap 10.
- **Gallery grid:** masonry via CSS `column-count:4; column-gap:12px` (tiles `break-inside:avoid`), or `grid repeat(4,…)`; toggled by Tweaks/Seg.
- **Briefs / Handoff:** two-column `300px minmax(0,1fr)` (list + detail).

### 3.4 Responsive
No media-query breakpoints for layout (it is a desktop cockpit). The only responsive rules are:
- `@media (prefers-reduced-motion: reduce)` → all animation/transition durations forced to `0.001ms`.
- Density (a Tweak, not a viewport) rewrites `.screen-pad`/`.card-pad`/`.card-hd` padding — see §6.
- Tweaks panel self-clamps to viewport on resize.

### 3.5 Layout primitives (utility classes)
`.row` (flex+center), `.col` (flex column), `.between` (space-between center), `.wrap`,
`.grow` (flex:1), `.gap1`–`.gap6`. Dividers: `.hr` (1px `--line-1` horizontal),
`.vr` (1px vertical, stretches).

---

## 4. Component Inventory

### 4.1 Rail / Sidebar — `.rail`
```css
.rail { width:236px; flex:none; display:flex; flex-direction:column; gap:4px;
        background:var(--bg-1); border-right:1px solid var(--line-1);
        padding:18px 12px 14px; position:relative; z-index:2; }
```
Vertical stack: **brand** → **nav** → spacer (`.grow`) → **budget gauge card** → **operator button**.

**Brand** `.rail-brand`: row, gap 11, padding `2px 8px 18px`.
- `.glyph`: 32×32, radius 10, accent gradient `linear-gradient(150deg, var(--gold-hi), var(--gold-dim))`, inset white sheen + `0 6px 18px -6px var(--gold-glow)`, holds a white `bolt` icon.
- `.name`: display 15px/700, -0.02em. Sub: "PRODUCTION COCKPIT" 8.5px/600 uppercase 0.2em `--tx-4`.

**Nav** `.rail-nav` (relative). The defining detail is the **sliding ink**:
- `.nav-ink`: absolute pill behind the active item, `height:40px; radius:11px; background:var(--bg-3); box-shadow:var(--el-1)`. It slides via `transition: top 0.42s var(--ease-spring)` to `top: idx*42`.
- `.nav-ink::before`: a 3px accent bar on its left edge (`top/bottom:11px`, `border-radius:0 3px 3px 0`, `background:var(--gold-hi)`, glow `0 0 10px var(--gold-glow)`).
- `.navitem2`: 40px tall, padding `0 11px`, transparent, `justify-content:space-between`. Label `.nlabel` 13.5px/500 (→620 when `.on`) and nudges `translateX(2px)` on hover. Icon `.nicon` → `--gold-hi` when active, `scale(0.85)` on `:active`.
- `.nav-badge`: 18px min, radius 9, mono 11px/680. Variants `.run` (running count, run-wash) and `.accent` (needs-scoring count, gold-wash).

**Nav model** (`NAV` array): `Dashboard, Create, Queue (badge=active count), Gallery (badge=score count), Costs, Briefs, Handoff`. Each ~42px slot.

**Budget gauge card** (a `.card`, padding 13): label "DAILY BUDGET" with gauge icon, `%` (turns `--warn-tx` ≥75%), `<Gauge>`, count-up "$x used / $y left", a 75% warning row, an `.hr`, then two metric rows — **fal balance** (sq dot `--fal`, turns `--warn-tx` if <20) and **higgs credits** (sq dot `--higgs`).

**Operator button**: a `.navitem2`, 44px, square avatar "AR" + "Alex Rivera / Operator" + settings gear.

### 4.2 Card — `.card`
```css
.card { background:var(--bg-2); border:1px solid var(--line-1); border-radius:var(--r-lg);
        box-shadow:var(--el-1); transition: border/shadow/transform .22s ease-out; }
.card-pad { padding: var(--s5); }                         /* 20px */
.card-hd  { padding: var(--s4) var(--s5); border-bottom:1px solid var(--line-1); } /* 16/20 */
```
Selected/active cards swap border to `--gold-line` and shadow to `--glow-gold` (used by
content-type cards, brief cards, handoff package cards).

### 4.3 Buttons — `.btn` + variants
Base: inline-flex, gap 7, font 13/560 -0.01em, height 34, padding `0 14`, radius `--r-sm`,
`border:1px var(--line-2)`, `bg:var(--bg-3)`, text `--tx-1`. SVG 15px. `:active{scale(0.96)}`.
Hover → `bg:var(--bg-4)`, border `--line-3`.
- **Sizes:** `.btn-sm` 28px/12px radius-xs; `.btn-lg` 42px/14px radius-md.
- **`.btn-primary`:** gradient `linear-gradient(180deg, var(--gold-hi), var(--gold))`, border `--gold-dim`, text `--accent-tx`, weight 640, shadow inset-white + `0 8px 24px -8px var(--gold-glow)`. Hover brightens 1.07 and deepens glow.
- **`.btn-ghost`:** transparent, no border, `--tx-2`. **`.btn-quiet`:** transparent, bordered.
- **`.btn-danger`:** `--bad-wash` bg, mixed `--bad` border, `--bad-tx`.
- `:disabled{opacity:.4}`.
- **`.icon-btn`:** square 34×34, radius-sm, bordered, 16px icon; `.ghost` variant transparent.

### 4.4 Chip — `.chip`
Pill, 26px tall, padding `0 9 0 7`, 12px/540, `bg:var(--bg-3)`, border `--line-2`,
`--tx-2`. Hover lifts `translateY(-1px)` + brighter border. **`.on`** = `--gold-wash` bg /
`--gold-line` border / `--gold-hi` text. Sub-parts: `.dot` (7px circle, brand color),
`.x` (removable, opacity .5→1). Used for employee/brand attach, gallery filters, handoff settings.

### 4.5 Status Pill — `.pill`
22px tall, padding `0 9`, 11px/620, transparent border, with a 6px `.led` dot. State classes
set bg(wash)/text/border: `.queued .running .ready/.done .fail .gold`. **`.running .led`
pulses** (`@keyframes ledpulse`, expanding box-shadow ring, 1.4s). `Pill` component maps
state→label (Queued / Generating / Ready / Done / Failed).

### 4.6 Cost badge — `.cost`
Mono, tabular, 12px/560, padding `2px 8`, radius-xs, `bg:var(--bg-3)` bordered. Variants
`.gold` (accent) and `.over` (bad). `Cost` component auto-formats: 3 decimals under $1, else 2.

### 4.7 Provider badge — `.prov`
10.5px/640, **lowercase**, radius-xs, with a 6px square `.sq`. `.fal` mixes `--fal` 13%/70%;
`.higgs` mixes `--higgs`. Renders "fal" / "higgsfield".

### 4.8 Progress bar — `.bar` & fuel gauge — `.gauge`
- **`.bar`:** 6px track (`color-mix(--tx-1 8%, transparent)`), inner `> i` fills with `--gold`, width transitions `--t-slow ease-out`. Variants `.run` (run gradient), `.ok`, `.over` (bad). `.shimmer` adds a sweeping white highlight (`@keyframes sweep`, 1.6s).
- **`.gauge`** (the budget fuel gauge): 8px track. `.used` = `linear-gradient(90deg, var(--gold), var(--gold-hi))` springs in. `.proj` = a **striped 45° diagonal ghost segment** (`repeating-linear-gradient` of `--gold-glow`) showing "after this job". `.gauge.warn .used` shifts toward warn; `.gauge.over .used` toward bad. The `Gauge` component computes `over` ≥100%, `warn` ≥75%.

### 4.9 Media thumbnail — the signature **mesh-gradient tile** (`MediaV2` / `.m2`)
> `ui.jsx` ships a striped placeholder `Media`; `ui_v2_patch.jsx` **overrides** it with the
> living mesh tile. This is the v1 hero visual.

Structure: aspect-ratio spacer (`padding-top` from `w:h`) + absolute `.m2` layer.
- `.m2`: `position:absolute inset:0`, border `--line-1`, `bg:var(--m2-base)`, `isolation:isolate`.
- `.m2grad`: `inset:-30%`, a **three-stop mesh** built per-hue:
  ```
  radial-gradient(95% 120% at 12% 8%,  oklch(0.58 0.20 H)   0%, transparent 58%),
  radial-gradient(85% 110% at 88% 18%, oklch(0.50 0.22 H+75) 0%, transparent 52%),
  radial-gradient(120% 100% at 55% 108%, oklch(0.36 0.17 H-55) 0%, transparent 62%),
  var(--m2-base)
  ```
  It **drifts forever** (`@keyframes meshdrift` 18s alternate: rotate 0→7deg, scale 1→1.14,
  translate 2%/3%), filtered by `saturate(var(--m2-sat))`.
- `.m2grain`: a fine 135° line texture + bottom vignette radial.
- `.m2icon`: centered play/image glyph at `rgba(255,255,255,.4)`, drop-shadowed.
- **Hover** (`.m2:hover`, `.tile:hover`): mesh saturates ×1.35 + brightens; icon scales 1.18 and brightens to near-white (`--ease-snap`).
- `.m2scrub`: a 3px video scrubber bar bottom (left/right 8) with a glowing `.scrubline` head that animates (`scrubmove`, 2.4s alternate).
- `.ph-label`: mono 10px uppercase dashed-border pill, blurred — the "type tag" overlay.
- `hue` is sourced from the assigned **employee** persona (see §9), giving each operator's
  work a consistent color family.

### 4.10 Score control — `.scoredots` (the quality gate)
10 dots, 9px default (sizable). States: empty (`--tx-1` @11%), `.fill` (accent), `.pass`
(`--ok`, applied to all dots when score ≥8). Hover scales 1.35 with hover-preview. `Score`
component is the 0–10 gate input; **≥8 turns the whole row green** = "passes the gate".

### 4.11 Avatar — `.av`
Circle (or `.sq` = radius 11), display-font 680 weight, `--accent-tx`. Default bg =
accent gradient; with a `hue` prop it becomes an **oklch persona gradient**
`linear-gradient(150deg, oklch(0.78 .13 H), oklch(0.5 .12 H))`. `EmpAvatar` (square, glyph
+ hue from persona) and operator avatars (round, initials) build on it.

### 4.12 Sheet / Modal — `.overlay` + `.sheet`
- `.overlay`: fixed, `bg:var(--scrim)`, `backdrop-filter:blur(10px) saturate(1.1)`, centered, padding 32, `z-index:80`, fades in.
- `.sheet`: `bg:var(--bg-2)`, border `--line-2`, radius-xl, `--el-pop`, `max-height:88vh`, springs up (`sheetin`: from `translateY(18px) scale(0.98)`). Closes on backdrop click / Escape.

### 4.13 Tooltip `.tip`, Segmented control `.seg`, Inputs `.input`
- **`.seg`:** inline pill group, inner padding 3, `bg:var(--bg-1)` bordered. Buttons 28px/12.5px; `.on` raises to `--bg-3` with `--el-1`. Used for ratio picker, gallery layout, time-range.
- **`.input` / textarea:** `bg:var(--bg-1)`, border `--line-2`, radius-sm, padding `9/11`, 13.5px. Focus → border `--gold-line` + `0 0 0 3px var(--gold-wash)` ring. Placeholder `--tx-4`.
- **Range slider `.rng`** (composer): 6px track, 17px thumb = accent gradient with `--gold-dim` ring.
- **Toggle switch `.sw`:** 34×20 pill, `--bg-4` → `--gold` checked, 16px white knob slides via spring.

### 4.14 Skeleton `.skel`, Sparkline `Spark`, CountUp
- **`.skel`:** `bg:var(--bg-3)` with a 100° sweeping `inset-hi` highlight (1.8s).
- **`SparkV2`:** SVG line + soft gradient **area fill** (0.28→0 opacity), 1.7px stroke, end dot. Used on the dashboard "Today's spend" card.
- **`CountUp`:** eased (cubic ease-out) number tween on value change, 700ms — used on all rail/dashboard budget figures.

### 4.15 Toast — `.toast`
Bottom-right stack (fixed, 320px wide). Row: colored 30px icon chip (kind→color: ok/bad/info/gold) + title + message + close. Enters via `toastin` (slide-in from right + scale). Auto-dismiss 5.2s (sticky 9s). Optional completion `blip()` web-audio tone when sound is on.

### 4.16 Activity ribbon
A 2px bar pinned to the top of `<main>`; a 30%-wide accent gradient sweeps L→R
(`@keyframes ribbon`, 1.8s) only while jobs are running.

---

## 5. Per-Screen Layout

### 5.1 Dashboard (`screen_dashboard.jsx`) — home
- **Header:** gold eyebrow `Wednesday · June 11`, hero `.t-display` greeting **"Good
  afternoon, Alex."**, then a one-line status: "_N generating · M to review · $X of today's
  budget left_". Actions: bell toggle (completion sound) + primary "New generation".
- **KPI row** (4 `.card.card-pad`): "Generating now" (+queued, run-colored, mini bar),
  "Made today" (renders + "% passed the gate" in ok green), "Spent today" ($used / $cap,
  accent, gauge), "Needs scoring" (accent count + "Open review →" link).
- **Main grid 1.6/1:**
  - LEFT: **"Generating now"** card (live `MiniJob` rows — thumb + employee + pill + prompt +
    progress/cost; empty state = checkmark "Queue is clear"); **"Latest renders"** card (4-col
    grid of 1:1 mesh tiles with brand dot, score badge or pulsing "score" pill, video glyph;
    fresh ones play the AirDrop arrival).
  - RIGHT: **"Today's spend"** (sparkline + gauge + fal/higgs balances split by a `.vr`, low-balance nudge); **"Needs scoring"** list; **"What's next"** suggestions (scored→hero, brief progress, handoff packages).

### 5.2 Create / Composer (`screen_composer.jsx`)
- Header eyebrow `Create`, h1 **"What are we making?"**, History button.
- **Content-type picker:** 6 cards (Social Vertical, Hero Film, Reference Sheet, Storyboard,
  Infographic, Typography Card) — each shows icon, name, desc, and `ratio · model`. Selecting
  one routes the employee/model/ratio/duration. Selected card → gold border + `--glow-gold`.
- **Grid 1.55/1:**
  - LEFT composer `.card`: header carries attached **chips** (locked employee avatar+name, brand
    lock chip with `lock` icon, or pickable brand chips) and a **model dropdown** (provider badge,
    name, blurb, live price). Body = large prompt textarea (15px), Improve/Clear, char count.
    **Improve** fakes a 1.1s think (3 skeletons) then yields **3 rewrite cards** tagged
    "Model vocabulary / One-variable iteration / Tighter & punchier", each with a Use button.
    Below: **final-prompt preview** — mono text composited as base prompt + `--gold-dim` employee
    style + brand-colored brand lock + red negative ("— no …"), with legend chips.
  - LEFT output `.card`: ratio `Seg`; video = duration slider + native-audio toggle (price/s),
    image = variations slider; "More controls" expands Fast lane (×1.25), 4K tier (×1.6),
    negative prompt.
  - RIGHT (sticky): **Cost calculator** — itemized math lines (`label · math · $value`),
    `.hr`, big **Estimate** ($30px), an "After this job" fuel gauge with the striped projected
    segment, "balance after" row, an over-threshold spend-card warning, and the primary
    **"Generate · $X"** (or "Review spend card") with a footnote "~Ns · count×ratio · syncs to
    local archive". Plus a "Recent prompts" card.
- **Spend-card modal** (`.sheet`, 460): shield icon, "Confirm spend / over your $1.25 limit",
  a spec table (Model/Output/Employee/Brand), total ($24px), "daily budget after", an over-cap
  error, Cancel + "Approve $X" (disabled if over the shared cap).

### 5.3 Queue (`screen_queue.jsx`)
- Header h1 reflects live state ("N generating · M waiting" / "Queue clear").
- Sections **Generating / Queued / Ready to review** (each only shown if non-empty), titled with
  a colored icon + count.
- **`JobCard`** (`.card`, 132px thumb): running cards get a blue-tinted border, ready cards a
  green-tinted border. Body: employee avatar + name + brand dot, provider+model+format line,
  prompt. Running → shimmer bar + `%` + elapsed + "~Ns left · learned ETA". Queued → `StageDots`
  (queued→running→ready pipeline) + "~Ns when started". Ready → check badge on thumb + "Done in
  Ns · needs scoring". Right rail: cost badge + contextual action (Cancel / Remove / Review →).
- Empty state: big checkcircle "All clear" + Create.

### 5.4 Gallery / Review (`screen_gallery.jsx`)
- **Full-height two-pane:** left **filter rail** (210px, own border) groups — Project (brand
  chips), Type, Provider, Score (Unscored / Pass ≥8 / Hero), Operator — plus a Clear link.
- Main: header eyebrow `Gallery · Review`, "N renders [filtered]", a search box (icon inset) +
  layout `Seg` (masonry/grid).
- **Masonry** = CSS columns (4); **grid** = 4-col. **`Tile`:** mesh `Media` with brand dot +
  score badge (green if ≥8) or pulsing "score" pill, hero trophy, a hover gradient overlay
  revealing prompt + provider + cost, and a centered play button for video. Tiles lift `-2px` on hover; fresh ones AirDrop in.
- **Lightbox** (`.overlay`, `.sheet` min(1100px,92vw)): left media pane (with "i / N · ← → to
  browse"), right 360px detail — brand, prompt, the **Quality-gate panel** (border/bg tinted by
  state: gold=unscored, green=pass, neutral=below; the 0–10 `Score`, a big "/10", verdict copy
  "≥8 passes the gate" / "Eligible for a hero render" / "Won't earn a hero render", trophy on 10),
  a **Provenance** table (model/employee/operator/format/cost/created), Iterate/Download/Copy, and
  an archive-path footnote. Left/Right arrow keys navigate; `.lb-nav` round buttons flank the modal.

### 5.5 Costs / Ledger (`screen_costs.jsx`)
- Header h1 "$X spent today" + "$rem of $cap left · N jobs logged"; time-range `Seg` (Today/Week/Month).
- **Grid 1.5/1:** LEFT — two summary cards (Daily budget gauge; By provider mini-bars
  fal/higgs), **Spend by model** (ranked `.bar` rows), and the **Ledger** table
  (`.lrow` grid `44px 1fr 28px 34px 66px`: time / job(desc+provider+model·qty) / operator avatar /
  score / right-aligned cost; header `.lhead` uppercase). RIGHT (sticky) — **What-if calculator**
  (`MiniCalc`: model select, dur/count, audio, big estimate + "would need spend-card confirm" /
  "≈ N more like this today") and a **Price sheet** list.

### 5.6 Briefs / Batch runner (`screen_extras.jsx → BriefsScreen`)
- Header eyebrow `Briefs · Batch runner`, "Campaign batches", New brief.
- **Grid 300px/1fr:** LEFT — selectable brief cards (brand dot+name, done/total, title,
  ok-progress bar, desc, spent). RIGHT — selected brief's **shot list** card: header with
  brand + name + percent + progress bar; rows (`.shotrow`) of small mesh thumb, shot name,
  employee·model·ratio, score/10, status pill, cost; footer "N shots remaining · est. $X"
  with a primary **"Run remaining · $X"** (disabled if estimate exceeds today's remaining budget;
  fires a "Batch queued" toast).

### 5.7 Handoff / Higgsfield (`screen_extras.jsx → HandoffScreen`)
- Header eyebrow `Handoff · Higgsfield`, "Paste packages", explainer "Higgsfield runs in its web
  app. Compose here, paste there, then log the result back into the ledger."
- **Grid 300px/1fr:** LEFT — package cards (higgsfield provider badge, Ready/Logged pill, title,
  brand·target). RIGHT — detail card: copyable **prompt block** (mono well) + setting chips +
  "Copy package" (writes to clipboard, toast, flips to "Copied"); then a **"Log the result"**
  card — either a logged-confirmation row (scored X/10) or a `LogForm` (credits used + `Score`
  control + "Log result to ledger"). This is the legacy log-only path for the non-automated provider.

---

## 6. The Tweaks Panel

`tweaks-panel.jsx` is a **self-contained, draggable, glassy floating panel** (own `<style>`,
light-on-glass styling regardless of skin) wired into a host "edit mode" via `postMessage`.
Its own chrome styling: `position:fixed right/bottom 16px`, 280px, `rgba(250,249,247,.78)` +
`blur(24px) saturate(160%)`, `.5px` white border, radius 14. It is drag-repositionable and
self-clamps to the viewport.

`TweakLayer` (in `app_v2.jsx`) maps each control to a CSS variable or store flag via a
`useEffect`. **Exposed controls (in order):**

| Section | Control | Type | Default | Effect |
|---|---|---|---|---|
| **Direction** | **Skin** | segmented radio | `onyx` | sets `<html data-skin>`; also resets accent to that skin's pair via `SKIN_ACCENT`. Options: `onyx / volt / lumen`. |
| | **Accent** | curated color chips (palette pairs) | `["#5b6cff","#8392ff"]` | rewrites the whole `--gold*` family inline: `--gold`, `--gold-hi` (lumen forces a darkened hi), `--gold-dim` = mix 72% black, `--gold-wash` 13%, `--gold-line` 38%, `--gold-glow` 30%, and `--accent-tx` auto-picks `#101207` vs `#ffffff` by relative luminance. Options: cobalt, lime, orange `#ff6a3d`, violet `#9a6bff`. |
| **Form** | **Corner radius** | slider 8–22px | 15 | sets `--r-lg`=v, `--r-md`=v−4, `--r-sm`=v−7, `--r-xl`=v+6. Re-rounds the whole UI live. |
| | **Density** | segmented radio | `regular` | `<body data-density>` → compact/regular/comfy rewrites `.screen-pad`/`.card-pad`/`.card-hd` padding. |
| **Behaviour** | **Motion** | segmented radio | `lively` | `<body data-motion>` → `calm` disables shimmer/skeleton/scrub/mesh-drift/ledpulse and all entrance animations (opacity/transform reset). |
| | **Gallery** | segmented radio | `masonry` | calls `store.setGalleryLayout` → masonry vs grid. |
| | **Completion sound** | toggle | off | store `soundOn`; plays a web-audio `blip` on job-complete toasts. |

`TWEAK_DEFAULTS` is persisted inside an `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` JSON block;
`setTweak` posts `__edit_mode_set_keys` so the host rewrites it on disk.

---

## 7. Motion & Interaction

The whole product is built to feel **alive** ("kinetic production cockpit"). Motion comes in
two user-selectable modes (`data-motion="lively"|"calm"`).

**Always-on (lively):**
- **Screen entrance:** `.screen-wrap` rises+scales in (`screenin` 0.45s spring); direct children
  stagger via `risein` with nth-child delays (0.02s→0.26s).
- **Nav ink** slides between items (`top` 0.42s spring); labels nudge on hover; icons spring on `:active`.
- **Mesh tiles** drift perpetually (18s) and saturate/brighten on hover; **scrub heads** sweep.
- **Progress bars** shimmer; **skeletons** sweep; **running LED** pulses a ring; **activity ribbon** sweeps.
- **Budget numbers** count up (700ms ease-out); **gauges** spring to width.
- **New assets** play an "AirDrop" arrival (`airdrop`: scale 0.92 + translateY 8 → settle with `--ease-snap`).
- **Toasts** slide+scale in from the right; **modals** spring up; **sheets** spring up.
- **Buttons** scale to 0.96 on press; primary brightens & deepens glow on hover; cards lift; chips lift.

**Calm mode** (`[data-motion="calm"]`) kills: shimmer, skeleton sweep, scrub, mesh-drift, LED
pulse, and *all* entrance animations (everything renders at rest). `prefers-reduced-motion`
forces every duration to ~0 globally.

**Hover/active conventions:** hover raises surface one bg step + brightens border;
`:active` scales 0.96 (buttons) / 0.85 (nav icons). Focus rings on inputs use the accent wash.

---

## 8. Voice & Copy

Tone is a **warm, momentum-driven creative producer**, never a terminal. Costs are always
framed in plain dollars; spend is treated as something to *earn*, not just spend.

- **Greeting:** time-aware + first-name — "Good afternoon, Alex." with date eyebrow "Wednesday · June 11".
- **Status as a sentence:** "_2 generating · 3 to review · $2.76 of today's budget left_" (not raw stats).
- **Create prompt:** "What are we making?"
- **Quality gate verdicts:** "≥8 passes the gate", "Eligible for a hero render.",
  "Won't earn a hero render.", "Marked as hero". Scoring toasts: "Scored 9 · Pass / Eligible for
  hero render" vs "Scored 5 · Below gate / Won't earn a hero render (gate ≥ 8)".
- **Budget guardrails framed as help, not blocks:** "75% cap — confirm spends",
  "fal balance running low — top up soon", "Over $1.25 — needs spend-card confirm",
  "≈ N more like this today", "Under auto-approve limit."
- **Provenance / archive:** "syncs to local archive", "↓ archive/2026-06-11/<id>.png" —
  reinforces "the local machine is the permanent archive."
- **Handoff:** "Compose here, paste there, then log the result back into the ledger." /
  "Copied for Higgsfield — Paste into Soul 2.0, then log the result."
- **Empty states are encouraging:** "Queue is clear. Nothing generating." + "Start something";
  "All clear — Nothing in the queue. Start a generation to see it come alive here.";
  "All caught up — everything's scored."
- **Signpost emojis** are reserved (per house rules) for: spend, pass, flag, balance, shipped —
  the UI itself prefers colored status LEDs/pills over emoji.

---

## 9. Supporting Data Model (for fidelity)

These shape the colors and content, so a faithful rebuild needs them.

- **Brands:** `StarXI` (swatch `#d8b24a / #2f6b4a / #efe6cf` — gold/green/cream; collectible
  figurine DNA) and `StrikeLab` (`#6fb7c4 / #cfd6da / #1d2226` — teal/silver; clean technical
  golf). Brand dot = `swatch[0]`. Each brand carries a `style` string appended to prompts ("brand-DNA lock").
- **Employees (9 personas)** each carry a 2-letter glyph + an **hue** that colors their avatar
  *and* every mesh thumbnail of their work: Premium Motion (PM, 28), Reference Sheets (RS, 150),
  Typography Animator (TA, 280), Quality Gate (QG, 0), Social Cutter (SC, 200), Hero Director
  (HD, 16), Storyboard Artist (SA, 48), Brand Stylist (BS, 320), Infographic Builder (IB, 96).
- **Models:** fal — FLUX schnell $0.004, FLUX dev $0.025, Nano Banana Pro $0.039,
  GPT Image 2 $0.06 (img); Seedance 1.0 $0.05/s, Kling 3 Pro $0.14/s, Veo 3.1 $0.12/s (video,
  +audio $0.01–0.02/s). higgs — Soul 2.0 $0.05/img. (Mock prices; the real app uses
  `config/pricing.json`.)
- **Budget defaults:** dailyCap **$7.50**, spend-card threshold **$1.25**, warn at **75%**,
  fal balance **$18.30**, higgs **240** credits.
- **Cost math** (`estimate()`): video = price×dur (+audio×dur); image = price×count; then
  4K tier ×1.6, fast lane ×1.25 applied as additive multipliers; itemized into `lines[]`.
- **Live store:** a 1s ticker advances jobs queued→running→ready, banks cost, mints assets
  (score=null), appends ledger rows, fires sticky "Ready to review" toasts. `needsScoring` /
  `activeCount` drive the nav badges.

### Icon set
Single inline SVG `Icon` component, 24-grid, `stroke=currentColor strokeWidth 1.75`, round
caps/joins, `fill` prop for solid glyphs. ~60 named paths
(dashboard, create, queue, gallery, costs, briefs, handoff, bolt, spark, shield, gauge, trophy,
cpu, zap, play, film, image, video, wand, refresh, check/checkcircle, chevrons, etc.).

---

## 10. Build Checklist (what to recreate first)

1. Token layer + the three skins as `data-skin` overrides; accent as overridable `--gold*` family.
2. Fonts: Space Grotesk (display/labels/numbers), Archivo (body), JetBrains Mono (ALL metrics).
3. The 236px rail with sliding `.nav-ink` + accent edge bar, count-up budget card.
4. `.card` system + the **mesh-gradient `Media` tile** (per-hue oklch, perpetual drift, hover bloom).
5. Status grammar: `.pill` (pulsing run LED), `.cost`, `.prov`, `.gauge` (with striped projected segment), `.scoredots` (≥8 → green).
6. Screen scaffold + staggered entrance; `data-motion` calm/lively switch.
7. The floating, draggable, glassy **Tweaks** panel wired to skin/accent/radius/density/motion/gallery/sound.
8. The warm, dollar-honest microcopy.
