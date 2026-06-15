"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { estimate, listModels, defaultSeconds, coerceSeconds, type ModelInfo } from "@/lib/pricing";
import { resolveBrandStyle, brandPath, topLevelBrands, subBrandsOf, type BrandProfile } from "@/lib/brandTypes";
import { useStudio } from "../components/AppShell";
import { Card, Btn, CountUp, FuelGauge, Seg, Switch, useToast } from "../components/ui";
import { Media } from "../components/Media";
import { Icon } from "../components/Icon";
import { JobProgress } from "../components/JobProgress";
import { ensureNotifyPermission } from "../components/notify";
import { hueFor, money, usd, modelShort, relTime, isInFlight, glowVars, cancelJob, type ClientJob, type ClientJobAsset } from "../components/studio";
import { EXAMPLES, MOTION_PRESETS } from "./constants";
import { type RefAsset, type RefKind, refKind } from "./types";
import { ResultDock, ResultCard, ShapeControl, ReferenceDock, ModelPopover, BrandPicker, SpendTakeover } from "./components";

// All models (incl. finishing) so role presets like Upscaler resolve; the
// composer router renders every non-finishing fal model (finishing runs from /deliver).
const MODELS = listModels();
const modelLabelFor = (id: string | undefined) => MODELS.find((m) => m.id === id)?.label ?? id ?? "";

// Full-catalog grouping for the model router.
const CATEGORY_LABEL: Record<string, string> = {
  image: "Image",
  "image-edit": "Image · Edit",
  video: "Video",
  "video-ref": "Video · References",
  finish: "Finishing",
};
const CATEGORY_ORDER = ["image", "image-edit", "video", "video-ref"];

function modelTags(m: ModelInfo): string[] {
  const t: string[] = [];
  const refs = m.refImages + m.refVideos + m.refAudio;
  if (refs > 0) t.push(`${refs} ref`);
  if (m.hasAudio) t.push("audio");
  if (m.hasFast) t.push("fast");
  if (m.has4k) t.push("4K");
  return t;
}

function ModelChip({ m, on, onClick }: { m: ModelInfo; on: boolean; onClick: () => void }) {
  const tags = modelTags(m);
  return (
    <button
      className={`chip model-chip ${on ? "on" : ""}`}
      style={{ height: "auto", padding: "7px 11px", flexDirection: "column", alignItems: "flex-start", gap: 3 }}
      onClick={onClick}
      title={m.notes || m.id}
    >
      <span style={{ fontWeight: 700 }}>{m.label}</span>
      <span className="row gap2" style={{ alignItems: "center" }}>
        <span className="mono t-xs">${m.usd}/{m.unit === "image" ? "img" : "s"}</span>
        {tags.map((t) => (
          <span key={t} className="model-tag">{t}</span>
        ))}
      </span>
    </button>
  );
}

// Per-mode default model + ratio so the Image/Video tabs route instantly.
const MODE_DEFAULTS: Record<"image" | "video", { model: string; ratio: string }> = {
  image: { model: "openai/gpt-image-2", ratio: "1:1" },
  video: { model: "fal-ai/veo3.1/fast", ratio: "9:16" },
};


// Cinema camera direction — shot size / lens / lighting as prompt modifiers,
// appended like house style. Works for stills and video (the Open-Gen-AI /
// Higgsfield "Cinema Studio" pattern); $0, pure prompt composition.
const CAMERA_PRESETS: { group: string; label: string; options: { id: string; label: string; phrase: string }[] }[] = [
  {
    group: "shot",
    label: "Shot",
    options: [
      { id: "wide", label: "Wide", phrase: "wide establishing shot" },
      { id: "medium", label: "Medium", phrase: "medium shot" },
      { id: "close", label: "Close-up", phrase: "tight close-up" },
      { id: "macro", label: "Macro", phrase: "extreme macro detail" },
    ],
  },
  {
    group: "lens",
    label: "Lens",
    options: [
      { id: "wide-angle", label: "24mm", phrase: "24mm wide-angle lens, deep focus" },
      { id: "fifty", label: "50mm", phrase: "50mm lens, natural perspective" },
      { id: "portrait", label: "85mm", phrase: "85mm portrait lens, shallow depth of field, creamy bokeh" },
      { id: "anamorphic", label: "Anamorphic", phrase: "anamorphic lens, cinematic widescreen, subtle lens flares" },
    ],
  },
  {
    group: "light",
    label: "Light",
    options: [
      { id: "golden", label: "Golden hour", phrase: "warm golden-hour light" },
      { id: "soft", label: "Soft studio", phrase: "soft diffused studio lighting" },
      { id: "noir", label: "Hard noir", phrase: "hard chiaroscuro noir lighting, deep shadows" },
      { id: "neon", label: "Neon", phrase: "moody neon practical lighting" },
    ],
  },
];

// "Animate next shot": the top image→video model, resolved from the live catalog.
const I2V_MODEL =
  MODELS.find((m) => m.featured && m.kind === "image-to-video")?.id ??
  MODELS.find((m) => m.kind === "image-to-video")?.id ??
  "";

// Each role gets a glyph; falls back to its kind icon.
const ROLE_ICON: Record<string, string> = {
  "premium-motion-designer": "film",
  "video-editor": "video",
  "audio-engineer": "bolt",
  "some-strategist": "spark",
  "graphic-designer": "image",
  "concept-artist": "wand",
  "keynote-designer": "dashboard",
  "product-photographer": "gallery",
};

// Mesh-gradient tile background, by stable role hue. Now the *fallback* under a
// role's photo — shown only until the studio has a keeper to wear, or a curated
// still is dropped in /public/roles.
function roleMesh(hue: number): string {
  return (
    `radial-gradient(95% 120% at 14% 6%, oklch(0.6 0.2 ${hue}) 0%, transparent 56%),` +
    `radial-gradient(85% 110% at 88% 16%, oklch(0.52 0.22 ${(hue + 70) % 360}) 0%, transparent 52%),` +
    `radial-gradient(120% 100% at 55% 110%, oklch(0.34 0.16 ${(hue + 305) % 360}) 0%, transparent 62%),` +
    `var(--bg-2)`
  );
}

interface RoleArtAsset {
  blob_url: string;
  content_type: string | null;
  score: number | null;
  status: string;
  label: string;
  role: string | null;
}

// A role tile's face: the studio's own best render for that role → a curated
// still at /roles/<id>.{webp,jpg} → (null, mesh shows through). Each source can
// 404 or fail; onError walks down the chain so a tile is never broken.
function RoleArt({ roleId, live }: { roleId: string; live?: string }) {
  const chain = useMemo(
    () => [live, `/roles/${roleId}.webp`, `/roles/${roleId}.jpg`].filter(Boolean) as string[],
    [roleId, live]
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [roleId, live]);
  const src = chain[idx];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="role-photo" src={src} alt="" loading="lazy" onError={() => setIdx((i) => i + 1)} />
  );
}

// Probe a local video/audio file's duration (seconds) before upload, so we can
// reject clips that exceed a model's reference-length limit client-side.
function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const isVideo = (file.type || "").startsWith("video");
    const el = document.createElement(isVideo ? "video" : "audio");
    el.preload = "metadata";
    const url = URL.createObjectURL(file);
    const finish = (fn: () => void) => {
      URL.revokeObjectURL(url);
      fn();
    };
    el.onloadedmetadata = () => finish(() => resolve(Number.isFinite(el.duration) ? el.duration : 0));
    el.onerror = () => finish(() => reject(new Error("Could not read media")));
    el.src = url;
  });
}

interface Employee {
  id: string;
  name: string;
  description: string;
  studio: { kind: "image" | "video"; model: string; ratio: string; seconds?: number; style: string } | null;
}

export default function CreatePage() {
  const { budget, refresh, jobs } = useStudio();
  const toast = useToast();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-image-2");
  const [employeeId, setEmployeeId] = useState("");
  const [brandId, setBrandId] = useState("none");
  const [ratio, setRatio] = useState("16:9");
  const [numImages, setNumImages] = useState(1);
  const [seconds, setSeconds] = useState(5);
  const [audio, setAudio] = useState(false);
  const [fast, setFast] = useState(false);
  const [tier4k, setTier4k] = useState(false);
  const [quality, setQuality] = useState("high");
  const [negative, setNegative] = useState("");
  const [more, setMore] = useState(false);
  const [refIds, setRefIds] = useState<number[]>([]);
  const [refOpen, setRefOpen] = useState(false);
  const [refPool, setRefPool] = useState<RefAsset[]>([]);
  const [project, setProject] = useState("studio");
  const [label, setLabel] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [brandList, setBrandList] = useState<BrandProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spendOpen, setSpendOpen] = useState(false);
  const [mod, setMod] = useState("Ctrl");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [motion, setMotion] = useState("");
  const [camera, setCamera] = useState<Record<string, string>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  const [roleArt, setRoleArt] = useState<Record<string, string>>({});
  // Sequence (opt-in): a film built shot by shot. Shots share role/brand/model/refs.
  const [seqOpen, setSeqOpen] = useState(false);
  const [shots, setShots] = useState<{ id: number; prompt: string; motion: string }[]>([]);
  const [seqName, setSeqName] = useState("sequence");
  const [seqBusy, setSeqBusy] = useState(false);
  const [seqSpendOpen, setSeqSpendOpen] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleParamRef = useRef(false);
  const shotIdRef = useRef(1);

  const modelInfo = MODELS.find((m) => m.id === model);
  const isVideo = modelInfo?.unit === "video_second";
  const mode: "image" | "video" = isVideo ? "video" : "image";
  const ratios = modelInfo?.ratios ?? ["1:1"];
  // Each reference type has its own native cap (e.g. Seedance refs: 9 img · 3 vid · 3 aud).
  const refCaps: Record<RefKind, number> = {
    image: modelInfo?.refImages ?? 0,
    video: modelInfo?.refVideos ?? 0,
    audio: modelInfo?.refAudio ?? 0,
  };
  const maxRefs = refCaps.image + refCaps.video + refCaps.audio;
  const supportsRefs = maxRefs > 0;
  const acceptsVideoRefs = refCaps.video > 0;
  const acceptsAudioRefs = refCaps.audio > 0;
  const refAccept =
    [refCaps.image > 0 && "image/*", acceptsVideoRefs && "video/*", acceptsAudioRefs && "audio/*"]
      .filter(Boolean)
      .join(",") || "image/*";
  // image-edit / image-to-video / reference-to-video cannot run from text alone.
  const requiresRef = !!modelInfo?.requiresRef;
  const roleTiles = employees.filter((e) => e.studio?.kind === mode);

  const selectedRefs = refPool.filter((a) => refIds.includes(a.id));
  const refImageUrls = selectedRefs.filter((a) => refKind(a) === "image").map((a) => a.blob_url);
  const refVideoUrls = selectedRefs.filter((a) => refKind(a) === "video").map((a) => a.blob_url);
  const refAudioUrls = selectedRefs.filter((a) => refKind(a) === "audio").map((a) => a.blob_url);
  const totalRefs = refImageUrls.length + refVideoUrls.length + refAudioUrls.length;
  // Reference-required models all need a still (start frame / subject); the
  // reference-to-video stack just needs at least one reference of any type.
  const missingRef =
    requiresRef &&
    (modelInfo?.kind === "reference-to-video" ? totalRefs === 0 : refImageUrls.length === 0);

  // Full fal catalog (composer-runnable models only — finishing runs from /deliver).
  const catalog = MODELS.filter((m) => m.tier !== "finish");
  const modelQ = modelQuery.trim().toLowerCase();
  const catalogMatches = modelQ
    ? catalog.filter(
        (m) =>
          m.label.toLowerCase().includes(modelQ) ||
          m.id.toLowerCase().includes(modelQ) ||
          m.category.includes(modelQ) ||
          m.kind.includes(modelQ)
      )
    : catalog;

  const est = useMemo(() => {
    try {
      return estimate({
        provider: "fal",
        model,
        count: isVideo ? seconds : numImages,
        tier: tier4k ? "4k" : undefined,
        quality: modelInfo?.qualities.length ? quality : undefined,
        audio,
        fast,
      });
    } catch {
      return null;
    }
  }, [model, isVideo, seconds, numImages, tier4k, quality, audio, fast, modelInfo]);

  const employee = employees.find((e) => e.id === employeeId);
  const brand = brandList.find((b) => b.id === brandId);
  const brandStyle = resolveBrandStyle(brandList, brandId);
  // Video jobs also pick up the brand's motion direction, when defined.
  const brandParent = brand?.parent ? brandList.find((b) => b.id === brand.parent) : null;
  const motionNote = isVideo ? (brand?.motion ?? brandParent?.motion ?? "") : "";
  const motionPhrase = isVideo ? MOTION_PRESETS.find((mp) => mp.id === motion)?.phrase ?? "" : "";
  // Selected camera modifiers (shot / lens / light), in a stable order.
  const cameraPhrase = CAMERA_PRESETS.map((g) => g.options.find((o) => o.id === camera[g.group])?.phrase)
    .filter(Boolean)
    .join(", ");
  const cameraCount = CAMERA_PRESETS.filter((g) => camera[g.group]).length;
  const styleSuffix = [employee?.studio?.style, brandStyle, motionNote, motionPhrase, cameraPhrase]
    .filter(Boolean)
    .join(", ");
  // The skill description front-loads a human summary before the "Use for:" routing text.
  const roleSummary = employee?.description ? employee.description.split(/\s*Use for:/i)[0].trim() : "";

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees ?? []))
      .catch(() => {});
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => setBrandList(d.brands ?? []))
      .catch(() => {});
  }, []);

  // Preselect a role when arriving from /roles (?role=<id>) — apply once the
  // roster has loaded so the preset (model / ratio / seconds) resolves.
  useEffect(() => {
    if (roleParamRef.current || employees.length === 0) return;
    const roleId = new URLSearchParams(window.location.search).get("role");
    if (!roleId) {
      roleParamRef.current = true;
      return;
    }
    const emp = employees.find((e) => e.id === roleId);
    if (emp?.studio) {
      setEmployeeId(emp.id);
      if (MODELS.some((m) => m.id === emp.studio!.model)) setModel(emp.studio!.model);
      setRatio(emp.studio!.ratio);
      if (emp.studio!.seconds) setSeconds(emp.studio!.seconds);
    }
    roleParamRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
  }, [employees]);

  // Each role wears its own best work. Pull the studio's highest-scoring keeper
  // (approved / delivered, or 8+) rendered under each role — images only, so a
  // tile never shows a half-loaded video. Curated stills + the mesh gradient are
  // the fallbacks (see RoleArt).
  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => {
        const best: Record<string, number> = {};
        const url: Record<string, string> = {};
        for (const a of (d.assets ?? []) as RoleArtAsset[]) {
          if (!a.blob_url || !(a.content_type ?? "image").startsWith("image")) continue;
          const keeper = a.status === "approved" || a.status === "delivered" || (a.score ?? 0) >= 8;
          if (!keeper) continue;
          const key = a.role || a.label;
          if (!key) continue;
          const score = a.score ?? 8;
          if (best[key] === undefined || score > best[key]) {
            best[key] = score;
            url[key] = a.blob_url;
          }
        }
        setRoleArt(url);
      })
      .catch(() => {});
  }, []);

  // Resume the last session and open ready to type. Persisted client-side only.
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod("⌘");
    try {
      const raw = localStorage.getItem("sc.create");
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.prompt === "string") setPrompt(s.prompt);
        if (typeof s.model === "string" && MODELS.some((m) => m.id === s.model)) setModel(s.model);
        if (typeof s.employeeId === "string") setEmployeeId(s.employeeId);
        if (typeof s.brandId === "string") setBrandId(s.brandId);
        if (typeof s.ratio === "string") setRatio(s.ratio);
        if (Number.isFinite(s.numImages)) setNumImages(s.numImages);
        if (Number.isFinite(s.seconds)) setSeconds(s.seconds);
      }
    } catch {
      /* ignore corrupt state */
    }
    hydratedRef.current = true;
    promptRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        "sc.create",
        JSON.stringify({ prompt, model, employeeId, brandId, ratio, numImages, seconds })
      );
    } catch {
      /* storage full / blocked — non-fatal */
    }
  }, [prompt, model, employeeId, brandId, ratio, numImages, seconds]);

  useEffect(() => {
    if (!refOpen || refPool.length > 0) return;
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setRefPool((d.assets as RefAsset[]).filter((a) => a.status !== "hidden")))
      .catch(() => {});
  }, [refOpen, refPool.length]);

  // Deep-link from the gallery: ?ref=<id> attaches an asset as a reference,
  // ?iterate=<id> re-opens its prompt + model to riff on. From the Showcase
  // dock: ?prompt=<text>&mode=<image|video> seeds a fresh draft.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refId = Number(params.get("ref")) || 0;
    const iterId = Number(params.get("iterate")) || 0;
    const seedPrompt = params.get("prompt");
    const seedMode = params.get("mode");
    if (seedPrompt != null || seedMode) {
      if (seedPrompt != null) setPrompt(seedPrompt);
      if (seedMode === "image" || seedMode === "video") {
        const def = MODE_DEFAULTS[seedMode];
        if (MODELS.some((m) => m.id === def.model)) setModel(def.model);
        setRatio(def.ratio);
        setEmployeeId("");
      }
      promptRef.current?.focus();
    }
    if (!refId && !iterId) {
      if (seedPrompt != null || seedMode) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return;
    }
    const targetId = refId || iterId;
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => {
        const assets = ((d.assets as (RefAsset & { model?: string; prompt?: string })[]) ?? []).filter(
          (a) => a.status !== "hidden"
        );
        if (assets.length) setRefPool(assets);
        const asset = assets.find((a) => a.id === targetId);
        if (asset) {
          const isVid = asset.content_type?.startsWith("video");
          if (refId) {
            const target = isVid ? "bytedance/seedance-2.0/reference-to-video" : "openai/gpt-image-2/edit";
            const cur = MODELS.find((m) => m.id === model);
            const curOk = !!cur && (isVid ? cur.refVideos : cur.refImages) > 0;
            if (!curOk && MODELS.some((m) => m.id === target)) setModel(target);
            setRefIds([asset.id]);
          } else if (iterId) {
            if (asset.prompt) setPrompt(asset.prompt);
            if (asset.model && MODELS.some((m) => m.id === asset.model)) setModel(asset.model);
          }
        }
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the model changes, snap every native param into its envelope and drop
  // anything the new model can't accept — the UI can never offer an illegal job.
  useEffect(() => {
    if (!modelInfo) return;
    if (modelInfo.ratios.length && !modelInfo.ratios.includes(ratio)) setRatio(modelInfo.ratios[0]);
    if (modelInfo.durations.mode !== "none") {
      setSeconds((s) => coerceSeconds(modelInfo.durations, s || defaultSeconds(modelInfo.durations)));
    }
    setNumImages((n) => Math.min(Math.max(n, modelInfo.numImages.min), modelInfo.numImages.max));
    if (!modelInfo.hasAudio) setAudio(false);
    if (!modelInfo.hasFast) setFast(false);
    if (!modelInfo.has4k) setTier4k(false);
    setRefIds((prev) => {
      if (!prev.length) return prev;
      const room: Record<RefKind, number> = {
        image: modelInfo.refImages,
        video: modelInfo.refVideos,
        audio: modelInfo.refAudio,
      };
      const kept: number[] = [];
      for (const id of prev) {
        const a = refPool.find((x) => x.id === id);
        if (!a) continue;
        const k = refKind(a);
        if (room[k] > 0) {
          kept.push(id);
          room[k]--;
        }
      }
      return kept.length === prev.length ? prev : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  function pickMode(next: "image" | "video") {
    if (next === mode) return;
    const def = MODE_DEFAULTS[next];
    setEmployeeId("");
    const target = MODELS.find((m) => m.id === def.model);
    if (target) {
      setModel(def.model);
      if (next === "video") setSeconds(defaultSeconds(target.durations));
    }
    setRatio(def.ratio);
  }
  function pickEmployee(id: string) {
    setEmployeeId((cur) => (cur === id ? "" : id));
    const preset = employees.find((e) => e.id === id)?.studio;
    if (preset && MODELS.some((m) => m.id === preset.model)) {
      setModel(preset.model);
      setRatio(preset.ratio);
      if (preset.seconds) setSeconds(preset.seconds);
    }
  }
  function toggleRef(a: RefAsset) {
    const k = refKind(a);
    setRefIds((prev) => {
      if (prev.includes(a.id)) return prev.filter((i) => i !== a.id);
      const ofType = refPool.filter((x) => prev.includes(x.id) && refKind(x) === k).length;
      return ofType < refCaps[k] ? [...prev, a.id] : prev;
    });
  }

  // Upload reference files straight from the operator's machine. Each file is
  // validated against THIS model's native reference limits (type · size · length)
  // before we spend the upload; survivors mirror to Blob, register as $0 assets,
  // and auto-select while honouring each type's remaining room.
  const onUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0 || !supportsRefs || !modelInfo) return;
      const limits = modelInfo.refMedia;
      const typeName = ([refCaps.image && "image", refCaps.video && "video", refCaps.audio && "audio"] as const)
        .filter(Boolean)
        .join(" / ");

      const valid: File[] = [];
      for (const f of list) {
        const t = f.type || "";
        const k: RefKind | null = t.startsWith("video")
          ? "video"
          : t.startsWith("audio")
            ? "audio"
            : t.startsWith("image")
              ? "image"
              : null;
        if (!k || refCaps[k] === 0) {
          toast({ kind: "bad", title: "Unsupported file", sub: `${f.name || "File"} — ${modelInfo.label} takes ${typeName} references` });
          continue;
        }
        const mb = k === "video" ? limits.maxVideoMB : k === "audio" ? limits.maxAudioMB : limits.maxImageMB;
        if (f.size > mb * 1024 * 1024) {
          toast({ kind: "bad", title: "Too large", sub: `${f.name} exceeds ${mb}MB for ${k} references` });
          continue;
        }
        if (k === "video" || k === "audio") {
          const maxSec = k === "video" ? limits.maxVideoSec : limits.maxAudioSec;
          const sec = await probeDuration(f).catch(() => 0);
          if (sec > maxSec + 0.5) {
            toast({ kind: "bad", title: "Too long", sub: `${f.name} is ${Math.round(sec)}s — ${k} references cap at ${maxSec}s` });
            continue;
          }
        }
        valid.push(f);
      }
      if (valid.length === 0) return;

      setUploading(true);
      try {
        const fd = new FormData();
        valid.forEach((f) => fd.append("files", f));
        fd.append("model", model);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        const added = (data.assets ?? []) as RefAsset[];
        setRefPool((prev) => [...added, ...prev.filter((p) => !added.some((n) => n.id === p.id))]);
        setRefIds((prev) => {
          const room: Record<RefKind, number> = { ...refCaps };
          for (const id of prev) {
            const a = [...added, ...refPool].find((x) => x.id === id);
            if (a) room[refKind(a)]--;
          }
          const next = [...prev];
          for (const a of added) {
            const k = refKind(a);
            if (room[k] > 0) {
              next.push(a.id);
              room[k]--;
            }
          }
          return next;
        });
        toast({ kind: "ok", title: "Reference added", sub: `${added.length} file${added.length > 1 ? "s" : ""} ready` });
      } catch (err) {
        toast({ kind: "bad", title: "Upload failed", sub: err instanceof Error ? err.message : "Try again" });
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supportsRefs, model, modelInfo, refCaps.image, refCaps.video, refCaps.audio, refPool, toast]
  );

  const overThreshold = !!(est && budget && est.usd > budget.settings.confirmThresholdUsd);
  const projectedRatio = budget && est ? (budget.spentWeekUsd + est.usd) / budget.settings.weeklyCapUsd : 0;
  const overCap = !!(est && budget && est.usd > budget.remainingWeekUsd);

  const submit = useCallback(
    async (confirmed: boolean) => {
      if (!est || !budget) return;
      setBusy(true);
      setError(null);
      try {
        const fullPrompt = styleSuffix ? `${prompt.trim()}, ${styleSuffix}` : prompt.trim();
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: fullPrompt,
            model,
            numImages,
            seconds,
            ratio,
            audio: modelInfo?.hasAudio ? audio : false,
            fast,
            tier: tier4k ? "4k" : undefined,
            quality: modelInfo?.qualities.length ? quality : undefined,
            negativePrompt: modelInfo?.hasNegative ? negative || undefined : undefined,
            refImageUrls,
            refVideoUrls,
            refAudioUrls,
            project,
            label: label || (employee ? employee.id : "asset"),
            role: employeeId || undefined,
            confirmed,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === "confirm_required") {
            setSpendOpen(true);
            return;
          }
          if (data.error === "weekly_cap_exceeded") throw new Error(`Weekly cap reached ($${data.budget?.settings.weeklyCapUsd}). Finance can raise it in Settings.`);
          if (data.error === "monthly_pool_exceeded") throw new Error(`Monthly team pool exhausted ($${data.budget?.settings.monthlyPoolUsd}).`);
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setSpendOpen(false);
        if (typeof data.jobId === "number") setLastJobId(data.jobId);
        // Keep the prompt — one-variable iteration IS the loop; tweak and fire again.
        ensureNotifyPermission();
        toast({ kind: "ok", title: "On the line", sub: `${money(est.usd)} · watch it land below` });
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [est, budget, styleSuffix, prompt, model, numImages, seconds, ratio, audio, fast, tier4k, quality, negative, refImageUrls, refVideoUrls, refAudioUrls, project, label, employee, modelInfo]
  );

  function onGenerate() {
    if (overThreshold) setSpendOpen(true);
    else submit(false);
  }

  // ✨ Enhance — rewrite the plain prompt into a model-optimal one before any spend.
  const enhance = useCallback(async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.enhanced !== "string") throw new Error(data.error ?? "Enhance failed");
      if (data.changed) {
        setPrompt(data.enhanced);
        toast({ kind: "ok", title: "Prompt enhanced", sub: (data.added ?? []).join(" · ") });
      } else {
        toast({ kind: "info", title: "Already sharp", sub: "Nothing to add — send it." });
      }
      promptRef.current?.focus();
    } catch (err) {
      toast({ kind: "bad", title: "Couldn’t enhance", sub: err instanceof Error ? err.message : "Try again" });
    } finally {
      setEnhancing(false);
    }
  }, [prompt, model, enhancing, toast]);

  // Inline-result actions — keep the create→see→iterate loop on this page.
  const keepAsset = useCallback(
    async (assetId: number) => {
      try {
        const res = await fetch(`/api/assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        });
        if (!res.ok) throw new Error();
        toast({ kind: "ok", title: "Kept ✅", sub: "Saved to the used set" });
        refresh();
      } catch {
        toast({ kind: "bad", title: "Couldn’t keep it", sub: "Try again" });
      }
    },
    [toast, refresh]
  );

  const iterateHere = useCallback(() => {
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Image→video bridge: attach the still as a reference and switch to the top i2v model.
  const animateAsset = useCallback(
    (asset: ClientJobAsset) => {
      if (!I2V_MODEL) {
        toast({ kind: "info", title: "No image→video model available" });
        return;
      }
      setModel(I2V_MODEL);
      setRefPool((prev) =>
        prev.some((p) => p.id === asset.id)
          ? prev
          : [{ id: asset.id, blob_url: asset.blob_url, content_type: asset.content_type, label: "shot" }, ...prev]
      );
      setRefIds([asset.id]);
      promptRef.current?.focus();
      toast({ kind: "ok", title: "Bridged to video", sub: "Your still is attached — now describe the motion" });
    },
    [toast]
  );

  // ---- Sequence (opt-in): build a film shot by shot, then fire the shots in order ----
  const addShot = useCallback(() => {
    const p = prompt.trim();
    if (!p) return;
    setShots((prev) => [...prev, { id: shotIdRef.current++, prompt: p, motion }]);
    setPrompt("");
    promptRef.current?.focus();
  }, [prompt, motion]);

  const editShot = useCallback(
    (id: number) => {
      const s = shots.find((x) => x.id === id);
      if (!s) return;
      setPrompt(s.prompt);
      setMotion(s.motion);
      setShots((prev) => prev.filter((x) => x.id !== id));
      promptRef.current?.focus();
    },
    [shots]
  );

  const removeShot = useCallback((id: number) => {
    setShots((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const seqTotalUsd = (est?.usd ?? 0) * shots.length;
  const seqOverThreshold = !!(budget && seqTotalUsd > budget.settings.confirmThresholdUsd);
  const seqOverCap = !!(budget && seqTotalUsd > budget.remainingWeekUsd);

  // Fire every queued shot in order under one sequence name. One batched preflight;
  // the server still enforces the weekly cap per shot, so we stop cleanly if it's hit
  // and keep the un-fired shots so the operator can resume.
  const runSequence = useCallback(
    async (confirmed: boolean) => {
      if (!est || !budget || shots.length === 0 || seqBusy) return;
      if (!confirmed && seqTotalUsd > budget.settings.confirmThresholdUsd) {
        setSeqSpendOpen(true);
        return;
      }
      setSeqBusy(true);
      setError(null);
      const project = seqName.trim() || "sequence";
      let fired = 0;
      let lastId: number | null = null;
      try {
        for (let i = 0; i < shots.length; i++) {
          const shot = shots[i];
          const motionPh = isVideo ? MOTION_PRESETS.find((m) => m.id === shot.motion)?.phrase ?? "" : "";
          const suffix = [employee?.studio?.style, brandStyle, motionNote, motionPh].filter(Boolean).join(", ");
          const fullPrompt = suffix ? `${shot.prompt}, ${suffix}` : shot.prompt;
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: fullPrompt,
              model,
              numImages,
              seconds,
              ratio,
              audio,
              fast,
              tier: tier4k ? "4k" : undefined,
              quality: modelInfo?.qualities.length ? quality : undefined,
              negativePrompt: negative || undefined,
              refImageUrls,
              refVideoUrls,
              refAudioUrls,
              project,
              label: `shot-${i + 1}`,
              confirmed: true,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            if (data.error === "weekly_cap_exceeded")
              throw new Error(`Weekly cap reached after ${fired} shot${fired === 1 ? "" : "s"} — raise it in Settings or run the rest next week.`);
            if (data.error === "monthly_pool_exceeded")
              throw new Error(`Monthly team pool exhausted after ${fired} shot${fired === 1 ? "" : "s"}.`);
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          if (typeof data.jobId === "number") lastId = data.jobId;
          fired++;
        }
        setSeqSpendOpen(false);
        setShots([]);
        if (lastId != null) setLastJobId(lastId);
        ensureNotifyPermission();
        toast({ kind: "ok", title: `${fired} shot${fired === 1 ? "" : "s"} on the line`, sub: `${money(seqTotalUsd)} · they land in the gallery as they finish` });
        refresh();
      } catch (err) {
        if (fired > 0) {
          setShots((prev) => prev.slice(fired));
          refresh();
        }
        setError(err instanceof Error ? err.message : "Sequence failed");
      } finally {
        setSeqBusy(false);
      }
    },
    [est, budget, shots, seqBusy, seqName, isVideo, employee, brandStyle, motionNote, model, numImages, seconds, ratio, audio, fast, tier4k, quality, negative, refImageUrls, refVideoUrls, refAudioUrls, modelInfo, toast, refresh, seqTotalUsd]
  );

  const warning = overCap ? (
    <span style={{ color: "var(--bad-tx)" }}>⚠️ Over this week&apos;s remaining budget</span>
  ) : projectedRatio >= 0.75 ? (
    <span style={{ color: "var(--warn-tx)" }}>▲ Past 75% of the weekly cap</span>
  ) : overThreshold ? (
    <span style={{ color: "var(--warn-tx)" }}>🎬 Over ${budget?.settings.confirmThresholdUsd} — needs a confirm</span>
  ) : est ? (
    <span className="muted">Under the auto-approve limit</span>
  ) : null;

  return (
    <div className="screen-pad">
      <div className="create-hero">
        <div className="create-head">
          <p className="t-label t-eyebrow">Create</p>
          <h1 className="t-display" style={{ textAlign: "center", margin: 0 }}>What are we making?</h1>
          <div className="modetabs">
            {(["image", "video"] as const).map((md) => (
              <button key={md} className={`modetab ${mode === md ? "on" : ""}`} onClick={() => pickMode(md)}>
                <Icon name={md} size={18} /> {md === "image" ? "Image" : "Video"}
              </button>
            ))}
          </div>
        </div>

        {/* ROLE TILES — the cast, one tap routes model + ratio + house style */}
        <div className="role-block">
          <div className="between">
            <span className="t-label" style={{ margin: 0 }}>Pick a role</span>
            <span className="t-xs muted" style={{ maxWidth: 460, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {roleSummary || "Optional — routes the model, ratio and house style"}
            </span>
          </div>
          <div className="role-grid" key={mode}>
            <button
              className={`role-tile freeform ${!employeeId ? "on" : ""}`}
              onClick={() => setEmployeeId("")}
              aria-label="Freeform — no role"
            >
              <div className="role-ico"><Icon name="wand" size={20} /></div>
              <span className="ff-label">Freeform</span>
              {!employeeId && <span className="role-check"><Icon name="check" size={13} /></span>}
              <div className="role-pop" role="tooltip">
                <div className="role-pop-hd">Freeform</div>
                <div className="role-pop-style muted">No house style — your prompt is sent exactly as written.</div>
              </div>
            </button>
            {roleTiles.map((e) => {
              const on = employeeId === e.id;
              const s = e.studio;
              return (
                <button
                  key={e.id}
                  className={`role-tile ${on ? "on" : ""}`}
                  onClick={() => pickEmployee(e.id)}
                  aria-label={e.name}
                >
                  <span className="role-fill">
                    <span className="role-bg" style={{ background: roleMesh(hueFor(e.id)) }} />
                    <RoleArt roleId={e.id} live={roleArt[e.id]} />
                    <span className="role-scrim" />
                  </span>
                  <div className="role-ico">
                    <Icon name={ROLE_ICON[e.id] ?? (s?.kind === "video" ? "video" : "image")} size={18} />
                  </div>
                  <div className="role-meta">
                    <span className="role-name">{e.name}</span>
                    <span className="role-kind">{s?.kind === "video" ? "Video" : "Image"}</span>
                  </div>
                  {on && <span className="role-check"><Icon name="check" size={13} /></span>}
                  <div className="role-pop" role="tooltip">
                    <div className="role-pop-hd">{e.name}</div>
                    <div className="role-pop-meta mono">
                      {modelLabelFor(s?.model)}
                      {s?.ratio ? ` · ${s.ratio}` : ""}
                      {s?.seconds ? ` · ${s.seconds}s` : ""}
                    </div>
                    {s?.style ? (
                      <>
                        <div className="role-pop-cap">Adds to your prompt</div>
                        <div className="role-pop-style">{s.style}</div>
                      </>
                    ) : (
                      <div className="role-pop-style muted">Finishing pass — your prompt is left untouched.</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COMPOSER — prompt + the controls that always stay in sight */}
        <Card
          className={`composer ${dragActive ? "dragging" : ""}`}
          onDragOver={(e) => {
            if (!supportsRefs) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragActive(false);
          }}
          onDrop={(e) => {
            if (!supportsRefs) return;
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.length) onUploadFiles(e.dataTransfer.files);
          }}
        >
          <textarea
            ref={promptRef}
            className="composer-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              supportsRefs && refImageUrls.length
                ? "Reference with @Image1, @Image2… e.g. @Image1 sprints through rain, camera tracking"
                : isVideo
                  ? "Describe the shot… a cinematic move through…"
                  : "Describe the image… a studio render of…"
            }
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim() && est && !overCap && !busy && !missingRef) {
                onGenerate();
              }
            }}
          />

          {/* ASSIST — enhance the prompt, direct the camera, or borrow a starter */}
          <div className="row gap2 wrap" style={{ marginTop: 10, alignItems: "center" }}>
            <button
              type="button"
              className="chip"
              disabled={!prompt.trim() || enhancing || busy}
              onClick={enhance}
              title="Rewrite into a model-optimal prompt before you spend"
            >
              <Icon name="spark" size={13} /> {enhancing ? "Enhancing…" : "Enhance"}
            </button>
            <button
              type="button"
              className={`chip ${cameraOpen || cameraCount > 0 ? "on" : ""}`}
              onClick={() => setCameraOpen((v) => !v)}
              title="Add cinema camera, lens and lighting direction"
            >
              <Icon name="film" size={13} /> Camera{cameraCount > 0 ? ` · ${cameraCount}` : ""}
            </button>
            {isVideo && (
              <>
                <span className="t-xs muted" style={{ marginLeft: 4 }}>Motion</span>
                {MOTION_PRESETS.map((mp) => (
                  <button
                    key={mp.id}
                    type="button"
                    className={`chip ${motion === mp.id ? "on" : ""}`}
                    onClick={() => setMotion((c) => (c === mp.id ? "" : mp.id))}
                  >
                    {mp.label}
                  </button>
                ))}
              </>
            )}
          </div>
          {/* CAMERA RACK — shot / lens / light language, appended like house style (image + video) */}
          {cameraOpen && (
            <div className="col gap2" style={{ marginTop: 8 }}>
              {CAMERA_PRESETS.map((g) => (
                <div key={g.group} className="row gap2 wrap" style={{ alignItems: "center" }}>
                  <span className="t-xs muted" style={{ width: 44, flex: "none" }}>{g.label}</span>
                  {g.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`chip ${camera[g.group] === o.id ? "on" : ""}`}
                      title={o.phrase}
                      onClick={() =>
                        setCamera((c) => ({ ...c, [g.group]: c[g.group] === o.id ? "" : o.id }))
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {!prompt.trim() && (
            <div className="row gap2 wrap" style={{ marginTop: 8, alignItems: "center" }}>
              <span className="t-xs muted">Try</span>
              {EXAMPLES[mode].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="chip"
                  title={ex}
                  style={{ maxWidth: 320 }}
                  onClick={() => {
                    setPrompt(ex);
                    promptRef.current?.focus();
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex}</span>
                </button>
              ))}
            </div>
          )}

          {/* REFERENCES — upload or pull from the gallery, surfaced inline */}
          {supportsRefs && (
            <ReferenceDock
              selected={selectedRefs}
              pool={refPool}
              refIds={refIds}
              caps={refCaps}
              accept={refAccept}
              required={requiresRef}
              missing={missingRef}
              refMedia={modelInfo?.refMedia}
              uploading={uploading}
              open={refOpen}
              fileInputRef={fileInputRef}
              onToggleOpen={() => setRefOpen((v) => !v)}
              onUpload={onUploadFiles}
              onToggleRef={toggleRef}
            />
          )}

          <div className="composer-bar">
            <div className="row gap2 wrap" style={{ minWidth: 0, alignItems: "center" }}>
              <ModelPopover
                models={catalog}
                value={model}
                onChange={setModel}
                onMore={() => setMore(true)}
                isVideo={isVideo}
              />
              {ratios.length > 0 && (
                <Seg options={ratios.map((r) => ({ value: r, label: r }))} value={ratio} onChange={setRatio} />
              )}
              <ShapeControl
                modelInfo={modelInfo}
                isVideo={!!isVideo}
                seconds={seconds}
                numImages={numImages}
                onSeconds={setSeconds}
                onNumImages={setNumImages}
              />
              {supportsRefs && selectedRefs.length > 0 && <span className="chip soft">{selectedRefs.length} ref</span>}
            </div>
            <div className="composer-send">
              {/* Brand picker sits where Generate used to — project + sub-brand in one tap */}
              <BrandPicker brands={brandList} value={brandId} onChange={setBrandId} />
              <div className="composer-cost mono">
                <span className="amt">{est ? <CountUp value={est.usd} decimals={est.usd >= 1 ? 2 : 3} prefix="$" /> : "—"}</span>
                {budget && <span className="t-xs muted">{usd(budget.remainingWeekUsd)} left this week</span>}
              </div>
              {/* Generate anchored to the lower-right corner of the box */}
              <Btn
                variant="primary"
                size="lg"
                disabled={busy || !prompt.trim() || !est || overCap || missingRef}
                onClick={onGenerate}
                title={missingRef ? "Add a reference first" : `Generate (${mod}↵)`}
              >
                {busy ? "Queueing…" : missingRef ? "Needs a reference" : overThreshold ? "Review spend" : "Generate"}
                <Icon name="arrowRight" size={16} />
              </Btn>
            </div>
          </div>
        </Card>

        {/* budget — calm by default, only swells to the full gauge near the cap */}
        {budget && est &&
          (overCap || overThreshold || projectedRatio >= 0.75 ? (
            <div className="composer-budget">
              <FuelGauge spent={budget.spentWeekUsd} cap={budget.settings.weeklyCapUsd} projected={est.usd} />
              <div className="between t-xs mono" style={{ marginTop: 7 }}>
                <span className="muted">
                  {usd(budget.spentWeekUsd)} spent · {usd(budget.spentWeekUsd + est.usd)} after this
                </span>
                {warning}
              </div>
            </div>
          ) : (
            <div className="t-xs muted" style={{ marginTop: 8, textAlign: "center" }}>
              {usd(budget.remainingWeekUsd)} left this week · the dial only speaks up near the cap
            </div>
          ))}

        {/* role status + advanced toggle */}
        <div className="composer-hints">
          <span className="t-label" style={{ margin: 0 }}>
            {employee ? `${employee.name} style auto-appended` : "No role — raw prompt"}
          </span>
          <span className="kbd-hint">
            <kbd>{mod}</kbd><kbd>↵</kbd> to generate
          </span>
          <div className="grow" />
          <button className={`btn btn-ghost btn-sm ${more ? "on" : ""}`} onClick={() => setMore((v) => !v)}>
            <Icon name={more ? "chevronDown" : "settings"} size={14} /> {more ? "Hide options" : "More options"}
          </button>
        </div>

        {/* SEQUENCE — opt-in: build a film shot by shot; shots share role, brand & refs */}
        <div style={{ marginTop: 16 }}>
          <div className="between">
            <button
              type="button"
              onClick={() => setSeqOpen((v) => !v)}
              aria-expanded={seqOpen}
              className="t-label"
              style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 7, background: "none", cursor: "pointer" }}
            >
              <Icon name="workflows" size={13} /> Sequence — build the film shot by shot
              {shots.length > 0 && <span className="chip soft" style={{ height: 19 }}>{shots.length}</span>}
              <Icon name={seqOpen ? "chevronDown" : "chevronRight"} size={13} />
            </button>
            <span className="t-xs muted">opt-in · holds role, brand &amp; refs across shots</span>
          </div>

          {seqOpen && (
            <div className="card card-pad" style={{ marginTop: 10 }}>
              <div className="row gap2 wrap" style={{ alignItems: "stretch" }}>
                {shots.map((s, i) => (
                  <div
                    key={s.id}
                    style={{ width: 150, padding: 9, borderRadius: "var(--r-md)", border: "1px solid var(--line-2)", background: "var(--bg-1)", display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div className="between">
                      <span className="t-xs mono" style={{ color: "var(--accent-hi)" }}>Shot {i + 1}</span>
                      <div className="row gap1">
                        <button type="button" className="icon-btn ghost" style={{ width: 22, height: 22 }} title="Edit this shot" onClick={() => editShot(s.id)}>
                          <Icon name="settings" size={12} />
                        </button>
                        <button type="button" className="icon-btn ghost" style={{ width: 22, height: 22 }} title="Remove" onClick={() => removeShot(s.id)}>
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    </div>
                    <span className="t-xs" style={{ color: "var(--tx-2)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 42 }}>
                      {s.prompt}
                    </span>
                    {isVideo && s.motion && (
                      <span className="chip soft" style={{ height: 18, alignSelf: "flex-start" }}>
                        {MOTION_PRESETS.find((m) => m.id === s.motion)?.label}
                      </span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  disabled={!prompt.trim()}
                  onClick={addShot}
                  title={prompt.trim() ? "Add the current prompt as the next shot" : "Type a prompt above first"}
                  style={{ width: 150, minHeight: 92, borderRadius: "var(--r-md)", border: "1px dashed var(--line-3)", background: "transparent", color: prompt.trim() ? "var(--accent-hi)" : "var(--tx-3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: prompt.trim() ? "pointer" : "not-allowed" }}
                >
                  <Icon name="create" size={18} />
                  <span className="t-xs">Add shot</span>
                </button>
              </div>

              <div className="between wrap" style={{ marginTop: 14, gap: 12 }}>
                <label className="row gap2" style={{ alignItems: "center" }}>
                  <span className="t-xs muted">Sequence name</span>
                  <input className="input" value={seqName} onChange={(e) => setSeqName(e.target.value)} style={{ height: 30, width: 160, fontSize: 12.5 }} />
                </label>
                <div className="row gap3" style={{ alignItems: "center" }}>
                  <div className="composer-cost mono" style={{ textAlign: "right" }}>
                    <span className="amt">{shots.length > 0 && est ? money(seqTotalUsd) : "—"}</span>
                    <span className="t-xs muted">
                      {shots.length} shot{shots.length === 1 ? "" : "s"}{est ? ` · ${money(est.usd)} each` : ""}
                    </span>
                  </div>
                  <Btn
                    variant="primary"
                    size="lg"
                    disabled={seqBusy || shots.length === 0 || !est || seqOverCap}
                    onClick={() => runSequence(false)}
                    title={seqOverCap ? "Over this week's remaining budget" : "Queue every shot in order"}
                  >
                    {seqBusy ? "Queueing…" : seqOverThreshold ? "Review spend" : "Run sequence"}
                    <Icon name="arrowRight" size={16} />
                  </Btn>
                </div>
              </div>
              {seqOverCap && (
                <p className="t-xs" style={{ color: "var(--bad-tx)", marginTop: 8 }}>
                  ⚠️ The full sequence is over this week&apos;s remaining budget — trim shots or raise the cap in Settings.
                </p>
              )}
              {shots.length === 0 && (
                <p className="t-xs muted" style={{ marginTop: 10 }}>
                  Compose a shot above, hit <b>Add shot</b>, repeat. Every shot keeps the same role, brand and references — only the prompt and camera change. Then run them all in order.
                </p>
              )}
            </div>
          )}
        </div>

        {error && <p className="err" style={{ marginTop: 12, textAlign: "center" }}>⚠️ {error}</p>}

        <ResultDock
          jobs={jobs}
          lastJobId={lastJobId}
          onIterate={iterateHere}
          onKeep={keepAsset}
          onAnimate={animateAsset}
          onCancel={async (jobId) => {
            const status = await cancelJob(jobId);
            if (status === "canceled") toast({ kind: "info", title: "Canceled", sub: "Stopped before it finished" });
            else if (status === "done") toast({ kind: "ok", title: "Already landed", sub: "It finished first" });
            else toast({ kind: "bad", title: "Couldn’t cancel", sub: "It may have already finished" });
            refresh();
          }}
        />
      </div>

      {/* ADVANCED — everything lives here, one click away */}
      {more && (
        <Card pad className="adv-panel">
          {/* MODEL ROUTER — full fal catalog, top models pinned */}
          <div className="between" style={{ alignItems: "center" }}>
            <span className="t-label" style={{ margin: 0 }}>Model router — full fal catalog, top models pinned</span>
            <label className="row gap2" style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 9, color: "var(--tx-3)", display: "grid", placeItems: "center", pointerEvents: "none" }}>
                <Icon name="search" size={13} />
              </span>
              <input
                className="input"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Search the catalog…"
                style={{ paddingLeft: 28, height: 30, width: 200, fontSize: 12 }}
              />
            </label>
          </div>

          {!modelQ && (
            <div style={{ marginTop: 12 }}>
              <div className="t-xs muted" style={{ marginBottom: 6 }}>
                <Icon name="spark" size={11} /> Top models — the ones we primarily use
              </div>
              <div className="row gap2 wrap">
                {catalog
                  .filter((m) => m.featured)
                  .map((m) => (
                    <ModelChip key={m.id} m={m} on={model === m.id} onClick={() => setModel(m.id)} />
                  ))}
              </div>
            </div>
          )}

          <div className="col gap3" style={{ marginTop: 14 }}>
            {CATEGORY_ORDER.map((cat) => {
              const list = catalogMatches.filter((m) => m.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="t-xs muted" style={{ marginBottom: 6 }}>{CATEGORY_LABEL[cat] ?? cat}</div>
                  <div className="row gap2 wrap">
                    {list.map((m) => (
                      <ModelChip key={m.id} m={m} on={model === m.id} onClick={() => setModel(m.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
            {catalogMatches.length === 0 && (
              <p className="t-sm muted">No models match &ldquo;{modelQuery}&rdquo;.</p>
            )}
          </div>

          <div className="hr" style={{ margin: "16px 0" }} />

          {/* OUTPUT — ratio + length live on the composer bar (one source of truth); quality is the only extra */}
          {(modelInfo?.qualities.length ?? 0) > 0 && (
            <div className="row gap4 wrap">
              <div>
                <span className="field-label">Quality</span>
                <Seg options={modelInfo!.qualities.map((q) => ({ value: q, label: q }))} value={quality} onChange={setQuality} />
              </div>
            </div>
          )}

          {/* MODES + NEGATIVE */}
          {(modelInfo?.hasAudio || modelInfo?.hasFast || modelInfo?.has4k) && (
            <div className="row gap5 wrap" style={{ marginTop: 14 }}>
              {modelInfo?.hasAudio && (
                <label className="row gap2 t-sm">
                  <Switch on={audio} onChange={setAudio} /> Native audio
                  <span className="t-xs muted">{modelInfo.audioBilled ? "(higher rate)" : "(no extra cost)"}</span>
                </label>
              )}
              {modelInfo?.hasFast && (
                <label className="row gap2 t-sm">
                  <Switch on={fast} onChange={setFast} /> Fast lane
                </label>
              )}
              {modelInfo?.has4k && (
                <label className="row gap2 t-sm">
                  <Switch on={tier4k} onChange={setTier4k} /> 4K master
                </label>
              )}
            </div>
          )}
          {modelInfo?.hasNegative && (
            <div style={{ marginTop: 12 }}>
              <input className="input" placeholder="Negative prompt (avoid…)" value={negative} onChange={(e) => setNegative(e.target.value)} />
            </div>
          )}

          <div className="hr" style={{ margin: "16px 0" }} />

          {/* DIRECTION — brand lock summary (selection lives in the composer dropdown) */}
          <div className="between">
            <span className="t-label" style={{ margin: 0 }}>
              <Icon name="lock" size={12} /> Brand lock — {brand && brandId !== "none" ? brandPath(brandList, brandId) : "none"}
            </span>
            <Link className="btn btn-ghost btn-sm" href="/brands">
              <Icon name="settings" size={13} /> Manage brands
            </Link>
          </div>
          {brand && brandId !== "none" && (
            <div className="brandlock-card" style={{ marginTop: 12 }}>
              {brand.palette?.length > 0 && (
                <div className="brandlock-swatches">
                  {brand.palette.map((c) => (
                    <span key={c} title={c} style={{ background: c }} />
                  ))}
                </div>
              )}
              <div className="col gap2" style={{ minWidth: 0 }}>
                {brand.tagline && <span className="t-sm" style={{ color: "var(--tx-2)" }}>{brand.tagline}</span>}
                {brand.fonts && (
                  <span className="t-xs muted">
                    {Object.values(brand.fonts).filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* prompt preview when styling is applied */}
          {(prompt.trim() && styleSuffix) && (
            <div className="review-prompt mono" style={{ marginTop: 12, fontSize: 11.5 }}>
              <span style={{ color: "var(--tx-1)" }}>{prompt.trim()}</span>
              {employee?.studio?.style && <span style={{ color: "var(--accent-hi)" }}>, {employee.studio.style}</span>}
              {brandStyle && <span style={{ color: "var(--starxi)" }}>, {brandStyle}</span>}
              {motionNote && <span style={{ color: "var(--accent-hi)" }}>, {motionNote}</span>}
              {cameraPhrase && <span style={{ color: "var(--accent-hi)" }}>, {cameraPhrase}</span>}
              {negative && <span style={{ color: "var(--bad-tx)" }}> — avoid: {negative}</span>}
            </div>
          )}

          <div className="hr" style={{ margin: "16px 0" }} />

          {/* DESTINATION */}
          <div className="row gap4 wrap">
            <div className="grow">
              <span className="field-label">Project</span>
              <input className="input" value={project} onChange={(e) => setProject(e.target.value)} />
            </div>
            <div className="grow">
              <span className="field-label">Label</span>
              <input className="input" placeholder="asset" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
        </Card>
      )}

      {spendOpen && est && budget && (
        <SpendTakeover
          estimate={est.usd}
          modelLabel={modelInfo?.label ?? model}
          spec={isVideo ? `${seconds}s · ${ratio}` : `×${numImages} · ${ratio}`}
          afterWeek={budget.spentWeekUsd + est.usd}
          weeklyCap={budget.settings.weeklyCapUsd}
          overCap={overCap}
          busy={busy}
          onCancel={() => setSpendOpen(false)}
          onConfirm={() => submit(true)}
        />
      )}

      {seqSpendOpen && est && budget && (
        <SpendTakeover
          estimate={seqTotalUsd}
          modelLabel={`${modelInfo?.label ?? model} · ${shots.length} shots`}
          spec={isVideo ? `${shots.length}×${seconds}s · ${ratio}` : `${shots.length}×${numImages} · ${ratio}`}
          afterWeek={budget.spentWeekUsd + seqTotalUsd}
          weeklyCap={budget.settings.weeklyCapUsd}
          overCap={seqOverCap}
          busy={seqBusy}
          onCancel={() => setSeqSpendOpen(false)}
          onConfirm={() => runSequence(true)}
        />
      )}
    </div>
  );
}
