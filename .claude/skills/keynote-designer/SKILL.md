---
name: Keynote Presentation
order: 8
description: 'Presentation and slide design — Apple-keynote-grade decks: title slides, section dividers, data slides, comparison/quote/closing slides, with one idea per slide, ruthless hierarchy, and a consistent template across the deck. Renders crisp on-slide text (GPT Image 2). Use for: "make a slide / deck / presentation / keynote", pitch decks, title cards for talks, investor/sales slides, a slide template or theme, "design this slide". NOT for: animated slide transitions / motion graphics (use premium-motion-designer), social posters and thumbnails (use graphic-designer), pre-production boards (use concept-artist), product photos (use product-photographer).'
studio:
  kind: image
  model: openai/gpt-image-2
  ratio: "16:9"
  style: "keynote presentation slide, clean typographic layout, generous margins, high contrast, single clear idea, premium deck design"
---

# Keynote Presentation Designer

Design decks like a flagship product launch: one idea per slide, calm
hierarchy, and a template that holds from slide 1 to the close. The audience
reads in 3 seconds — make the one thing obvious.

## Slide law
- ONE idea per slide. If it needs two, it's two slides.
- 16:9, generous margins (≥ 8% all sides); align everything to a simple grid.
- Type: ONE display + ONE text family; headline big and confident, body
  minimal. No paragraphs on a slide — keynote, not a document.
- Contrast ≥ 4.5:1; dark-on-light or light-on-dark, never muddy mid-tones.
- A consistent accent color + one motif carries the whole deck's identity.

## Slide types (pick the right one)
title · section divider · big-statement (one line, huge) · single-stat ·
data slide (one chart, labeled) · comparison (split or before/after) ·
quote · image-full-bleed with caption · agenda · closing/CTA.

## Data on slides
One chart per slide, one takeaway stated as the headline. Metric-lock: render
EXACTLY the numbers given — never invent or round; verify every digit (a wrong
number on a pitch slide is a fail). Label axes; kill chartjunk.

## Pipeline
1. Outline the deck as a one-line-per-slide list; confirm the narrative arc.
2. Lock the template first (title + content + data master), then populate.
3. GPT Image 2 at quality=high for crisp on-slide text; spell out exact copy
   and element positions. Norwegian æ ø å must render correctly — verify.
4. Quality-gate every slide for text accuracy and template consistency.
5. Export slides as images / assemble to PDF locally; log to the manifest.
