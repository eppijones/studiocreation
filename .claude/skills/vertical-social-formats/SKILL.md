---
name: vertical-social-formats
description: Platform-perfect formatting for TikTok, Instagram Reels, YouTube Shorts, X and Facebook — 9:16 vertical video specs, UI safe zones, hook timing, caption rules, aspect-ratio adaptation and ffmpeg export commands. Use for ANY deliverable headed to social media, any 9:16/vertical request, any "make this work for TikTok/IG/Shorts", reformatting, cropping, or multi-platform export task.
studio:
  kind: video
  model: fal-ai/kling-2.5-turbo-pro
  ratio: "9:16"
  seconds: 5
  style: "vertical social video, hook-first composition, UI safe zones respected, scroll-stopping first frame"
---

# Vertical & Social Formats

## Master spec
Produce ONE 9:16 master (1080×1920, 30 fps, H.264 high, ~10–12 Mbps, AAC
-14 LUFS), then derive every platform cut from it.

## 9:16 safe zones (1080×1920)
- TOP 220 px: username/search UI — no critical content.
- BOTTOM 420 px: captions, CTA buttons, progress bar — keep clean.
- RIGHT 130 px: like/comment/share rail.
- SAFE STAGE = center 820×1280. Hero subject + all text lives here.
- Design key frames with safe zones in mind from the STILL stage.

## Hook law
- Frame 1 must work as a thumbnail (no fade-from-black, ever).
- 0.0–1.5 s: pattern interrupt (motion already in progress, bold type, face,
  or impossible image). Decision to keep watching happens here.
- Loop endings: last frame ≈ first frame family → replays read as intended.

## Platform matrix
| Platform | Ratio | Length sweet spot | Notes |
|---|---|---|---|
| TikTok | 9:16 | 7–15 s (hooks), 21–34 s (story) | burned-in captions; native text > overlays |
| IG Reels | 9:16 | 7–30 s | design center 4:5 (1080×1350) to survive feed crop |
| YT Shorts | 9:16 | 15–45 s | title text early; survives ≤60 s |
| X | 1:1 or 16:9 | 6–20 s | autoplay muted → visual-first |
| FB | 4:5 or 9:16 | 10–30 s | crop from master |

## ffmpeg export recipes
```bash
# 9:16 master normalize
ffmpeg -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -r 30 -c:v libx264 -profile:v high -b:v 11M -c:a aac -b:a 192k master_916.mp4
# center 4:5 for IG feed
ffmpeg -i master_916.mp4 -vf "crop=1080:1350:(in_w-1080)/2:(in_h-1350)/2" ig_45.mp4
# 1:1 for X
ffmpeg -i master_916.mp4 -vf "crop=1080:1080:(in_w-1080)/2:(in_h-1080)/2" x_11.mp4
# 16:9 pad with blurred background
ffmpeg -i master_916.mp4 -filter_complex "[0:v]scale=1920:1080,boxblur=30[bg];[0:v]scale=-1:1080[fg];[bg][fg]overlay=(W-w)/2:0" wide_169.mp4
# extract review frames for quality-gate
ffmpeg -i draft.mp4 -vf fps=2 frames/f_%03d.png
```

## Ratio adaptation
Generate NATIVE 9:16 when the model supports it; reframe (Higgsfield
`reframe`) only as a rescue. For landscape-bound asset generators, follow
the user's existing `vertical-cinematography` workflow: build assets 16:9,
render video 9:16 with vertical camera language (low-angle push-ins, top-down
slams, vertical dolly) — verticality comes from the CAMERA, not the crop.
