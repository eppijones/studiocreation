# GAP_MATRIX — StudioCreation vs. competitive references

Bar: **Higgsfield.ai** (Image/Video/Audio, Soul/Soul Cinema character consistency, Popcorn
storyboards, viral preset chains, lipsync, Canvas, Marketing/Cinema/Influencer studios,
plugins, community). **Open-Generative-AI** (dual-mode t2i/i2i + t2v/i2v with auto
mode-switch, Lip Sync Studio, Cinema Studio camera controls, node-based Workflow Studio,
Audio Studio, multi-image refs ≤14, history persistence, BYOK, single-source models.js,
submit→poll, Electron shell).

Verdict legend: **Have** / **Partial** / **Missing** / **N-A** (out of scope for this product per CLAUDE.md).

| Feature | Higgsfield | Open-Gen-AI | Best practice | **Us today** | Verdict | Priority |
|---|---|---|---|---|---|---|
| Model registry = single source of truth | ✓ | ✓ models.js | One registry drives UI+API | `config/pricing.json` drives UI, `/api/generate`, `falInput` — incl. native constraints | **Have** (best-in-class) | — |
| Provider routing & fallback | ✓ multi | ✓ multi + BYOK | Pluggable adapters | `Provider` interface; **fal only by CLAUDE.md mandate** (no Higgsfield path) | **Partial (by design)** | P3 |
| Generation history + library | ✓ | ✓ persisted | DB-backed, browsable | jobs+assets in Postgres, gallery, Blob mirror, `manifest.jsonl` | **Have** | — |
| Submit → poll/webhook lifecycle | ✓ | ✓ poll | Webhook + poll fallback, idempotent | Signature-verified webhook + reconcile poll; claim-atomic finalize | **Have** (best-in-class) | — |
| Per-job cost estimate + budget **enforcement** | credits | — | Preflight + hard caps | Preflight everywhere; hard weekly/monthly stops; $1.25 confirm; run-rate projection | **Have** (best-in-class) | — |
| Multi-image reference input | ✓ | ✓ ≤14 | Many refs, typed | ≤9 img +3 vid +3 aud (Seedance), ≤10 (GPT edit); per-type caps enforced | **Have** | — |
| Aspect / duration controls | ✓ | ✓ | Per-model envelopes | Per-model ratios + range/discrete durations, snapped UI+server | **Have** | — |
| Upscale / finishing | ✓ | ✓ | 4K + fps interp | Topaz 4K video (16–60fps) + Topaz/Recraft image in `/deliver` | **Have** | — |
| Brand kit | ✓ | — | Palette/type/voice lock | Brand profiles + sub-brands + DNA lock in composer (**creation formula is a stub**) | **Partial** | P2 |
| Character consistency / reference sheets | ✓ Soul | partial | Identity lock + sheet gen | concept-artist role + Seedance ref2v + edit models + Character Pack workflow; **no dedicated reference-sheet generator UI** | **Partial** | P2 |
| Cinema camera-control prompt modifiers | ✓ | ✓ Cinema Studio | lens/shot/move/light → prompt | Was video-only "Motion" presets; **camera/lens/shot/light modifier rack added this session** | **Partial → Have(v1)** | **DONE (P1)** |
| Workflow / pipeline chaining | ✓ | ✓ node studio | Output→input graph | `/workflows` batch templates (storyboard/character/motion/ladder); **no node graph, outputs don't feed inputs** | **Partial** | P2 |
| Storyboard → discrete shots | ✓ Popcorn | — | N sequenced shots + continuity | Storyboard template returns one grid image | **Partial** | P2 |
| Lipsync | ✓ | ✓ 9 models | Image+video lipsync | none | **Missing** | P2 |
| Color / LUT / grade | ✓ | — | Grade before export | none (upscale + container export only) | **Missing** | P3 |
| Platform presets (TikTok/Reels/Shorts) | ✓ | ✓ | Named, not raw dims | `/deliver` exports raw ratios; no platform labels/presets | **Partial** | P1 |
| Viral preset **chains** | ✓ | — | One-action multi-format | none | **Missing** | P2 |
| Captions / subtitle burn-in | ✓ | ✓ clipping | Burned subs in finish | none in pipeline (video-editor is an ffmpeg skill only) | **Missing** | P1 |
| Batch variations | ✓ | ✓ | N variants one-click | `numImages ≤4` + brief runner + ladder; no "3 hook variants" preset | **Partial** | P2 |
| Queue / progress / ETA | ✓ | ✓ | Live + honest ETA | live progress, honest ETA, queue page, badges | **Have** | — |
| Cancel in flight | ✓ | ✓ | Stop a running/queued job | none | **Missing** | P1 |
| Error / retry / timeout UX | ✓ | ✓ | Retry button + timeouts | error toasts + webhook retry + poll fallback; no user retry/timeouts | **Partial** | P3 |
| Empty / first-run states | ✓ onboarding | — | Guided first run | per-screen empties; **no onboarding/role discovery** | **Partial** | P1 |
| Mobile / responsive | ✓ | (Electron) | Works at 390px | desktop-first; unverified at 390px | **Partial** | P2 |
| Accessibility | partial | partial | Focus/keys/contrast | strong in gallery/spotlight; gaps elsewhere | **Partial** | P2 |
| Secrets hygiene (no keys in client/logs/urls) | ✓ | BYOK local | Server-only keys | server-only `FAL_KEY`/`DATABASE_URL`, bundle guards, `.env` gitignored | **Have** | — |
| Nine-agent dashboard (status/queue/handoff) | ✓ Supercomputer | design agent | Live agent status | roles are **prompt-preset tiles**, not live agents; no status/handoff board | **Partial (by design)** | P1 (legibility) |
| BYOK key storage | — | ✓ | Per-user key | team key server-side by design | **N-A** | — |
| Electron desktop shell | — | ✓ | Native shell | Vercel web app | **N-A** | — |
| Community gallery / multiplayer | ✓ | — | Public/shared | showcase wall (curated `showcaser` tag) for login screen; not community | **Partial / N-A** | P3 |
| Lint / typecheck / tests in repo | — | — | CI-gated quality | typecheck ✓, build ✓; **lint unconfigured, no tests** | **Partial** | **DONE (P2)** |

## Where we already beat the bar
- **Budget governance + enforcement**, **idempotent claim-atomic job finalize**, and the
  **constraints-in-the-registry** design (one JSON entry adds a model end-to-end) are
  stronger than either reference.

## Highest-leverage closeable gaps (the four lenses agree)
1. Cinema camera-control modifiers _(done v1)_ — film + social.
2. Job cancel — UI/UX + engineering + both creators.
3. Platform presets + caption burn-in in `/deliver` — social.
4. Nine-employees legibility / first-run — UI/UX.
5. Lint + tests _(done)_ — engineering quality gate.
