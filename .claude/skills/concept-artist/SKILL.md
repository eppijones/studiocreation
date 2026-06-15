---
name: Concept Artist
order: 5
description: 'Pre-production and consistency — turn a brief into sketches, beat sheets, shot lists, storyboard frames, moodboards, and reusable reference sheets BEFORE any video credit is spent, and keep characters / worlds / brand elements identical across shots. Boards and sheets cost ~$0 on unlimited models; they are infrastructure, not output. Use for: "storyboard", "moodboard", "concept", "sketch", "shot list", "what should this look like", "same character", "keep it consistent", "it morphed", reference sheets, character/world bibles, and any multi-shot job that must hold identity. NOT for: finished posters / key art (use graphic-designer), the actual animated render (use premium-motion-designer), product photography (use product-photographer). Board first, render second.'
studio:
  kind: image
  model: openai/gpt-image-2
  ratio: "16:9"
  style: "concept sketch, storyboard frame, moodboard still, reference sheet, clean composition, labeled and annotated"
---

# Concept Artist (Pre-Pro & Consistency)

Nothing animates until the board is approved, and nothing stays consistent unless
it is REFERENCED. Boards cost 0 credits; re-rendering video does not.

## Moodboard (style lock)
1. Extract 3–5 style axes from the brief: era, material, light, palette, energy.
2. Generate 6–9 reference tiles on unlimited models, one axis-combination per tile.
3. Composite a contact sheet locally (ImageMagick `montage` / ffmpeg tile) →
   `assets/<project>/<date>/moodboard_v1.png`.
4. User picks tiles → write the STYLE STRING (one reusable sentence) that every
   downstream prompt carries verbatim. This is the brand-DNA lock.

## Storyboard (shot lock)
1. Beat sheet: 5–8 beats, one line each (what changes emotionally/visually).
2. Shot list table: # | duration | shot type | camera move | subject action |
   style string | text on screen.
3. Render ONE key frame per shot on unlimited image models, 9:16, safe zones
   respected. Iterate stills (cheap) until composition is locked.
4. Contact-sheet the frames; review against the brief. Locked frames become the
   start-frames handed to **premium-motion-designer** for image-to-video.

## Reference sheets (the consistency stack)
Consistency is not prompted — it is referenced. Build the sheet once, reuse forever.
```
assets/<brand>/refsheets/<character-or-element>/
  master_sheet.png   # canonical multi-view: front, profile, back, action, face close-up
  style_ref.png      # palette + material + light reference
  scene_*.png        # recurring environments
  motion_*.mp4       # optional 3–5 s motion references
```
- DRAFT the layout on unlimited models; FINALIZE on GPT Image 2 at quality=high
  — be explicit: "same character, no variation in appearance, consistent design."
  It follows instructions literally; demand consistency, don't assume it.
- One canvas > many images: a single grid sheet keeps identity consistent BY
  CONSTRUCTION (same canvas = same character). For sequences, render a 3×3 or
  4×4 storyboard grid, each cell annotated with shot #, duration, camera, action.
- Feed sheets to Seedance 2.0 reference-to-video (up to 9 imgs + 3 vids + 3 audio,
  `@Image1` syntax): images lock STATIC looks, video refs lock DYNAMIC movement.

## Done means
Every shot has an approved frame, a camera move, a duration, and the style string
appears in every prompt. A finalized master sheet is pre-approved spend — it pays
for itself on the second use. Log boards and sheets to the manifest.
