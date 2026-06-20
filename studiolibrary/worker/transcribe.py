#!/usr/bin/env python3
"""
Local Whisper transcription (faster-whisper / CTranslate2) — Phase 2 AI proof.

Runs OFFLINE (no API). On the Mac this is CPU/int8; in Oslo the same script runs
on the A6000 with device="cuda". Emits ONE JSON object on stdout:

  {"language": "en", "duration": 8.4, "full_text": "...",
   "segments": [{"start": 0.0, "end": 2.1, "text": "..."}]}

Usage:  python transcribe.py <media_path> [model] [device]
"""
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: transcribe.py <media> [model] [device]"}))
        return 2
    media = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    device = sys.argv[3] if len(sys.argv) > 3 else "cpu"
    compute = "int8" if device == "cpu" else "float16"

    try:
        from faster_whisper import WhisperModel
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"faster-whisper not available: {e}"}))
        return 1

    try:
        model = WhisperModel(model_size, device=device, compute_type=compute)
        segments, info = model.transcribe(media, vad_filter=True)
        segs = []
        parts = []
        for s in segments:
            text = s.text.strip()
            segs.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": text})
            parts.append(text)
        print(json.dumps({
            "language": info.language,
            "duration": round(info.duration, 3),
            "full_text": " ".join(parts).strip(),
            "segments": segs,
        }))
        return 0
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
