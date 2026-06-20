#!/usr/bin/env bash
#
# setup-test-media.sh
# Replicates the PortalOne ELEMENTS folder structure as a LOCAL dev fixture
# for StudioLibrary, so the media library can be built on the Mac (offline)
# before switching to the real ELEMENTS storage in Oslo.
#
# - Creates EMPTY folders only (you drop your own .mp4/.mov/.mxf/.png/.pdf/.mp3/.wav inside).
# - Optionally seeds tiny synthetic sample files with:  ./setup-test-media.sh --with-samples
# - Idempotent: safe to run repeatedly.
# - Lands inside StudioCreation but git-ignored, so nothing pollutes your Vercel app.
#
# Usage:
#   chmod +x setup-test-media.sh
#   ./setup-test-media.sh                 # folders only
#   ./setup-test-media.sh --with-samples  # folders + tiny test media (needs ffmpeg)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIG  — change BASE/ROOT here if you want a different location
# ---------------------------------------------------------------------------
BASE="/Users/espenhorne/DEV/espenhorne/StudioCreation"
ROOT="$BASE/studiolibrary/test-media"          # <- LocalVolume root for StudioLibrary
PROXIES="$BASE/studiolibrary/proxies"          # <- writable proxy output (rw working area)
CACHE="$BASE/studiolibrary/.cache"

WITH_SAMPLES=0
[[ "${1:-}" == "--with-samples" ]] && WITH_SAMPLES=1

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
if [[ ! -d "$BASE" ]]; then
  echo "⚠️  StudioCreation folder not found at: $BASE"
  echo "    Creating it anyway. Edit BASE at the top of the script if this is wrong."
fi
mkdir -p "$ROOT" "$PROXIES" "$CACHE"

echo "📁 Building ELEMENTS-replica tree under:"
echo "   $ROOT"
echo ""

# ---------------------------------------------------------------------------
# Folder structure (mirrors the ELEMENTS / media.portalone.com screenshots)
# Productions -> Workspaces -> folders
# ---------------------------------------------------------------------------
DIRS=(
  # --- ArtTest production ---
  "ArtTest/ArtTest"

  # --- Media production: extra root folders ---
  "Media/Investors"
  "Media/Knowledge Sharing"
  "Media/Quiztopia IP collaboration"
  "Media/Vimeo downloads"

  # --- Media > MarComm workspace ---
  "Media/MarComm/_CLEAN_UP_MarComm"
  "Media/MarComm/Campaigns"
  "Media/MarComm/MarCommAssets"
  "Media/MarComm/Quiztopia"
  "Media/MarComm/Showrooms"
  "Media/MarComm/Social Media 2026"
  "Media/MarComm/UserAcquisition"
  "Media/MarComm/VirtueClan"

  # --- Media > Video workspace (top level) ---
  "Media/Video/240220_UA_MarkusRecordings"
  "Media/Video/InReviewShowrooms"
  "Media/Video/Internal"
  "Media/Video/LIVE"

  # --- Media > Video > StudioProductions > ArcadeShow ---
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/AfterEffects"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/ArcadeEpisodeForge"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/edit_sessions"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/Photoshop"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/PremierePro"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/ProTools"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/Streamdeck"
  "Media/Video/StudioProductions/ArcadeShow/01_Projectfiles/vMix"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/240304_GuestVideoAssets"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/BTS"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/HowTo"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/logs"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/Misc"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/Pilots"
  "Media/Video/StudioProductions/ArcadeShow/02_RAW/Year2026"
  "Media/Video/StudioProductions/ArcadeShow/03_Graphics"
  "Media/Video/StudioProductions/ArcadeShow/04_Sound"
  "Media/Video/StudioProductions/ArcadeShow/05_Exports"

  # --- Media > Video > StudioProductions > Quiztopia ---
  "Media/Video/StudioProductions/Quiztopia/01_Projectfiles/AfterEffects"
  "Media/Video/StudioProductions/Quiztopia/01_Projectfiles/Photoshop"
  "Media/Video/StudioProductions/Quiztopia/01_Projectfiles/PremierePro"
  "Media/Video/StudioProductions/Quiztopia/01_Projectfiles/ProTools"
  "Media/Video/StudioProductions/Quiztopia/01_Projectfiles/vMix"
  "Media/Video/StudioProductions/Quiztopia/02_RAW"
  "Media/Video/StudioProductions/Quiztopia/03_Graphics"
  "Media/Video/StudioProductions/Quiztopia/04_Sound"
  "Media/Video/StudioProductions/Quiztopia/05_Exports"

  # --- Media > Video > StudioProductions > other ---
  "Media/Video/StudioProductions/Development"
  "Media/Video/StudioProductions/QuizStars"
  "Media/Video/StudioProductions/QuestionsDatabase/01_Intro"
  "Media/Video/StudioProductions/QuestionsDatabase/02_Intro"
  "Media/Video/StudioProductions/QuestionsDatabase/03_Outro"

  # --- Production production ---
  "Production/Production"

  # --- ResilioSync production ---
  "ResilioSync/ResilioSync"

  # --- Resources production ---
  "Resources/ArtAssets"
  "Resources/AudioAssets"
  "Resources/Branding"
  "Resources/Software"
  "Resources/VideoAssets"

  # --- Templates production ---
  "Templates/Folder Structures"
)

for d in "${DIRS[@]}"; do
  mkdir -p "$ROOT/$d"
done

# Season01..Season15 inside ArcadeShow/02_RAW
for i in $(seq -w 1 15); do
  mkdir -p "$ROOT/Media/Video/StudioProductions/ArcadeShow/02_RAW/Season${i}"
done

# ---------------------------------------------------------------------------
# .gitignore so dev media + proxies + db never get committed or deployed
# ---------------------------------------------------------------------------
cat > "$BASE/studiolibrary/.gitignore" <<'EOF'
# StudioLibrary local dev artifacts — never commit or deploy to Vercel
test-media/
proxies/
.cache/
*.db
*.sqlite
.env.local
EOF
echo "🔒 Wrote $BASE/studiolibrary/.gitignore (test-media, proxies, cache ignored)"

# ---------------------------------------------------------------------------
# A short README at the LocalVolume root
# ---------------------------------------------------------------------------
cat > "$ROOT/_README.txt" <<'EOF'
This is the StudioLibrary LOCAL test volume (a replica of the ELEMENTS tree).

Drop your own real files into the folders below to test the library:
  - Video:   .mp4 (H.264 + HEVC), .mov, .mxf   -> e.g. Media/Video/StudioProductions/...
  - Stills:  .png, .jpg, .tif, logos           -> e.g. Media/MarComm/MarCommAssets/
  - Docs:    .pdf                               -> anywhere
  - Audio:   .mp3, .wav                         -> Resources/AudioAssets/
  - Project: .prproj, .psb, .aep                -> the *Projectfiles folders

The StudioLibrary crawler will index whatever it finds here. Nothing here is
committed to git or deployed. When you're in Oslo, point the SMBVolume at the
real ELEMENTS share instead — this folder stays as a permanent demo/test fixture.
EOF

# ---------------------------------------------------------------------------
# Optional: tiny synthetic samples so the pipeline has something to chew on now
# ---------------------------------------------------------------------------
if [[ "$WITH_SAMPLES" -eq 1 ]]; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "⚠️  --with-samples requested but ffmpeg not found. Skipping sample generation."
    echo "    Install it:  brew install ffmpeg"
  else
    echo ""
    echo "🎬 Generating tiny sample files (ffmpeg found)…"
    have_enc () { ffmpeg -hide_banner -encoders 2>/dev/null | grep -qw "$1"; }

    SP="$ROOT/Media/Video/StudioProductions"
    RA="$ROOT/Resources/AudioAssets"
    MA="$ROOT/Media/MarComm/MarCommAssets"

    # 3s 1080p H.264 mp4 (the canonical test clip seen in the ELEMENTS player)
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i testsrc=size=1920x1080:rate=25:duration=3 \
      -f lavfi -i sine=frequency=440:duration=3 \
      -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
      "$SP/QuestionsDatabase/02_Intro/QS_2026_Intro_ID0001.mp4" || true

    # 2s 720p .mov
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i testsrc=size=1280x720:rate=25:duration=2 \
      -c:v libx264 -pix_fmt yuv420p \
      "$SP/Quiztopia/05_Exports/Quiztopia_Export_sample.mov" || true

    # HEVC clip to exercise the H.265 decode path (libx265 or VideoToolbox)
    if have_enc libx265; then
      ffmpeg -y -hide_banner -loglevel error \
        -f lavfi -i testsrc=size=1280x720:rate=25:duration=2 \
        -c:v libx265 -pix_fmt yuv420p -tag:v hvc1 \
        "$SP/ArcadeShow/02_RAW/Season01/arcade_s01_hevc_sample.mp4" || true
    elif have_enc hevc_videotoolbox; then
      ffmpeg -y -hide_banner -loglevel error \
        -f lavfi -i testsrc=size=1280x720:rate=25:duration=2 \
        -c:v hevc_videotoolbox -pix_fmt yuv420p -tag:v hvc1 \
        "$SP/ArcadeShow/02_RAW/Season01/arcade_s01_hevc_sample.mp4" || true
    fi

    # PNG + JPG stills
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i color=c=0x6C2BD9:size=1200x1200:duration=1 -frames:v 1 \
      "$MA/P1_Logo_Still.png" || true
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i testsrc=size=1600x900:duration=1 -frames:v 1 \
      "$ROOT/Media/MarComm/Showrooms/showroom_still.jpg" || true

    # WAV (always works) + MP3 (guarded)
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i sine=frequency=440:duration=3 -c:a pcm_s16le \
      "$RA/tone_sample.wav" || true
    if have_enc libmp3lame; then
      ffmpeg -y -hide_banner -loglevel error \
        -f lavfi -i sine=frequency=660:duration=3 -c:a libmp3lame \
        "$RA/tone_sample.mp3" || true
    fi

    # A placeholder "document"
    printf "Placeholder document for StudioLibrary doc-kind rendering.\n" \
      > "$ROOT/Media/Investors/investor_brief_PLACEHOLDER.txt"

    echo "   …sample generation done (failures, if any, were skipped safely)."
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
DIR_COUNT=$(find "$ROOT" -type d | wc -l | tr -d ' ')
FILE_COUNT=$(find "$ROOT" -type f | wc -l | tr -d ' ')
echo ""
echo "✅ Done."
echo "   Folders created: $DIR_COUNT"
echo "   Files present:   $FILE_COUNT"
echo "   LocalVolume root: $ROOT"
echo "   Proxy output:     $PROXIES"
echo ""
echo "Next:"
echo "  1) Drop real files (mp4/mov/mxf/png/pdf/mp3/wav) into the folders above."
echo "  2) Point StudioLibrary's LocalVolume at:  $ROOT"
echo "  3) Run the crawler -> generate proxies -> browse on localhost."
