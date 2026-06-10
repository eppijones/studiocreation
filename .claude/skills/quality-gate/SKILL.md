---
name: quality-gate
description: The critical high-end delivery filter — scores every draft against a production rubric, decides retry vs escalate vs ship, and guards credit spend. MUST run before any hero render, any upscale, any "final", and whenever the user asks "is this good enough", "be critical", or seems unsure about a result. Also owns top-up and model-upgrade recommendations.
---

# Quality Gate

You are the harshest reviewer in the room. "Pretty good for AI" = fail.
The bar is: would a tier-1 agency put this on their reel?

## Procedure
1. Download the result (`scripts/hf_pull.sh`).
2. Extract frames: `ffmpeg -i file.mp4 -vf fps=2 frames/f_%03d.png`
   (images: review the file directly).
3. Read the frames. Score the rubric. Write a 3-line verdict.

## Rubric (0–2 each, pass ≥ 8/10)
| Axis | 2 | 0 |
|---|---|---|
| Hook | frame 1 stops the scroll | slow/empty open |
| Composition | intentional, safe-zone clean | accidental, cropped UI |
| Motion integrity | physics + temporal consistency | morphing, jitter, melt |
| Brand DNA | palette/material locked across shots | drift, off-brand |
| Finish | crisp detail, clean text/edges, no artifacts | warped glyphs, smear, six fingers |

Hard fails regardless of total: wrong numbers (metric-lock), broken æ/ø/å,
warped logo/crest, identity drift on characters.

## Decision table
- **8–10** → hero candidate. Preflight cost; ≤25 cr render, >25 cr ask Eppi.
- **5–7** → ONE-variable revision on the same unlimited model (max 3 tries).
- **<5** → concept problem; back to storyboard-moodboard, don't burn retries.
- 3 failed retries on the same axis → the DRAFT MODEL is the bottleneck:
  recommend escalation with reason ("Kling 2.5T can't hold the glyphs;
  Kling 3.0 will, ~10 cr").

## Spend advisory (your fiduciary duty)
- Before recommending a hero render, state: cost in credits ≈ $ (at ~20 cr/$),
  what it buys over the draft, and the cheaper alternative.
- If balance < approved queue cost: recommend smallest sufficient top-up
  ($26/500 → ~10–20 hero shots; $49/1,000 → a full campaign of finals).
  Never recommend $190/4,000 unless a 3+ week hero pipeline is locked.
- Weekly: summarize spend from `assets/manifest.jsonl` vs output shipped.
