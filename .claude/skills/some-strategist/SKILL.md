---
name: SoMe
order: 2
description: 'Social-media strategy and platform delivery across BOTH images and video — what is trending right now, hook structure, format/length sweet spots, caption and posting craft, plus the exact aspect-ratio adaptation and export specs for TikTok, Reels, Shorts, X, and Facebook. Use for: "make this work for TikTok/IG/Shorts", "is this trendy", "what format", "9:16 / vertical", reframing/cropping, multi-platform export, hook timing, caption rules, trend angles for a post (image or video). NOT for: generating the motion itself (use premium-motion-designer), the visual edit/stitch (use video-editor), audio loudness/master (use audio-engineer), static poster design (use graphic-designer).'
studio:
  kind: video
  model: fal-ai/veo3.1/fast
  ratio: "9:16"
  seconds: 5
  style: "vertical social video, hook-first composition, UI safe zones respected, scroll-stopping first frame, on-trend"
---

# SoMe (Social Strategy & Formats)

Two jobs: read what's working on the feed RIGHT NOW (across image and video),
and ship every deliverable in the exact spec each platform rewards.

## Trend read (before the brief is locked)
- Name the current pattern the piece is riding (audio trend, edit style, hook
  format, meme template, visual motif) — and why it fits the brand, not just
  that it's popular. A trend you can't tie to the brand is noise.
- Hooks earn the watch: pattern interrupt in 0–1.5 s (motion already in
  progress, bold type, a face, or an impossible image). The keep/scroll
  decision happens here — design for it from the still stage.
- Trends decay: prefer the structure (fast cut, text-led, POV) over a specific
  sound/clip that will be stale in a week.

## Master spec
Produce ONE 9:16 master (1080×1920, 30 fps, H.264 high, ~10–12 Mbps, AAC
−14 LUFS), then derive every platform cut from it.

## 9:16 safe zones (1080×1920)
- TOP 220 px: username/search UI — no critical content.
- BOTTOM 420 px: captions, CTA, progress bar — keep clean.
- RIGHT 130 px: like/comment/share rail.
- SAFE STAGE = center 820×1280. Hero subject + all text live here.

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
```

## Ratio adaptation
Generate NATIVE 9:16 when the model supports it; reframe only as a rescue. For
landscape-bound generators, build assets 16:9 and shoot video 9:16 with vertical
camera language (low-angle push-ins, top-down slams, vertical dolly) — verticality
comes from the CAMERA, not the crop. Take the mastered cut from **audio-engineer**;
hand trend-driven shot ideas to **premium-motion-designer** / **concept-artist**.
