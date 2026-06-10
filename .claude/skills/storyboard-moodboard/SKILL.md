---
name: storyboard-moodboard
description: Pre-production on unlimited models — turn a brief into a beat sheet, shot list, storyboard frames and a moodboard before any video credit is spent. Use whenever the user starts a new video/campaign idea, says "storyboard", "moodboard", "concept", "direction", "what should this look like", or jumps straight to "make a video" without locked shots — board first, render second.
studio:
  kind: image
  model: fal-ai/flux/schnell
  ratio: "16:9"
  style: "storyboard frame, cinematic composition, moodboard still, draft quality"
---

# Storyboard & Moodboard

Nothing animates until the board is approved. Boards cost 0 credits;
re-rendering video does not.

## Moodboard (style lock)
1. Extract 3–5 style axes from the brief: era, material, light, palette,
   energy.
2. Generate 6–9 reference tiles on Seedream 4.5 / FLUX.2 (unlimited), one
   axis-combination per tile.
3. Composite a contact sheet locally (ImageMagick `montage` or ffmpeg tile)
   → `assets/<project>/<date>/moodboard_v1.png`.
4. User picks tiles → write the STYLE STRING (one reusable sentence) that
   every subsequent prompt will carry verbatim. This is the brand-DNA lock.

## Storyboard (shot lock)
1. Beat sheet: 5–8 beats, one line each (what changes emotionally/visually).
2. Shot list table: # | duration | shot type | camera move | subject action |
   style string | text on screen.
3. Render ONE key frame per shot on unlimited image models, 9:16, safe zones
   respected.
4. Contact-sheet the frames; review against the brief; iterate stills (cheap)
   until composition is locked.
5. Only then hand off to premium-motion-designer / video pipeline; the key
   frames become start-frames for image-to-video.

## Output files
```
briefs/<project>-<slug>.md          # brief + beat sheet + shot table
assets/<project>/<date>/board_*.png # frames + contact sheet
```
A storyboard is DONE when: every shot has an approved frame, a camera move,
a duration, and the style string appears in every prompt.
