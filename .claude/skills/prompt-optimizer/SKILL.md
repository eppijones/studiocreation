---
name: prompt-optimizer
description: Rewrites the user's plain-language idea into the optimal model-specific prompt before any generation call — right vocabulary per model, right length, one-variable iteration, no over-specification. ALWAYS use this before calling generate_image or generate_video, and whenever the user gives a rough/casual prompt, asks "improve my prompt", or results keep missing the brief.
studio:
  kind: image
  model: fal-ai/flux/schnell
  ratio: "1:1"
  style: ""
---

# Prompt Optimizer

The user writes intent; you write the prompt. Never send a raw user prompt
to a model.

## Universal structure (≤ 120 words for video, ≤ 80 for image)
[SUBJECT + action] → [SETTING + time] → [CAMERA move] → [LIGHT] →
[STYLE STRING from moodboard] → [MOOD/energy] → [tech: ratio, duration]

## Per-model dialects
- **Seedance (2.0 / Pro Fast):** loves multi-clause action choreography and
  explicit camera verbs; for 2.0 use shot-by-shot structure ("Shot 1: ...
  Shot 2: ...") and reference inputs; audio is native — describe sfx/ambience.
- **Kling (2.5T / 3.0):** concise, filmic; one clear camera move; use the
  negative prompt for artifacts ("blur, distortion, extra fingers, warped
  text"); start/end-frame mode = describe the JOURNEY between frames.
- **Hailuo 2.3:** short, punchy, high-dynamic verbs; best for speed/energy.
- **Nano Banana Pro / 2:** reasoning models — state INTENT and constraints
  ("exact text: 'ENDELIG'", "keep face identity", "render the chart with
  these values"), not just aesthetics.
- **Seedream 4.5 / FLUX.2:** dense visual nouns + style tags; great with
  typography and layout instructions.
- **GPT Image:** literal and layout-obedient; spell out positions.

## Iteration protocol
1. Draft → review → name the ONE failing element.
2. Change only that clause; keep everything else byte-identical.
3. Max 3 revisions on a draft model; then either rethink the shot
   (storyboard problem) or escalate (quality problem).

## Context discipline
- Keep a `briefs/<project>-prompts.md` ledger: final prompt + model + result
  path + score. Reuse winners as templates.
- Don't restate the whole brand bible per prompt — the STYLE STRING carries it.
- When the user over-specifies, compress: models follow 8 strong clauses
  better than 25 weak ones. Tell the user what you cut and why.
