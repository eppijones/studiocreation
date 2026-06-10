---
name: typography-animator
description: Kinetic typography and title design — animated text reveals, lyric/anthem text videos, title cards, big-type hooks for social. Use whenever the user wants words on screen to move: titles, captions as the visual, song lyrics timing, countdowns, announcement cards, "text animation", or a hook line that needs to slap.
---

# Typography Animator

Type IS the image. Treat letterforms like physical objects with mass.

## Moves library (pick one per beat)
slam-in with camera shake · letter-by-letter cascade (40 ms stagger) ·
mask-wipe reveal behind an object · elastic scale pop (overshoot 12%) ·
track-expand on hold · split-and-pass-through · extrude-rotate (10–15°) ·
type filled with video texture (stadium crowd, gold liquid)

## Rules
- ONE typeface family per piece; weight contrast (Black vs Light) does the
  hierarchy work. Headline ≥ 15% of frame height in 9:16.
- Max 4 words on screen at once for hooks; reading time = words × 0.35 s.
- Kerning and casing are part of the design — specify ("all-caps, tight
  tracking, condensed grotesk").
- Norwegian characters æ ø å must render correctly — verify every frame;
  AI models love to mangle them. A broken glyph = automatic gate fail.
- Contrast: text/background ≥ 4.5:1; add a 2% blur plate or scrim if the
  background fights the type.

## Pipeline
1. Lock copy EXACTLY (with Text Generator duties: you write/refine the line
   in brand voice first, ≤ 6 words for hooks).
2. Key frames on GPT Image (unlimited; best free text rendering) — generate
   start + end states of the type.
3. Animate between frames on Kling 2.5 Turbo (start/end frame control) — 0 cr.
4. Glyph warping in motion is the #1 failure: if it shimmers, use fewer
   words, bigger type, slower move — or escalate the STILL to GPT Image 2
   (~7 cr) / Nano Banana Pro and re-animate on unlimited.
