---
name: audio-master
description: 'Audio finishing and mastering for video deliverables — loudness normalization, music/VO balance, ducking, platform loudness targets, all done locally with ffmpeg at zero credits. Use whenever a deliverable has sound: final exports, "fix the audio", "too quiet/loud", adding music or voiceover, anthem/Suno track integration, or before any video ships to social.'
studio:
  kind: image
  model: fal-ai/flux/schnell
  ratio: "1:1"
  style: ""
---

# Audio Master

Mastering happens locally and free. Higgsfield TTS/voice models (Eleven v3,
MiniMax Speech, Seed Speech) cost credits — use them only for needed VO,
once the script is locked; never for drafts.

## Targets
| Destination | Integrated | True peak |
|---|---|---|
| TikTok / Reels / Shorts | −14 LUFS | −1.0 dBTP |
| YouTube long-form | −14 LUFS | −1.0 dBTP |
| Podcast/voice-only | −16 LUFS | −1.5 dBTP |

## Recipes
```bash
# Inspect loudness
ffmpeg -i in.mp4 -af loudnorm=print_format=summary -f null -
# Two-pass normalize to -14 LUFS (use measured values from pass 1 in pass 2)
ffmpeg -i in.mp4 -af loudnorm=I=-14:TP=-1.0:LRA=9 -c:v copy out.mp4
# Music ducks under VO (sidechain)
ffmpeg -i vo.wav -i music.wav -filter_complex \
 "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[duck];[0:a][duck]amix=inputs=2:duration=longest" mix.wav
# Quick VO polish: HPF, de-mud, presence, limit
ffmpeg -i vo.wav -af "highpass=f=80,equalizer=f=300:t=q:w=1.2:g=-2,equalizer=f=3500:t=q:w=1:g=2.5,alimiter=limit=0.89" vo_polished.wav
# Marry mastered audio to picture
ffmpeg -i video.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k final.mp4
```

## Rules
- Music from Eppi's Suno pipeline arrives as full-mix; leave 2–3 dB headroom
  before the drop; align the video's BRAND BEAT to the musical downbeat.
- Hook seconds 0–1.5 must carry energy WITH SOUND OFF (most feeds autoplay
  muted) — sound rewards, never carries, the hook.
- Check the mix on phone-speaker EQ (mono, no lows): `-af "pan=mono|c0=.5*c0+.5*c1,highpass=f=200"` preview.
- Log mastered files to the manifest like any other asset.
