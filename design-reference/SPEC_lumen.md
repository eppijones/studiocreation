# SPEC — Direction D: LUMEN (light theme)

> **Tagline:** Light as material · frosted glass over a luminous field · blur is hierarchy.
> **Source of truth:** `design-reference/v1/concepts/board_lumen.jsx` (the `lmCSS` template literal + `LumenHero` / `LumenSpecimen`).
> Adopting Lumen as a **selectable LIGHT skin** that pairs with a dark default. Every value below is quoted verbatim from source unless explicitly flagged as an adaptation note.

The core conceit: the UI itself is **colorless frosted glass**. All color comes from the renders blooming through the panes. Budget is "today's light" (a beam that dims as you burn it); jobs literally **sharpen from blur** as they render; the commit button is **HOLD TO FOCUS & RENDER**.

---

## 1. LUMEN TOKENS (in full)

### 1.1 CSS variables — declared on `.lm`

```css
.lm {
  --ink:   #21242B;              /* primary text / graphite ink */
  --ink2:  #5C6270;              /* secondary text */
  --ink3:  #9AA0AD;              /* tertiary / muted text */
  --line:  rgba(33,36,43,0.10);  /* hairline dividers (ink @ 10%) */
  --glass: rgba(255,255,255,0.55);  /* default frosted surface fill */
  --glass2: rgba(255,255,255,0.72); /* denser glass (prompt box / focal card) */
  font-family: "Hanken Grotesk", sans-serif;
  color: var(--ink);
}
```

These are the **entire** named palette. There is no accent color in the token set on purpose — the only saturated color in the chrome is the **focal gradient**, used exclusively on spend actions (see 1.5). Everything else is white-glass + graphite ink.

### 1.2 The luminous-field background (the page)

A four-layer stack: three soft radial color blooms over a near-white linear base. This is what makes it read as a **light** theme — the base bottoms out at `#EEF2F8`, never grey, never dark.

```css
background:
  radial-gradient(90% 70% at 78% 8%,  rgba(120,190,255,0.20), transparent 60%),  /* cool blue, top-right */
  radial-gradient(70% 60% at 8% 90%,  rgba(255,150,190,0.13), transparent 55%),  /* pink, bottom-left */
  radial-gradient(60% 50% at 45% 55%, rgba(140,255,220,0.10), transparent 60%),  /* mint, center */
  linear-gradient(168deg, #FFFFFF 0%, #F4F7FB 52%, #EEF2F8 100%);                 /* white → cool-white base */
```

**Caustic overlay** (`.lm-caustic`) — a blurred conic wash that drifts spectral light across the field. Absolutely positioned, `pointer-events: none`, so it never affects interaction:

```css
.lm-caustic {
  position: absolute; inset: -20%;
  pointer-events: none; opacity: 0.5; filter: blur(40px);
  background:
    conic-gradient(from 210deg at 70% 20%,
      transparent 0deg,
      rgba(150,210,255,0.16) 40deg,
      transparent 90deg,
      rgba(255,170,210,0.10) 160deg,
      transparent 220deg,
      rgba(160,255,225,0.12) 300deg,
      transparent 360deg);
}
```

> **Adaptation note:** keep the `linear-gradient` base and the radials, but consider dropping the blur-40px caustic to a static SVG/CSS layer if `filter: blur` on a full-bleed element costs too much on lower-end machines. It is purely decorative.

### 1.3 Frosted-glass surfaces (the panes)

Three surface densities. All share: white background at an opacity, a `backdrop-filter: blur`, a bright white hairline border, and a soft cool-blue drop shadow. **The blur amount is the depth cue.**

| Surface | class | background | `backdrop-filter` | border | radius | shadow |
|---|---|---|---|---|---|---|
| Main pane | `.lm-pane` | `var(--glass)` = white @ 55% | `blur(24px)` | `1px solid rgba(255,255,255,0.85)` | `24px` | `0 24px 70px -38px rgba(60,80,120,0.4)` |
| Floating dock | `.lm-dock` | `var(--glass)` = white @ 55% | `blur(20px)` | `1px solid rgba(255,255,255,0.8)` | `22px` | `0 18px 50px -28px rgba(60,80,120,0.35)` |
| Specimen column | `.lm-spec-col` | `var(--glass)` = white @ 55% | `blur(22px)` | `1px solid rgba(255,255,255,0.85)` | `22px` | (inherits field) |
| Prompt box | `.lm-prompt` | `var(--glass2)` = white @ 72% | (none — denser fill) | `1px solid rgba(255,255,255,0.9)` | `14px` | — |
| Focal card | `.lm-focal` | `rgba(255,255,255,0.78)` | (none) | (none) | `18px` | — |

Glass-on-glass nested surfaces use plain white at opacity, **no** extra blur (they sit on already-blurred panes):

```css
.lm-thumb .veil        { backdrop-filter: blur(10px); background: rgba(255,255,255,0.08); }
.lm-thumb .pct         { background: rgba(20,24,32,0.4); backdrop-filter: blur(6px); }  /* the only dark chip — pct badge on a thumbnail */
.lm-dock-item.on       { background: rgba(255,255,255,0.9); }
.lm-model.sel          { background: rgba(255,255,255,0.85); }
.lm-tile .score        { background: rgba(255,255,255,0.92); }
.lm-chip               { background: rgba(255,255,255,0.7); }
```

### 1.4 Radii

| token | value | where |
|---|---|---|
| pane / spec-col | `24px` / `22px` | main surfaces |
| dock | `22px` | dock container |
| dock item | `14px` | nav buttons |
| prompt / model row | `14px` / `12px` | composer |
| thumb | `14px` | job preview |
| tile art | `12px` | library shelf |
| focal card | `18px` | commit card |
| lens / score | `50%` | circular elements |
| beam | `8px` | budget bar |
| focusbar | `3px` | per-job progress |

### 1.5 The focal gradient (the ONLY saturated color — spend actions only)

```css
.lm-holdbtn {
  background: linear-gradient(120deg, #5B8DEF, #7A6CEB 60%, #9D5BD8);  /* blue → violet → magenta */
  color: #fff;
  box-shadow: 0 10px 26px -10px rgba(100,110,230,0.7);
}
```

Spec chip label: **"Focal gradient — spend actions only · 5B8DEF→9D5BD8"**. Do not use this gradient anywhere except the hold-to-render button and the lens.

### 1.6 Glow / luminance treatment on cards

Score badges glow proportional to quality ("score = luminance · 10 glows"). The glow is the *only* place warmth (gold) enters:

```css
.lm-tile .art   { box-shadow: 0 14px 30px -18px rgba(60,80,120,0.55); }  /* cool lift on every tile */

.lm-tile .score.hi  { box-shadow: 0 0 0 1.5px rgba(255,255,255,1),  0 0 16px 4px rgba(255,235,170,0.9); } /* gold bloom = a 10 */
.lm-tile .score.mid { box-shadow: 0 0 0 1px   rgba(255,255,255,0.9), 0 0 8px 1px  rgba(170,200,255,0.55); } /* cool bloom */
.lm-tile .score.lo  { color: var(--ink3); box-shadow: 0 0 0 1px rgba(33,36,43,0.12); }  /* no glow, muted ink */
```

The **lens** on the commit card is a radial glass orb with an inner dashed ring and a live f-stop-style number:

```css
.lm-lens {
  width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, rgba(255,255,255,0.95), rgba(210,230,255,0.5) 55%, rgba(160,190,255,0.35));
  box-shadow: inset 0 0 0 1.5px rgba(120,160,230,0.5), 0 6px 22px -8px rgba(90,130,220,0.6);
}
.lm-lens::before { inset: 13px; border-radius: 50%; border: 1px dashed rgba(90,130,220,0.55); }  /* aperture ring */
.lm-lens::after  { content: "1.84"; color: #3D5C96; font-family: "Chivo Mono"; }  /* the estimated $ rendered as an f-number */
```

**Spectral hairline** (`.lm-spectral::before`) — a 1px gradient border that marks *selection*, never decoration. Built with a mask-composite trick so only the border paints:

```css
.lm-spectral::before {
  padding: 1px; border-radius: inherit;
  background: linear-gradient(120deg, rgba(110,200,255,0.85), rgba(190,140,255,0.55) 38%, rgba(255,150,170,0.5) 64%, rgba(140,235,200,0.75));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
```

### 1.7 The budget beam ("today's light")

The dollars-remaining bar is a literal beam: spent portion is a desaturated spectrum (`.lit`), remaining portion is bright white light spilling out (`.rem`), and a warn pin marks the threshold.

```css
.lm-beam      { height: 14px; border-radius: 8px; background: rgba(33,36,43,0.06); }  /* empty track = ink @ 6% */
.lm-beam .lit { width: 63.2%; background: linear-gradient(90deg, rgba(120,190,255,0.55), rgba(190,150,255,0.5) 45%, rgba(255,160,180,0.5) 80%, rgba(255,200,160,0.55)); filter: saturate(0.4) brightness(1.04); }
.lm-beam .rem { left: 63.2%; background: linear-gradient(90deg, #FFF7E8, #FFFFFF 40%, #F0FAFF); box-shadow: 0 0 18px 2px rgba(255,255,255,0.95), 0 0 4px rgba(150,200,255,0.6); }  /* the glowing "remaining light" */
.lm-beam .warnpin { left: 76%; width: 1.5px; background: var(--ink); opacity: 0.5; }
```

---

## 2. TYPOGRAPHY

Two families only. **"One engineered family, used by weight as depth"** + a mono for telemetry. The restraint is the luxury (no second display face).

### 2.1 Hanken Grotesk — weight as depth

| Weight | Role | Source evidence |
|---|---|---|
| **250** | Big numerals / hero figures ("light passes through") | `.lm-spec-xl { font-weight: 250 }` (76px) |
| **300** | The giant cost readout | `.lm-costrow .v { font-weight: 300 }` (46px) |
| **500** | Working body / prompt text | `.lm-job-info p`, `.lm-prompt { font-weight: 500 }` |
| **600** | Emphasis, selected model est, caps wayfinding | `.lm-caps { font-weight: 600 }`, `.lm-model b`, `.lm-chip .nm` |
| **700** | Letterspaced micro-caps for structure; wordmark; hold button | `.lm-h h3`, `.lm-caps`-adjacent headers, `.lm-holdbtn`, `.lm-word b` |

Spec quote: *"250 for the big numerals (light passes through), 500–600 for working text, 700 letterspaced micro-caps for structure. No second display face — restraint is the luxury."*

### 2.2 Chivo Mono — telemetry & money

Class `.lm-mono`. Used for **every** number that measures: prices, percentages, timers, durations, the lens f-number, score badges, budget labels.

```css
.lm-mono { font-family: "Chivo Mono", monospace; font-variant-numeric: tabular-nums; }
```

Spec quote: *"CHIVO MONO — telemetry & money · $0.14/s · 62% · 0:47 · $1.84"*.

### 2.3 Type scale (from `LumenSpecimen`)

> *"Scale: 76 / 46 mono / 14.5 body / 11 micro-caps."*

| px | usage |
|---|---|
| 76 | hero numeral / `.lm-spec-xl` (weight 250) |
| 46 | cost readout `.lm-costrow .v` (weight 300, mono) |
| 18 | spec subhead `.lm-spec-sub` (weight 600, color `#4D6FAE`) |
| 14.5 | body / prompt / job copy (weight 500) |
| 12–11 | micro-caps, labels, meta |
| 10–9 | dock labels, kickers, hairline mono badges |

Letterspacing convention: `.lm-caps { text-transform: uppercase; letter-spacing: 0.24em; font-weight: 600; }`. Section headers use `letter-spacing: 0.26em`.

### 2.4 Web-font loading

The JSX assumes both faces are already available by `font-family` name; it does **not** import them. For the Next.js theme, load via `next/font/google`:

- **Hanken Grotesk** — weights **250, 300, 500, 600, 700** (request the variable axis if available so 250 renders true).
- **Chivo Mono** — weight 400 (+ 600 for score badges), `font-variant-numeric: tabular-nums`.

> The 250 weight is load-bearing for the look — if the variable font is not pulled in, the hero numerals fall back to 300+ and lose the "light passing through" effect.

---

## 3. THE BLUR → SHARP FOCUS METAPHOR

Processing is literal: a job **sharpens from blur** as it renders. This is the headline interaction and must be evaluated for legibility (it applies to *preview thumbnails*, not to text — see verdict).

### 3.1 Per-state filter values (job thumbnails)

| State | Copy (`.state`) | Visual mechanism |
|---|---|---|
| **Waiting** (`.lm-job.qd`) | `Waiting for light` | Only the blurred layer renders; whole thumb dimmed. `.lm-job.qd .lm-thumb { opacity: 0.55 }`. State color falls to `var(--ink3)`. |
| **Sharpening** (in-progress) | `Coming into focus` | Blurred base + a clipped sharp layer that grows; progress bar fills. |
| **Focused** (done) | (sharp, scored) | Sharp layer reveals fully; lands on shelf with a glow score. |

The blur stack inside `.lm-thumb`:

```css
.lm-thumb .blurred { position: absolute; inset: 0; filter: blur(14px) saturate(1.15); transform: scale(1.15); }
.lm-thumb .sharp   { position: absolute; inset: 0; }  /* no filter — the in-focus copy */
.lm-thumb .veil    { backdrop-filter: blur(10px); background: rgba(255,255,255,0.08); }
.lm-thumb .pct     { /* mono % · time badge */ }
```

The "focus pull" is achieved by **clipping the sharp layer**, not by animating `filter` — the sharp image is revealed left-to-right as progress climbs:

```jsx
/* 62% done — sharp revealed from the left, 38% still clipped */
<div className="blurred" style={lmArt(28, 0.16)} />
<div className="sharp"   style={{ ...lmArt(28, 0.16), clipPath: "inset(0 38% 0 0)" }} />

/* 34% done — only 34% sharpened, 66% clipped */
<div className="sharp"   style={{ ...lmArt(96, 0.14), clipPath: "inset(0 66% 0 0)" }} />
```

Per-job progress bar with a glowing leading edge ("the focus lead"):

```css
.lm-focusbar      { height: 5px; border-radius: 3px; background: rgba(33,36,43,0.07); }
.lm-focusbar i    { background: linear-gradient(90deg, rgba(120,190,255,0.9), rgba(160,150,255,0.9)); }  /* width = % */
.lm-focusbar .lead{ width: 9px; background: #fff; box-shadow: 0 0 10px 2px rgba(140,180,255,0.9); }       /* the bright focus point */
```

Live state label color: `.lm-job .state { color: #4D7FBE; font-weight: 700; letter-spacing: 0.18em; }` (a calm blue, not the spend gradient).

### 3.2 The "hold to focus" interaction (the weighty moment)

Above the `$1.25` confirm threshold (BUDGET LAW), the user must **hold** the button until the lens ring closes — a tap is rejected.

- Threshold gate copy: *"Above $1.25, the lens must be brought to focus — hold until the ring closes. A tap is never enough."*
- Button: **`Hold to focus & render`** with sub-label **`740ms · releases early = nothing spent`**.
- Visual: the `.lm-lens` aperture ring (`::before`, dashed) closes over the hold duration; the f-number (`::after`, content `"1.84"`) is the live estimate.

```css
.lm-holdbtn {
  width: 100%; border: none; border-radius: 12px; padding: 11px; cursor: pointer;
  font-family: "Hanken Grotesk", sans-serif; font-size: 12px; letter-spacing: 0.2em;
  text-transform: uppercase; font-weight: 700; color: #fff;
  background: linear-gradient(120deg, #5B8DEF, #7A6CEB 60%, #9D5BD8);
  box-shadow: 0 10px 26px -10px rgba(100,110,230,0.7);
}
.lm-holdbtn small { font-size: 9px; letter-spacing: 0.14em; opacity: 0.8; }
```

### 3.3 Completion motion

Spec: *"Motion: focus pulls (blur→sharp), light blooms on completion, the beam dims in real time. Nothing slides — things resolve."* No slide/translate transitions — everything resolves in place via blur, opacity, and bloom.

### 3.4 Legibility verdict (keep it — with guardrails)

**Keep the metaphor.** It is safe because **blur is applied only to image previews, never to text or controls.** Guardrails for the build:

1. Never blur text, numbers, or interactive chrome — only `.blurred` preview layers.
2. The `pct` badge (`rgba(20,24,32,0.4)` + white text) stays sharp and readable over the blur.
3. Respect `prefers-reduced-motion`: skip the animated focus-pull and render thumbnails sharp immediately (the clip mechanism degrades cleanly to a static reveal).
4. Body text already runs **graphite `#21242B` on a ~white field** = strong contrast; preserve `--ink` / `--ink2` and avoid pushing text onto `--ink3` (`#9AA0AD`) for anything longer than a label.

---

## 4. SIGNATURE COPY / MICROCOPY (Lumen-specific)

| Surface | Copy |
|---|---|
| Wordmark | `StudioCreation` · `Lumen` |
| Budget beam label | `TODAY'S LIGHT — $2.76 REMAINING` / `BURNED $4.74 OF $7.50` |
| Queue pane header | `Rendering — sharpening now` · sub `2 LIVE · 2 QUEUED` |
| Job state (live) | `Coming into focus` |
| Job state (queued) | `Waiting for light` |
| Library header | `Library — latest` · sub `score = luminance · 10 glows` |
| Composer header | `New render` · `DOCKET 0805 · STARXI` |
| Cost label | `Light required` (instead of "Total" / "Cost") |
| After-spend line | `Leaves $0.92 of today's light · 33% of remaining` |
| Confirm gate | `Above $1.25, the lens must be brought to focus — hold until the ring closes. A tap is never enough.` |
| Commit button | `Hold to focus & render` + `740ms · releases early = nothing spent` |
| Specimen tagline | `Light is the material. Blur is hierarchy.` |
| Palette kicker | `Optics, not pigment` |

Wayfinding is deliberately **plain** ("Home, Compose, Queue, Library, Spend, Briefs, Handoff" — *"because the metaphor lives in the optics, not the nouns"*). Lumen does **not** rename screens the way the other directions do. Keep nouns literal; let the optics carry the theme.

---

## 5. THE OTHER 5 DIRECTIONS (brief — what else we could borrow)

**A — The Counting House** (`board_countinghouse.jsx`)
The studio as a 19th-century banking hall / financial broadsheet: every generation is a typeset transaction, the daily float is front-page news, scoring is an auditor's margin mark. Palette: counting-paper `#F6F1E5`, iron-gall ink `#232838`, oxblood `#7E2D26` for debits, ledger green `#28604B` for credits; serif type (Instrument Serif display + Newsreader body + Spline Sans Mono). **Signature gimmick:** spends over $1.25 must be physically *stamped* by hand ("Present for stamp"), and progress ticks across in Morse dashes.

**C — The Lightbench** (`board_lightbench.jsx`)
The studio as a film-lab finishing bench on an illuminated lightbox — the closest cousin to Lumen, also light/luminous but warm-paper instead of cool-glass. Renders develop "in the bath" with agitation waves; finished frames land on a contact strip marked in literal grease pencil (red circle = print, blue X = redraw). Palette: lightbox glass `#FCFBF6` + glow, graphite `#33342F`, china-marker red `#D6402B`, marker blue `#2C55A6`; Jost + Fragment Mono + Shantell Sans (handwriting reserved for human marks only). **Signature gimmick:** budget is chemistry in a graduated cylinder, and big commits need a handwritten **countersign** on the docket.

**E — Manifold** (`board_manifold.jsx`)
The studio as one continuous navigable 3D space, not a page: jobs are glowing **bodies** whose position encodes state (spawn left → drift right → crystallize into scored gems when shipped), the minimap *is* the nav. Deep-chroma dark field (violet `#33205E` → teal `#14406B`, never near-black), with cyan `#5BE3FF` (progress), magenta `#FF5BD0` (live), coral `#FF7A5C` (money at risk); Big Shoulders Display signage + Saira body + Red Hat Mono. **Signature gimmick:** the over-$1.25 commit must be **ARMED** first (a toggle that self-disarms in 5s), then committed — two deliberate acts.

**F — Soft Body** (`board_softbody.jsx`)
A tool with a body: every control is a translucent **gel volume** with mass, gloss and squish. Budget is literal liquid in a vessel you watch pour away; progress fills a capsule; finished work sets into glossy "candy" on a shelf. Porcelain field `#EEEFF5`, ink `#34364A`, and oklch gel ramps — aqua (budget/focus), lilac (selection), coral (spending), lime (quantity); Gabarito (heavy 500–800) + DM Mono. **Signature gimmick:** money has physics — over $1.25 the **gel turns viscous and the button physically resists** your finger ("press & hold to pour"); spring physics everywhere.

**B — Terminal One** (`board_terminal.jsx`)
The studio as a grand rail terminal: the queue is a split-flap **departures board**, models are numbered platforms with posted fares, creating is buying a ticket at the window. Palette: hall stone `#EDEAE1`, board enamel `#1E3A5F`, signal red `#C8402F` for gates, plus per-brand line colors (S `#1E7A4E`, K `#2E7E8C`); Anton signage + Familjen Grotesk body + Martian Mono. **Signature gimmick:** spends over $1.25 stop at **fare control** — a physical barrier ("hold to pass fare control"), and every status change cascades a split-flap animation.

---

### Borrow-list summary
- **Lightbench (C)** is the nearest sibling if Lumen needs a warmer light variant.
- The **glow-as-score** idea (Lumen gold bloom on a 10) overlaps with Manifold's "ten gem" and Soft Body's "candy pops" — a shared "10 shines" language could unify the dark+light skins.
- All six share the same $1.25 **weighty-moment** pattern; Lumen's "hold to focus" is the gentlest and most on-brand for the light skin.
