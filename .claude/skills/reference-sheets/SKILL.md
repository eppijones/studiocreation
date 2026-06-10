---
name: reference-sheets
description: Character and world consistency via the GPT Image 2 → Seedance 2.0 pipeline — reusable reference sheets, multi-panel storyboard grids, and reference-to-video generation. Use for ANY character-driven work (StarXI's 96 figurines especially), any series/episodic content, TV bumpers with recurring elements, whenever the user says "same character", "keep it consistent", "it morphed", or before any multi-shot video where identity, wardrobe, props or brand elements must hold across shots.
studio:
  kind: image
  model: fal-ai/nano-banana-pro
  ratio: "1:1"
  style: "character reference sheet, multi-panel grid, consistent identity across views, clean studio lighting, labeled angles"
---

# Reference Sheets (The Consistency Stack)

Consistency is not prompted — it is REFERENCED. Build the sheet once, reuse
it for every future generation. Sheets are infrastructure, not output.

## The asset library (compounding value)
```
assets/<brand>/refsheets/<character-or-element>/
  master_sheet.png      # the canonical multi-view sheet
  style_ref.png         # palette + material + light reference
  scene_*.png           # recurring environments
  motion_*.mp4          # optional 3–5 s motion references
```
StarXI goal: one master sheet per nation character (96 total, built on
demand). StrikeLab: club/ball/turf material sheets.

## Building a master sheet
1. DRAFT the sheet on unlimited models (GPT Image 365 / Seedream) until the
   layout is right — multi-view: front, profile, back, action pose, face
   close-up, plus material/palette swatches and the figurine base.
2. FINALIZE on **GPT Image 2 (~7 cr)** — the community-validated pick for
   prompt-obedient, detail-locked sheets. Be explicit: "same character, no
   variation in appearance, consistent character design" — it follows
   instructions literally; don't assume consistency, demand it.
3. One canvas > many images: a single grid sheet keeps identity consistent
   across views BY CONSTRUCTION (same canvas = same character).

## Storyboard grids (for sequences)
For multi-shot videos, have GPT Image 2 render a 9-panel (3×3) or 16-cell
(4×4) storyboard grid: each cell = one shot, annotated with shot number,
duration, camera move, and action note. Dense director's notes per cell are
fine — Seedance reads them.

## Rendering with Seedance 2.0 (reference-to-video)
- Inputs: up to 9 images + 3 videos + 3 audio clips per generation.
- Load: master sheet + style ref + scene ref (+ motion ref for HOW it moves).
- Prompt pattern: "Generate a video that strictly follows reference image N
  as the storyboard. [energy/camera/style line]."
- Images lock STATIC consistency (looks); video refs lock DYNAMIC
  consistency (movement, camera feel).

## Budget path
- Drafts: sheet + start-frames on unlimited → animate on Kling 2.5 Turbo
  (start/end-frame) or Seedance Pro Fast — 0 cr, consistency already decent
  because the sheet drives the start frame.
- Heroes: Seedance 2.0 reference-to-video with the full reference payload.
- A finalized master sheet is pre-approved spend (~7 cr) — it pays for
  itself on the second use. Log it in the manifest as `refsheet`.
