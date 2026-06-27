#!/usr/bin/env python3
"""
Local CLIP embedder for semantic search. Mirrors transcribe.py's contract:
emits ONE JSON line on stdout, never raises to the caller (errors are returned
as {"error": ...} so the Node worker logs and moves on instead of wedging).

Joint image<->text space (open_clip ViT-B-32) so "find similar" (frame->frame)
and text search (text->frame) hit ONE pgvector column. Vectors are L2-normalized
so cosine distance is the metric.

Usage:
  python embed.py frames <media_path> [device]      # video/image -> per-frame vectors
  python embed.py query  "<text>"     [device]      # text -> one query vector
  python embed.py text   [device]                   # stdin {"chunks":[{timecode_s,text}]} -> vectors

Output:
  frames/text: {"dim":512,"items":[{"timecode_s":<float|null>,"vector":[...]}]}
  query:       {"dim":512,"vector":[...]}
  error:       {"error":"..."}
"""
import sys
import os
import json
import tempfile
import subprocess
import shutil

MODEL_NAME = os.environ.get("EMBED_MODEL", "ViT-B-32")
PRETRAINED = os.environ.get("EMBED_PRETRAINED", "laion2b_s34b_b79k")
FRAME_EVERY_S = float(os.environ.get("EMBED_FRAME_EVERY_S", "2"))
MAX_FRAMES = int(os.environ.get("EMBED_MAX_FRAMES", "60"))

_model = None
_preprocess = None
_tokenizer = None
_torch = None


def _emit(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def _load(device):
    global _model, _preprocess, _tokenizer, _torch
    if _model is not None:
        return
    import torch
    import open_clip
    _torch = torch
    _model, _, _preprocess = open_clip.create_model_and_transforms(MODEL_NAME, pretrained=PRETRAINED, device=device)
    _model.eval()
    _tokenizer = open_clip.get_tokenizer(MODEL_NAME)


def _normalize(t):
    return t / t.norm(dim=-1, keepdim=True).clamp_min(1e-12)


def _encode_images(paths, device):
    from PIL import Image
    imgs = []
    for p in paths:
        try:
            imgs.append(_preprocess(Image.open(p).convert("RGB")))
        except Exception:
            imgs.append(None)
    out = []
    with _torch.no_grad():
        for img in imgs:
            if img is None:
                out.append(None)
                continue
            batch = img.unsqueeze(0).to(device)
            feat = _normalize(_model.encode_image(batch))
            out.append(feat[0].cpu().tolist())
    return out


def _encode_texts(texts, device):
    with _torch.no_grad():
        toks = _tokenizer(texts).to(device)
        feats = _normalize(_model.encode_text(toks))
        return [f.cpu().tolist() for f in feats]


def _extract_frames(media_path, workdir):
    """ffmpeg-sample frames every FRAME_EVERY_S seconds; return (path, timecode_s)."""
    pattern = os.path.join(workdir, "f_%05d.jpg")
    fps = 1.0 / FRAME_EVERY_S
    cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", media_path,
           "-vf", f"fps={fps},scale=336:-1", "-frames:v", str(MAX_FRAMES), pattern]
    subprocess.run(cmd, check=True)
    frames = sorted(f for f in os.listdir(workdir) if f.startswith("f_"))
    return [(os.path.join(workdir, f), i * FRAME_EVERY_S) for i, f in enumerate(frames)]


def _is_image(path):
    return os.path.splitext(path)[1].lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff")


def do_frames(media_path, device):
    _load(device)
    if _is_image(media_path):
        vecs = _encode_images([media_path], device)
        items = [{"timecode_s": None, "vector": v} for v in vecs if v is not None]
        return {"dim": len(items[0]["vector"]) if items else 0, "items": items}
    workdir = tempfile.mkdtemp(prefix="embed_")
    try:
        frames = _extract_frames(media_path, workdir)
        if not frames:
            return {"dim": 0, "items": []}
        vecs = _encode_images([p for p, _ in frames], device)
        items = [{"timecode_s": tc, "vector": v} for (_, tc), v in zip(frames, vecs) if v is not None]
        return {"dim": len(items[0]["vector"]) if items else 0, "items": items}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def do_text(device):
    _load(device)
    payload = json.loads(sys.stdin.read() or "{}")
    chunks = payload.get("chunks", [])
    if not chunks:
        return {"dim": 0, "items": []}
    vecs = _encode_texts([c.get("text", "") for c in chunks], device)
    items = [{"timecode_s": c.get("timecode_s"), "vector": v} for c, v in zip(chunks, vecs)]
    return {"dim": len(items[0]["vector"]) if items else 0, "items": items}


def do_query(text, device):
    _load(device)
    v = _encode_texts([text], device)[0]
    return {"dim": len(v), "vector": v}


def main():
    args = sys.argv[1:]
    if not args:
        _emit({"error": "no mode"})
        return
    mode = args[0]
    device = "cpu"
    try:
        if mode == "frames":
            media = args[1]
            device = args[2] if len(args) > 2 else "cpu"
            _emit(do_frames(media, device))
        elif mode == "query":
            text = args[1]
            device = args[2] if len(args) > 2 else "cpu"
            _emit(do_query(text, device))
        elif mode == "text":
            device = args[1] if len(args) > 1 else "cpu"
            _emit(do_text(device))
        else:
            _emit({"error": f"unknown mode {mode}"})
    except Exception as e:  # never raise to the Node caller
        _emit({"error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
