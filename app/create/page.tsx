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
import { hueFor, money, usd, modelShort, relTime, isInFlight, glowVars, type ClientJob, type ClientJobAsset } from "../components/studio";

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

// Empty-composer starters — a non-expert operator gets a running start instead of a blank box.
const EXAMPLES: Record<"image" | "video", string[]> = {
  image: [
    "a studio render of a matte-black espresso machine on seamless white, soft key light",
    "editorial portrait, dramatic rim light, shallow depth of field",
    "isometric product hero, pastel palette, clean soft shadows",
  ],
  video: [
    "a cinematic dolly through neon-lit rain, reflections on wet asphalt",
    "slow orbit around a glass perfume bottle on a lit pedestal",
    "kinetic title reveal, bold type snapping into place",
  ],
};

// Camera/motion presets — first-class video direction, appended like house style.
const MOTION_PRESETS: { id: string; label: string; phrase: string }[] = [
  { id: "push", label: "Push-in", phrase: "slow push-in" },
  { id: "orbit", label: "Orbit", phrase: "smooth orbital camera move" },
  { id: "handheld", label: "Handheld", phrase: "handheld camera, subtle natural shake" },
  { id: "locked", label: "Locked-off", phrase: "locked-off static camera" },
  { id: "crash", label: "Crash zoom", phrase: "fast crash zoom" },
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

type RefKind = "image" | "video" | "audio";

// Slot a reference by its mime type so each model's per-type cap is enforced.
function refKind(a: { content_type: string | null }): RefKind {
  const ct = a.content_type ?? "";
  if (ct.startsWith("video")) return "video";
  if (ct.startsWith("audio")) return "audio";
  return "image";
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
interface RefAsset {
  id: number;
  blob_url: string;
  content_type: string | null;
  label: string;
  status?: string;
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
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  const [roleArt, setRoleArt] = useState<Record<string, string>>({});

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const styleSuffix = [employee?.studio?.style, brandStyle, motionNote, motionPhrase].filter(Boolean).join(", ");
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

        {error && <p className="err" style={{ marginTop: 12, textAlign: "center" }}>⚠️ {error}</p>}

        <ResultDock
          jobs={jobs}
          lastJobId={lastJobId}
          onIterate={iterateHere}
          onKeep={keepAsset}
          onAnimate={animateAsset}
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
    </div>
  );
}

/* ---------- result dock: live progress + the freshest render, inline ----------
   Closes the create→see→iterate loop — the render lands HERE with actions, so the
   operator never has to hop to the gallery to react to their own work. */
function ResultDock({
  jobs,
  lastJobId,
  onIterate,
  onKeep,
  onAnimate,
}: {
  jobs: ClientJob[];
  lastJobId: number | null;
  onIterate: () => void;
  onKeep: (assetId: number) => void;
  onAnimate: (asset: ClientJobAsset) => void;
}) {
  const live = jobs.filter((j) => isInFlight(j.status)).slice(0, 3);
  const RECENT_MS = 5 * 60_000;
  const now = Date.now();
  const done = jobs
    .filter((j) => j.status === "done" && j.assets.length > 0)
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime()
    );
  // Celebrate the render we just launched; otherwise the freshest one from the last few minutes.
  const result =
    done.find((j) => j.id === lastJobId) ??
    done.find((j) => j.completed_at && now - new Date(j.completed_at).getTime() < RECENT_MS) ??
    null;

  if (live.length === 0 && !result) return null;

  return (
    <div className="live-strip" style={{ marginTop: 16 }}>
      {live.map((j) => (
        <div key={j.id} className="live-row" style={glowVars(j.operator)}>
          <Media
            src={j.assets[0]?.blob_url}
            kind={j.assets[0]?.content_type}
            hueKey={j.operator}
            aspect="1 / 1"
            style={{ width: 52, flex: "none" }}
          />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row gap2" style={{ alignItems: "baseline" }}>
              <span className="t-xs mono muted">{modelShort(j.model)}</span>
              <span
                className="t-sm"
                style={{ color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
              >
                {j.prompt}
              </span>
            </div>
            <div style={{ marginTop: 7 }}>
              <JobProgress job={j} />
            </div>
          </div>
          <span className="t-xs muted mono" style={{ flex: "none" }}>live</span>
        </div>
      ))}

      {result && <ResultCard job={result} onIterate={onIterate} onKeep={onKeep} onAnimate={onAnimate} />}
    </div>
  );
}

function ResultCard({
  job,
  onIterate,
  onKeep,
  onAnimate,
}: {
  job: ClientJob;
  onIterate: () => void;
  onKeep: (assetId: number) => void;
  onAnimate: (asset: ClientJobAsset) => void;
}) {
  const asset = job.assets[0];
  const isVid = !!asset?.content_type?.startsWith("video");
  return (
    <div
      style={{
        ...glowVars(job.operator),
        display: "flex",
        flexDirection: "column",
        gap: 11,
        padding: 13,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--ok)",
        background: "var(--bg-1)",
        boxShadow: "0 18px 60px -22px color-mix(in srgb, var(--ok) 40%, transparent)",
      }}
    >
      <div className="row gap2" style={{ alignItems: "center" }}>
        <span className="pill ready"><span className="led" /> Ready</span>
        <span className="t-label" style={{ margin: 0 }}>Your render — landed here</span>
        <span className="grow" />
        <span className="t-xs muted mono">{relTime(job.completed_at ?? job.created_at)}</span>
      </div>
      <div className="row gap3" style={{ alignItems: "stretch" }}>
        <Media
          src={asset?.blob_url}
          kind={asset?.content_type}
          hueKey={job.operator}
          aspect={isVid ? "9 / 16" : "1 / 1"}
          style={{ width: 124, flex: "none" }}
        />
        <div className="grow col gap2" style={{ minWidth: 0 }}>
          <span
            className="t-sm"
            style={{ color: "var(--tx-1)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {job.prompt}
          </span>
          <span className="t-xs mono muted">
            {modelShort(job.model)} · {usd(Number(job.est_usd))}
            {job.assets.length > 1 ? ` · ${job.assets.length} renders` : ""}
          </span>
          <div className="grow" />
          <div className="row gap2 wrap">
            <Btn variant="primary" size="sm" onClick={onIterate}>
              <Icon name="refresh" size={14} /> Iterate
            </Btn>
            <Btn size="sm" onClick={() => asset && onAnimate(asset)} title="Attach this still and bridge to video">
              <Icon name="film" size={14} /> Animate next shot
            </Btn>
            <Btn size="sm" onClick={() => asset && onKeep(asset.id)}>
              <Icon name="check" size={14} /> Keep
            </Btn>
            <a className="btn btn-sm" href={asset?.blob_url} target="_blank" rel="noreferrer" aria-label="Download render">
              <Icon name="download" size={14} />
            </a>
            <Link className="btn btn-ghost btn-sm" href="/gallery">
              <Icon name="gallery" size={13} /> Open gallery
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- shape control: per-model duration (range / discrete) or image count ---------- */
function ShapeControl({
  modelInfo,
  isVideo,
  seconds,
  numImages,
  onSeconds,
  onNumImages,
}: {
  modelInfo: ModelInfo | undefined;
  isVideo: boolean;
  seconds: number;
  numImages: number;
  onSeconds: (n: number) => void;
  onNumImages: (n: number) => void;
}) {
  if (!isVideo) {
    const { min, max } = modelInfo?.numImages ?? { min: 1, max: 4 };
    if (max <= min) return null; // single-output models have nothing to choose
    return (
      <div className="dock-ctl">
        <span>Count</span>
        <input className="rng" type="range" min={min} max={max} value={numImages} onChange={(e) => onNumImages(Number(e.target.value))} />
        <span className="val">{numImages}×</span>
      </div>
    );
  }
  const d = modelInfo?.durations ?? { mode: "range" as const, min: 1, max: 15 };
  if (d.mode === "discrete" && d.values?.length) {
    return (
      <div className="dock-ctl">
        <span>Length</span>
        <Seg options={d.values.map((v) => ({ value: String(v), label: `${v}s` }))} value={String(seconds)} onChange={(v) => onSeconds(Number(v))} />
      </div>
    );
  }
  return (
    <div className="dock-ctl">
      <span>Length</span>
      <input className="rng" type="range" min={d.min ?? 1} max={d.max ?? 15} value={seconds} onChange={(e) => onSeconds(Number(e.target.value))} />
      <span className="val">{seconds}s</span>
    </div>
  );
}

/* ---------- reference dock: upload + gallery, per-type slots, surfaced in the composer ---------- */
function ReferenceDock({
  selected,
  pool,
  refIds,
  caps,
  accept,
  required,
  missing,
  refMedia,
  uploading,
  open,
  fileInputRef,
  onToggleOpen,
  onUpload,
  onToggleRef,
}: {
  selected: RefAsset[];
  pool: RefAsset[];
  refIds: number[];
  caps: Record<RefKind, number>;
  accept: string;
  required: boolean;
  missing: boolean;
  refMedia?: ModelInfo["refMedia"];
  uploading: boolean;
  open: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleOpen: () => void;
  onUpload: (files: FileList | File[]) => void;
  onToggleRef: (a: RefAsset) => void;
}) {
  const counts: Record<RefKind, number> = {
    image: selected.filter((a) => refKind(a) === "image").length,
    video: selected.filter((a) => refKind(a) === "video").length,
    audio: selected.filter((a) => refKind(a) === "audio").length,
  };
  const acceptsVideo = caps.video > 0;
  const acceptsAudio = caps.audio > 0;
  const KINDS: { k: RefKind; label: string }[] = [
    { k: "image", label: "img" },
    { k: "video", label: "vid" },
    { k: "audio", label: "aud" },
  ];
  const supported = KINDS.filter(({ k }) => caps[k] > 0);
  const allFull = supported.every(({ k }) => counts[k] >= caps[k]);
  // Per-type counter, e.g. "2/9 img · 1/3 vid · 0/3 aud".
  const capLabel = supported.map(({ k, label }) => `${counts[k]}/${caps[k]} ${label}`).join(" · ");

  // Per-type @handles so they line up with the prompt's @Image1 / @Video1 / @Audio1.
  const handles: string[] = [];
  const ci: Record<RefKind, number> = { image: 0, video: 0, audio: 0 };
  for (const a of selected) {
    const k = refKind(a);
    ci[k]++;
    handles.push(`@${k === "video" ? "Vid" : k === "audio" ? "Aud" : "Img"}${ci[k]}`);
  }

  // Only surface assets of a type this model accepts.
  const pickable = pool.filter((a) => caps[refKind(a)] > 0);
  const headerIcon = acceptsVideo ? "film" : acceptsAudio ? "bolt" : "image";

  // Compact limits hint, e.g. "≤20MB img · ≤50MB/10s vid · ≤20MB/30s aud".
  const limitHint = refMedia
    ? supported
        .map(({ k, label }) =>
          k === "image"
            ? `≤${refMedia.maxImageMB}MB ${label}`
            : k === "video"
              ? `≤${refMedia.maxVideoMB}MB/${refMedia.maxVideoSec}s ${label}`
              : `≤${refMedia.maxAudioMB}MB/${refMedia.maxAudioSec}s ${label}`
        )
        .join(" · ")
    : "";

  return (
    <div className="ref-dock">
      <div className="ref-dock-bar">
        <span className="t-label" style={{ margin: 0 }}>
          <Icon name={headerIcon} size={12} /> References {capLabel}
          {required && (
            <span style={{ color: missing ? "var(--warn-tx)" : "var(--tx-3)" }}>
              {" · "}
              {missing ? "needs a reference" : "locked in"}
            </span>
          )}
        </span>
        <div className="grow" />
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) onUpload(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="chip"
          disabled={uploading || allFull}
          onClick={() => fileInputRef.current?.click()}
          title={allFull ? "Reference slots full" : "Upload from your computer"}
        >
          <Icon name="download" size={13} style={{ transform: "rotate(180deg)" }} />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <button type="button" className={`chip ${open ? "on" : ""}`} onClick={onToggleOpen} title="Pick from the gallery">
          <Icon name="gallery" size={13} /> Gallery
        </button>
      </div>

      {limitHint && (
        <span className="t-xs muted" style={{ marginTop: 4 }}>{limitHint}</span>
      )}

      {selected.length > 0 && (
        <div className="ref-strip">
          {selected.map((a, i) => (
            <div key={a.id} className="ref-thumb">
              <Media
                src={a.blob_url}
                kind={a.content_type}
                hueKey={a.id}
                label={handles[i]}
                style={{ width: 64, flex: "none" }}
              />
              <button type="button" className="ref-thumb-x" aria-label="Remove reference" onClick={() => onToggleRef(a)}>
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="ref-picker">
          {pickable.map((a) => {
            const k = refKind(a);
            const on = refIds.includes(a.id);
            const typeFull = counts[k] >= caps[k];
            return (
              <button
                type="button"
                key={a.id}
                className="ref-pick"
                disabled={!on && typeFull}
                style={{ opacity: !on && typeFull ? 0.4 : 1 }}
                title={!on && typeFull ? `Max ${caps[k]} ${k} references` : ""}
                onClick={() => onToggleRef(a)}
              >
                <Media
                  src={a.blob_url}
                  kind={a.content_type}
                  hueKey={a.id}
                  style={{ width: 64, outline: on ? "2px solid var(--accent)" : "none", outlineOffset: 1 }}
                />
              </button>
            );
          })}
          {pickable.length === 0 && <p className="t-sm muted" style={{ margin: 0 }}>No usable assets yet — upload one or generate first.</p>}
        </div>
      )}

      {open && !acceptsVideo && pool.some((a) => a.content_type?.startsWith("video")) && (
        <p className="t-xs muted" style={{ marginTop: 6 }}>This model takes image references only.</p>
      )}
    </div>
  );
}

/* ---------- model popover: quick-switch top models without opening the full panel ---------- */
function ModelPopover({
  models,
  value,
  onChange,
  onMore,
  isVideo,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  onMore: () => void;
  isVideo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = models.find((m) => m.id === value);
  // Quick list: the pinned top models for whichever mode we're in.
  const quick = models.filter((m) => m.featured && (m.unit === "video_second") === isVideo);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="brandpick" ref={ref} style={{ position: "relative" }}>
      <button type="button" className={`chip ${open ? "on" : ""}`} onClick={() => setOpen((v) => !v)} title="Switch model">
        <Icon name={isVideo ? "video" : "image"} size={13} /> {cur?.label ?? value}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="brandpick-pop" style={{ minWidth: 248, left: 0, right: "auto" }}>
          {quick.map((m) => (
            <button key={m.id} className={`brandpick-row ${value === m.id ? "on" : ""}`} onClick={() => pick(m.id)}>
              <span className="grow">{m.label}</span>
              <span className="t-xs mono muted">${m.usd}/{m.unit === "image" ? "img" : "s"}</span>
              {value === m.id && <Icon name="check" size={13} />}
            </button>
          ))}
          <button
            className="brandpick-foot"
            onClick={() => {
              onMore();
              setOpen(false);
            }}
          >
            <Icon name="settings" size={13} /> All models &amp; options
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- brand picker: project → sub-brand, where Generate used to sit ---------- */
function BrandPicker({
  brands,
  value,
  onChange,
}: {
  brands: BrandProfile[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tops = topLevelBrands(brands);
  const selected = brands.find((b) => b.id === value);
  const active = !!selected && value !== "none";
  const swatch = selected?.palette?.[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="brandpick" ref={ref}>
      <button type="button" className={`brandpick-btn ${active ? "on" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span className="brandpick-dot" style={{ background: swatch ?? "transparent", borderColor: swatch ? "transparent" : "var(--line-2)" }} />
        <span className="brandpick-label">
          <span className="t-xs muted">Brand</span>
          <span className="brandpick-name">{active ? brandPath(brands, value) : "No brand"}</span>
        </span>
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="brandpick-pop">
          <button className={`brandpick-row ${value === "none" ? "on" : ""}`} onClick={() => pick("none")}>
            <span className="brandpick-dot" style={{ borderColor: "var(--line-2)" }} />
            <span className="grow">No brand</span>
            {value === "none" && <Icon name="check" size={13} />}
          </button>
          {tops.map((b) => {
            const subs = subBrandsOf(brands, b.id);
            return (
              <div key={b.id} className="brandpick-group">
                <button className={`brandpick-row ${value === b.id ? "on" : ""}`} onClick={() => pick(b.id)}>
                  <span className="brandpick-swatches">
                    {(b.palette ?? []).slice(0, 4).map((c, i) => (
                      <span key={i} style={{ background: c }} />
                    ))}
                  </span>
                  <span className="grow">{b.label}</span>
                  {b.tagline && <span className="brandpick-tag t-xs">{b.tagline}</span>}
                  {value === b.id && <Icon name="check" size={13} />}
                </button>
                {subs.map((s) => (
                  <button key={s.id} className={`brandpick-row sub ${value === s.id ? "on" : ""}`} onClick={() => pick(s.id)}>
                    <span className="brandpick-swatches sm">
                      {(s.palette ?? []).slice(0, 3).map((c, i) => (
                        <span key={i} style={{ background: c }} />
                      ))}
                    </span>
                    <span className="grow">{s.label}</span>
                    {value === s.id && <Icon name="check" size={13} />}
                  </button>
                ))}
              </div>
            );
          })}
          <Link className="brandpick-foot" href="/brands">
            <Icon name="create" size={13} /> Manage brands
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------- hold-to-commit spend takeover ---------- */
function SpendTakeover({
  estimate,
  modelLabel,
  spec,
  afterWeek,
  weeklyCap,
  overCap,
  busy,
  onCancel,
  onConfirm,
}: {
  estimate: number;
  modelLabel: string;
  spec: string;
  afterWeek: number;
  weeklyCap: number;
  overCap: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const stop = useCallback(() => {
    setHolding(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!doneRef.current && fillRef.current) fillRef.current.style.width = "0%";
  }, []);

  const start = useCallback(() => {
    if (busy || overCap || doneRef.current) return;
    setHolding(true);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startRef.current) / 900, 1);
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`;
      if (p >= 1) {
        doneRef.current = true;
        onConfirm();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [busy, overCap, onConfirm]);

  return (
    <div className="spend-overlay">
      <div className="spend-dim" onClick={onCancel} />
      <div className="spend-card">
        <span className="spend-label">Spend confirmation · over the gate</span>
        <span className="spend-amount mono">{money(estimate)}</span>
        <div className="meta-rows mono t-sm">
          <div className="meta-row">
            <span className="k">Model</span>
            <span>{modelLabel}</span>
          </div>
          <div className="meta-row">
            <span className="k">Output</span>
            <span>{spec}</span>
          </div>
          <div className="meta-row">
            <span className="k">Budget after</span>
            <span>
              {usd(afterWeek)} / {usd(weeklyCap)}
            </span>
          </div>
        </div>
        <FuelGauge spent={afterWeek - estimate} cap={weeklyCap} projected={estimate} />
        {overCap ? (
          <p className="err">⚠️ This exceeds this week&apos;s remaining budget. Raise the cap in Settings or wait for next week.</p>
        ) : (
          <button
            className="hold-btn"
            disabled={busy}
            aria-keyshortcuts="Space"
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={stop}
            onKeyDown={(e) => {
              // Keyboard path: hold Space / Enter to commit, mirroring the pointer hold.
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                start();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                stop();
              }
            }}
          >
            <span className="hold-fill" ref={fillRef} />
            <span className="hold-label">
              <Icon name="shield" size={16} /> {busy ? "Sending…" : holding ? "Keep holding…" : `Hold to commit ${money(estimate)}`}
            </span>
          </button>
        )}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "center" }} onClick={onCancel}>
          Back off · esc
        </button>
      </div>
    </div>
  );
}
