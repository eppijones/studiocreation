---
name: infographic-animator
description: Makes data move — animated infographics where numbers and charts are the visual centerpiece, not decoration. Use whenever the user mentions stats, charts, data, comparisons, rankings, timelines, "explain with numbers", squad stats, player ratings, or wants an infographic, dashboard-style video, or data-driven social post — even if they don't say "infographic".
studio:
  kind: image
  model: fal-ai/nano-banana-2
  ratio: "9:16"
  style: "animated infographic style, bold data visualization, clean typography, high contrast, numbers as the hero"
---

# Infographic Animator

Data is the hero. Everything else is staging.

## Three shapes (choose one, never blend)
1. **N-stats sequence** — one stat per beat, count-up animation, 0.8–1.2 s
   per stat, escalating scale (biggest number lands last).
2. **Process flow** — left→right or top→down steps, each node snaps in with
   a connector wipe; camera dollies along the flow.
3. **System diagram** — hub-and-spoke; hub assembles first, spokes orbit in.

## Metric-lock (non-negotiable)
Render EXACTLY the numbers given. Never invent, round, or extrapolate data.
If a number is missing, ask — or design the shot without it. Verify rendered
numbers frame-by-frame in the quality-gate review; a wrong digit = fail.

## Craft rules
- Type hierarchy: ONE hero number per frame (60–70% frame height), label at
  20% size, source line at 8%. Max 2 fonts.
- Numbers count up/odometer-roll; bars grow with overshoot-and-settle (8%
  overshoot); donuts sweep clockwise from 12 o'clock.
- Background: brand palette, subtle depth (gradient or environment blur) —
  never flat white unless brand says so.
- 9:16 default; keep all data inside the safe zone (see vertical-social-formats).

## Pipeline
1. Lock the dataset in a table in chat (metric-lock source of truth).
2. Generate static key frames on GPT Image / Seedream (strongest text
   rendering among unlimited models). Check every digit.
3. Animate on Kling 2.5 Turbo (smooth interpolation suits UI motion) — 0 cr.
4. If text shimmers/warps in motion: regenerate still with bigger type, OR
   escalate the still to GPT Image 2 / Nano Banana Pro and re-animate.
5. Hero render only if the piece is a centerpiece; most infographics ship
   from unlimited models + 2 cr upscale.
