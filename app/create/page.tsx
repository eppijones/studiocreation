"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { estimate, listModels, defaultSeconds, coerceSeconds } from "@/lib/pricing";
import { resolveBrandStyle, brandPath, type BrandProfile } from "@/lib/brandTypes";
import { useStudio } from "../components/AppShell";
import { Card, Btn, CountUp, FuelGauge, Seg, Switch, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { ensureNotifyPermission } from "../components/notify";
import { hueFor, money, usd, cancelJob, type ClientJobAsset } from "../components/studio";
import {
  MOTION_PRESETS,
  FRAMING_OPTIONS,
  LIGHT_OPTIONS,
  depthStop,
  cameraPhrase,
  cameraCount,
  cameraBadge,
  sameRecipe,
  CAMERA_LOOKS,
  SWEEP_AXES,
} from "./constants";
import { type RefAsset, type RefKind, type CameraRecipe, type CameraAxis, refKind } from "./types";
import { ResultDock, ShapeControl, ReferenceDock, ModelPopover, VariantSwitch, BrandPicker, SpendTakeover } from "./components";
import { TrimModal } from "./TrimModal";
import { buildFamilies, familyKey, variantOf, variantSummary, type ModelFamily } from "./models";

// All models (incl. finishing) so role presets like Upscaler resolve; the
// composer router renders every non-finishing fal model (finishing runs from /deliver).
const MODELS = listModels();
const modelLabelFor = (id: string | undefined) => MODELS.find((m) => m.id === id)?.label ?? id ?? "";

// Capability tags aggregated across a family's variants (no price — cost lives only
// on the Generate field). Variant range is shown separately as "Text · Image · Refs".
function familyTags(f: ModelFamily): string[] {
  const t: string[] = [];
  if (f.members.some((m) => m.hasAudio)) t.push("audio");
  if (f.members.some((m) => m.hasFast)) t.push("fast");
  if (f.members.some((m) => m.has4k)) t.push("4K");
  return t;
}

function FamilyCard({ family, currentId, onPick }: { family: ModelFamily; currentId: string; onPick: (id: string) => void }) {
  const on = familyKey(currentId) === family.key;
  const tags = familyTags(family);
  const pick = () => {
    // Keep the active variant if this family offers it, else land on its base.
    const want = variantOf(MODELS.find((m) => m.id === currentId) ?? family.base);
    const match = family.members.find((m) => variantOf(m) === want) ?? family.base;
    onPick(match.id);
  };
  return (
    <button
      className={`chip model-chip ${on ? "on" : ""}`}
      style={{ height: "auto", padding: "8px 12px", flexDirection: "column", alignItems: "flex-start", gap: 4 }}
      onClick={pick}
      title={family.base.notes || family.key}
    >
      <span style={{ fontWeight: 700 }}>{family.label}</span>
      {(family.members.length > 1 || tags.length > 0) && (
        <span className="row gap2" style={{ alignItems: "center" }}>
          {family.members.length > 1 && <span className="model-variants">{variantSummary(family)}</span>}
          {tags.map((t) => (
            <span key={t} className="model-tag">{t}</span>
          ))}
        </span>
      )}
    </button>
  );
}

// Per-mode default model + ratio so the Image/Video tabs route instantly.
const MODE_DEFAULTS: Record<"image" | "video", { model: string; ratio: string }> = {
  image: { model: "openai/gpt-image-2", ratio: "1:1" },
  video: { model: "bytedance/seedance-2.0/text-to-video", ratio: "9:16" },
};


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

// A camera Look's face: a curated still at /looks/<id>.{webp,jpg} → (null, the
// hue-keyed mesh shows through). Same fallback discipline as RoleArt, so a Look
// tile is a coloured mesh until its still is generated — never a broken image.
function LookArt({ id }: { id: string }) {
  const chain = useMemo(() => [`/looks/${id}.webp`, `/looks/${id}.jpg`], [id]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [id]);
  const src = chain[idx];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="look-photo" src={src} alt="" loading="lazy" onError={() => setIdx((i) => i + 1)} />
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

// useSearchParams needs a Suspense boundary; the composer reads the deep-link
// seed (?prompt / ?role / …) from it so a Home→Create hand-off survives.
export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateComposer />
    </Suspense>
  );
}

function CreateComposer() {
  const { budget, refresh, jobs } = useStudio();
  const toast = useToast();
  const searchParams = useSearchParams();

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
  // An over-limit video the operator can trim down to a fitting reference.
  const [trimFile, setTrimFile] = useState<File | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [motion, setMotion] = useState("");
  const [camera, setCamera] = useState<CameraRecipe>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  // One-variable re-roll: sweep a single camera axis, hold everything else.
  const [sweepAxis, setSweepAxis] = useState<CameraAxis | null>(null);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [sweepSpendOpen, setSweepSpendOpen] = useState(false);
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  const [roleArt, setRoleArt] = useState<Record<string, string>>({});
  // Sequence (opt-in): a film built shot by shot. Shots share role/brand/model/refs.
  const [seqOpen, setSeqOpen] = useState(false);
  const [shots, setShots] = useState<{ id: number; prompt: string; motion: string; camera: CameraRecipe }[]>([]);
  const [seqName, setSeqName] = useState("sequence");
  const [seqBusy, setSeqBusy] = useState(false);
  const [seqSpendOpen, setSeqSpendOpen] = useState(false);
  // Brand-DNA lens lock: every shot inherits the composer's current depth + light
  // (lens character), framing stays per-shot — so a sequence holds one look.
  const [seqLockLens, setSeqLockLens] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleParamRef = useRef(false);
  // Deep-link params captured ONCE at first render, before any effect clears the
  // URL. The role effect (gated on employees), the deep-link effect, and the
  // StrictMode re-run of the hydrate effect all read this stable snapshot — so a
  // handed-off ?role / ?prompt can't be lost to the URL clear or stomped by the
  // localStorage hydration re-running. This is what makes the Home→Create
  // hand-off deterministic.
  const seedRef = useRef<{ prompt: string | null; mode: string | null; role: string | null; refId: number; iterId: number } | null>(null);
  if (seedRef.current === null) {
    seedRef.current = {
      prompt: searchParams.get("prompt"),
      mode: searchParams.get("mode"),
      role: searchParams.get("role"),
      refId: Number(searchParams.get("ref")) || 0,
      iterId: Number(searchParams.get("iterate")) || 0,
    };
  }
  const shotIdRef = useRef(1);

  const modelInfo = MODELS.find((m) => m.id === model);
  const isVideo = modelInfo?.unit === "video_second";
  const mode: "image" | "video" = isVideo ? "video" : "image";
  // Seed support lets a one-variable re-roll hold an identical base; without it,
  // the sweep still runs but the base image drifts too (explore mode).
  const hasSeed = !!modelInfo?.hasSeed;
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
  // The router lists model FAMILIES, not every variant — one card per model, swap
  // the variant inline. Search matches a family's name or any of its members.
  const families = buildFamilies(catalog);
  const familyMatches = modelQ
    ? families.filter(
        (f) =>
          f.label.toLowerCase().includes(modelQ) ||
          f.members.some(
            (m) =>
              m.label.toLowerCase().includes(modelQ) ||
              m.id.toLowerCase().includes(modelQ) ||
              m.category.includes(modelQ) ||
              m.kind.includes(modelQ)
          )
      )
    : families;

  const est = useMemo(() => {
    try {
      return estimate({
        provider: "fal",
        // Video bills per second; N clips = N × seconds of footage. Images batch
        // into one call, so count is just the image count.
        count: isVideo ? seconds * numImages : numImages,
        model,
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
  // Camera direction (framing / depth / light) compiled to prompt language.
  const camPhrase = cameraPhrase(camera);
  const camCount = cameraCount(camera);
  const styleSuffix = [employee?.studio?.style, brandStyle, motionNote, motionPhrase, camPhrase]
    .filter(Boolean)
    .join(", ");
  // Conflict guard: if the typed prompt already speaks to an axis, flag it so we
  // don't quietly double-stack contradictory direction (reuses the enhance cues).
  const promptLc = prompt.toLowerCase();
  const promptHasFraming = /close.?up|wide|medium shot|macro|establishing|portrait|landscape|aerial|overhead/.test(promptLc);
  const promptHasDepth = /bokeh|depth of field|shallow|deep focus|\d{2,3}\s?mm|f\/\d|aperture|\blens\b/.test(promptLc);
  const promptHasLight = /golden|neon|noir|backlit|rim light|chiaroscuro|lighting|\blit\b|sunset|dusk|dawn/.test(promptLc);
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
    const roleId = seedRef.current?.role ?? null;
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
    // A deep-link seed (?prompt / ?mode / ?role / ?iterate / ?ref) always wins over
    // the resumed session, so the localStorage restore skips any field the seed owns.
    const seed = seedRef.current;
    const promptSeed = !!seed && (seed.prompt != null || seed.iterId > 0);
    const modelSeed = !!seed && (!!seed.mode || !!seed.role || seed.iterId > 0 || seed.refId > 0);
    const roleSeed = !!seed && (!!seed.role || !!seed.mode);
    const ratioSeed = !!seed && (!!seed.mode || !!seed.role);
    const secondsSeed = !!seed && !!seed.role;
    try {
      const raw = localStorage.getItem("sc.create");
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.prompt === "string" && !promptSeed) setPrompt(s.prompt);
        if (typeof s.model === "string" && MODELS.some((m) => m.id === s.model) && !modelSeed) setModel(s.model);
        if (typeof s.employeeId === "string" && !roleSeed) setEmployeeId(s.employeeId);
        if (typeof s.brandId === "string") setBrandId(s.brandId);
        if (typeof s.ratio === "string" && !ratioSeed) setRatio(s.ratio);
        if (Number.isFinite(s.numImages)) setNumImages(s.numImages);
        if (Number.isFinite(s.seconds) && !secondsSeed) setSeconds(s.seconds);
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
    // Read the snapshot captured at first render — robust to the URL being
    // cleared below and to StrictMode re-running this effect.
    const seed = seedRef.current;
    const refId = seed?.refId ?? 0;
    const iterId = seed?.iterId ?? 0;
    const seedPrompt = seed?.prompt ?? null;
    const seedMode = seed?.mode ?? null;
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
  // Merge freshly-created reference assets into the pool and auto-select them while
  // honouring each type's remaining room. Shared by upload and trim.
  const addRefAssets = useCallback(
    (added: RefAsset[]) => {
      if (added.length === 0) return;
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refCaps.image, refCaps.video, refCaps.audio, refPool]
  );

  const onUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0 || !supportsRefs || !modelInfo) return;
      const limits = modelInfo.refMedia;
      const typeName = ([refCaps.image && "image", refCaps.video && "video", refCaps.audio && "audio"] as const)
        .filter(Boolean)
        .join(" / ");

      const valid: File[] = [];
      let trimVideo: File | null = null; // first over-limit video → offer the trimmer
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
        const overSize = f.size > mb * 1024 * 1024;
        if (k === "video") {
          const sec = await probeDuration(f).catch(() => 0);
          const overLen = sec > limits.maxVideoSec + 0.5;
          if (overSize || overLen) {
            // Don't reject — let them keep a fitting section instead.
            if (!trimVideo) trimVideo = f;
            else toast({ kind: "info", title: "One clip at a time", sub: `${f.name} also needs trimming — do this one first` });
            continue;
          }
        } else if (overSize) {
          toast({ kind: "bad", title: "Too large", sub: `${f.name} exceeds ${mb}MB for ${k} references` });
          continue;
        } else if (k === "audio") {
          const sec = await probeDuration(f).catch(() => 0);
          if (sec > limits.maxAudioSec + 0.5) {
            toast({ kind: "bad", title: "Too long", sub: `${f.name} is ${Math.round(sec)}s — audio references cap at ${limits.maxAudioSec}s` });
            continue;
          }
        }
        valid.push(f);
      }

      if (valid.length > 0) {
        setUploading(true);
        try {
          const fd = new FormData();
          valid.forEach((f) => fd.append("files", f));
          fd.append("model", model);
          const res = await fetch("/api/uploads", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");
          const added = (data.assets ?? []) as RefAsset[];
          addRefAssets(added);
          toast({ kind: "ok", title: "Reference added", sub: `${added.length} file${added.length > 1 ? "s" : ""} ready` });
        } catch (err) {
          toast({ kind: "bad", title: "Upload failed", sub: err instanceof Error ? err.message : "Try again" });
        } finally {
          setUploading(false);
        }
      }

      if (trimVideo) setTrimFile(trimVideo);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supportsRefs, model, modelInfo, refCaps.image, refCaps.video, refCaps.audio, addRefAssets, toast]
  );

  const overThreshold = !!(est && budget && est.usd > budget.settings.confirmThresholdUsd);
  const projectedRatio = budget && est ? (budget.spentWeekUsd + est.usd) / budget.settings.weeklyCapUsd : 0;
  const overCap = !!(est && budget && est.usd > budget.remainingWeekUsd);

  const submit = useCallback(
    async (confirmed: boolean) => {
      if (!est || !budget) return;
      setBusy(true);
      setError(null);
      const fullPrompt = styleSuffix ? `${prompt.trim()}, ${styleSuffix}` : prompt.trim();
      // Video renders one clip per call, so N clips = N calls; images batch N
      // into a single call (one job, an N-up set on the wall).
      const reps = isVideo ? numImages : 1;
      const baseLabel = label || (employee ? employee.id : "asset");
      let fired = 0;
      let lastId: number | null = null;
      try {
        for (let i = 0; i < reps; i++) {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: fullPrompt,
              model,
              numImages: isVideo ? 1 : numImages,
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
              label: reps > 1 ? `${baseLabel}-${i + 1}` : baseLabel,
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
            if (data.error === "weekly_cap_exceeded")
              throw new Error(
                fired > 0
                  ? `Weekly cap reached after ${fired} clip${fired === 1 ? "" : "s"} — raise it in Settings or finish the rest next week.`
                  : `Weekly cap reached ($${data.budget?.settings.weeklyCapUsd}). Finance can raise it in Settings.`
              );
            if (data.error === "monthly_pool_exceeded") throw new Error(`Monthly team pool exhausted ($${data.budget?.settings.monthlyPoolUsd}).`);
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          if (typeof data.jobId === "number") lastId = data.jobId;
          fired++;
        }
        setSpendOpen(false);
        if (lastId != null) setLastJobId(lastId);
        // Keep the prompt — one-variable iteration IS the loop; tweak and fire again.
        ensureNotifyPermission();
        toast({
          kind: "ok",
          title: reps > 1 ? `${fired} on the line` : "On the line",
          sub: `${money(est.usd)} · watch ${reps > 1 ? "them" : "it"} land below`,
        });
        refresh();
      } catch (err) {
        if (fired > 0) refresh();
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [est, budget, styleSuffix, prompt, model, numImages, seconds, ratio, audio, fast, tier4k, quality, negative, refImageUrls, refVideoUrls, refAudioUrls, project, label, employee, employeeId, modelInfo, isVideo]
  );

  // ---- One-variable re-roll: fire one render per value of a single camera axis,
  // holding the prompt + every other setting. When the model has a seed we lock
  // an identical base across the sweep so ONLY the chosen axis changes; otherwise
  // each render also gets the model's natural variation (explore mode). ----
  const sweepValues = useMemo(
    () => (sweepAxis ? SWEEP_AXES.find((s) => s.axis === sweepAxis)?.values ?? [] : []),
    [sweepAxis]
  );
  // Sweep is image-only; video iterates via the Fast lane, not a base lock.
  const sweeping = !!sweepAxis && !isVideo;
  // One image per axis value, so cost is per-image (est.unitUsd), not the ×N batch.
  const sweepTotalUsd = (est?.unitUsd ?? 0) * sweepValues.length;
  const sweepOverThreshold = !!(budget && sweepTotalUsd > budget.settings.confirmThresholdUsd);
  const sweepOverCap = !!(budget && sweepTotalUsd > budget.remainingWeekUsd);

  const runSweep = useCallback(
    async (confirmed: boolean) => {
      if (!est || !budget || !sweepAxis || sweepValues.length === 0 || sweepBusy) return;
      if (!confirmed && sweepTotalUsd > budget.settings.confirmThresholdUsd) {
        setSweepSpendOpen(true);
        return;
      }
      setSweepBusy(true);
      setError(null);
      // Lock one base seed for the whole sweep (only honoured by hasSeed models).
      const baseSeed = Math.floor(Math.random() * 2147483647);
      const axisLabel = SWEEP_AXES.find((s) => s.axis === sweepAxis)?.label ?? sweepAxis;
      let fired = 0;
      let lastId: number | null = null;
      try {
        for (const value of sweepValues) {
          const recipe: CameraRecipe = { ...camera, [sweepAxis]: value };
          const camPh = cameraPhrase(recipe);
          const suffix = [employee?.studio?.style, brandStyle, camPh].filter(Boolean).join(", ");
          const fullPrompt = suffix ? `${prompt.trim()}, ${suffix}` : prompt.trim();
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: fullPrompt,
              model,
              numImages: 1,
              ratio,
              tier: tier4k ? "4k" : undefined,
              quality: modelInfo?.qualities.length ? quality : undefined,
              negativePrompt: modelInfo?.hasNegative ? negative || undefined : undefined,
              refImageUrls,
              project,
              label: `${sweepAxis}-${value}`,
              role: employeeId || undefined,
              seed: hasSeed ? baseSeed : undefined,
              confirmed: true,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            if (data.error === "weekly_cap_exceeded")
              throw new Error(`Weekly cap reached after ${fired} variant${fired === 1 ? "" : "s"} — raise it in Settings.`);
            if (data.error === "monthly_pool_exceeded")
              throw new Error(`Monthly team pool exhausted after ${fired} variant${fired === 1 ? "" : "s"}.`);
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          if (typeof data.jobId === "number") lastId = data.jobId;
          fired++;
        }
        setSweepSpendOpen(false);
        if (lastId != null) setLastJobId(lastId);
        ensureNotifyPermission();
        toast({
          kind: "ok",
          title: `${fired} ${axisLabel.toLowerCase()} variants on the line`,
          sub: `${money(sweepTotalUsd)} · ${hasSeed ? "locked base" : "explore"} · they land below`,
        });
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sweep failed");
      } finally {
        setSweepBusy(false);
      }
    },
    [est, budget, sweepAxis, sweepValues, sweepBusy, sweepTotalUsd, camera, employee, brandStyle, prompt, model, ratio, tier4k, quality, negative, refImageUrls, project, employeeId, hasSeed, modelInfo, toast, refresh]
  );

  function onGenerate() {
    if (sweepAxis && !isVideo) {
      runSweep(false);
      return;
    }
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
      // Heuristic = the local fallback (no ANTHROPIC_API_KEY); be honest about it
      // and point at the real AI rewrite rather than pretending it's a model pass.
      const heuristic = data.engine === "heuristic";
      if (data.changed) {
        setPrompt(data.enhanced);
        toast({
          kind: "ok",
          title: heuristic ? "Prompt expanded" : "Prompt rewritten by Claude",
          sub: heuristic ? "Local pass · set ANTHROPIC_API_KEY for an AI rewrite" : (data.added ?? []).join(" · ") || "Tightened for this model",
        });
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
    // Keep motion AND camera after adding — lens continuity across shots is the
    // default; the operator changes one thing for the next shot (one-variable).
    setShots((prev) => [...prev, { id: shotIdRef.current++, prompt: p, motion, camera }]);
    setPrompt("");
    promptRef.current?.focus();
  }, [prompt, motion, camera]);

  const editShot = useCallback(
    (id: number) => {
      const s = shots.find((x) => x.id === id);
      if (!s) return;
      setPrompt(s.prompt);
      setMotion(s.motion);
      setCamera(s.camera ?? {});
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
          // Lens lock: every shot inherits the composer's current depth + light
          // (lens character), keeping its own framing — so the sequence holds one look.
          const shotCam = seqLockLens ? { ...shot.camera, depth: camera.depth, light: camera.light } : shot.camera;
          const camPh = cameraPhrase(shotCam);
          const suffix = [employee?.studio?.style, brandStyle, motionNote, motionPh, camPh].filter(Boolean).join(", ");
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
    [est, budget, shots, seqBusy, seqName, isVideo, employee, brandStyle, motionNote, seqLockLens, camera, model, numImages, seconds, ratio, audio, fast, tier4k, quality, negative, refImageUrls, refVideoUrls, refAudioUrls, modelInfo, toast, refresh, seqTotalUsd]
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
              aria-label="Standard — the base model, no role"
            >
              <div className="role-ico"><Icon name="wand" size={20} /></div>
              <span className="ff-label">Standard</span>
              {!employeeId && <span className="role-check"><Icon name="check" size={13} /></span>}
              <div className="role-pop" role="tooltip">
                <div className="role-pop-hd">Standard</div>
                <div className="role-pop-style muted">The house standard model, prompt sent as written. Add a brand or role to shift the look.</div>
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
              className={`chip ${cameraOpen || camCount > 0 || (isVideo && motion) ? "on" : ""}`}
              onClick={() => setCameraOpen((v) => !v)}
              title={isVideo ? "Direct the shot — looks, framing, depth, light and motion" : "Direct the frame — looks, framing, depth and light"}
            >
              <Icon name="film" size={13} /> {isVideo ? "Camera & motion" : "Camera"}
              {camCount + (isVideo && motion ? 1 : 0) > 0 ? ` · ${camCount + (isVideo && motion ? 1 : 0)}` : ""}
            </button>
          </div>
          {/* CAMERA RACK — a director's intent surface (Looks + framing + a depth
              dial + light), not a gear spec-sheet. Compiles to prompt language. */}
          {cameraOpen && (
            <div className="col gap3" style={{ marginTop: 10 }}>
              {/* LOOKS — one-tap coherent recipes, shown as image tiles (the
                  studio's curated still per look → hue-keyed mesh fallback). */}
              <div className="row gap2" style={{ alignItems: "flex-start" }}>
                <div style={{ width: 52, flex: "none", paddingTop: 2 }}>
                  <span className="t-xs muted">Looks</span>
                  {camCount > 0 && (
                    <button
                      type="button"
                      className="t-xs"
                      title="Clear all camera direction"
                      style={{ display: "block", marginTop: 6, background: "none", border: "none", padding: 0, color: "var(--accent-hi)", cursor: "pointer" }}
                      onClick={() => setCamera({})}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="look-row">
                  {CAMERA_LOOKS.map((lk) => {
                    const on = sameRecipe(camera, lk.recipe);
                    return (
                      <button
                        key={lk.id}
                        type="button"
                        className={`look-tile ${on ? "on" : ""}`}
                        title="Set a complete, coherent look in one tap — then tweak any axis"
                        onClick={() => {
                          setCamera(on ? {} : lk.recipe);
                          if (isVideo && lk.motion && !on) setMotion(lk.motion);
                        }}
                      >
                        <span className="look-bg" style={{ background: roleMesh(hueFor(lk.id)) }} />
                        <LookArt id={lk.id} />
                        <span className="look-scrim" />
                        <span className="look-name">{lk.label}</span>
                        {on && (
                          <span className="look-check">
                            <Icon name="check" size={11} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FRAMING */}
              <div className="row gap2 wrap" style={{ alignItems: "center" }}>
                <span className="t-xs muted" style={{ width: 52, flex: "none" }}>Frame</span>
                {FRAMING_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`chip ${camera.framing === o.id ? "on" : ""}`}
                    title={o.phrase}
                    onClick={() => setCamera((c) => ({ ...c, framing: c.framing === o.id ? undefined : o.id }))}
                  >
                    {o.label}
                  </button>
                ))}
                {promptHasFraming && (
                  <span className="t-xs muted" title="Your prompt already frames the shot — adding here may double up">· framed in prompt</span>
                )}
              </div>

              {/* DEPTH — one continuous deep↔shallow dial replacing focal+aperture */}
              <div className="row gap2 wrap" style={{ alignItems: "center" }}>
                <span className="t-xs muted" style={{ width: 52, flex: "none" }}>Depth</span>
                <button
                  type="button"
                  className={`chip ${camera.depth != null ? "on" : ""}`}
                  style={{ minWidth: 82 }}
                  title={camera.depth != null ? "Depth of field — tap to turn off" : "Add a depth-of-field direction"}
                  onClick={() => setCamera((c) => ({ ...c, depth: c.depth == null ? 50 : undefined }))}
                >
                  {camera.depth == null ? "Off" : depthStop(camera.depth).gear}
                </button>
                {camera.depth != null && (
                  <div className="row gap2" style={{ alignItems: "center", flex: 1, minWidth: 220, maxWidth: 380 }}>
                    <span className="t-xs muted" style={{ flex: "none" }}>Deep</span>
                    <input
                      className="rng"
                      type="range"
                      min={0}
                      max={100}
                      value={camera.depth}
                      aria-label="Depth of field — deep to shallow"
                      onChange={(e) => setCamera((c) => ({ ...c, depth: Number(e.target.value) }))}
                    />
                    <span className="t-xs muted" style={{ flex: "none" }}>Shallow</span>
                  </div>
                )}
                {promptHasDepth && (
                  <span className="t-xs muted" title="Your prompt already mentions a lens/aperture — adding here may double up">· lens in prompt</span>
                )}
              </div>

              {/* LIGHT */}
              <div className="row gap2 wrap" style={{ alignItems: "center" }}>
                <span className="t-xs muted" style={{ width: 52, flex: "none" }}>Light</span>
                {LIGHT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`chip ${camera.light === o.id ? "on" : ""}`}
                    title={o.phrase}
                    onClick={() => setCamera((c) => ({ ...c, light: c.light === o.id ? undefined : o.id }))}
                  >
                    {o.label}
                  </button>
                ))}
                {promptHasLight && (
                  <span className="t-xs muted" title="Your prompt already describes the light — adding here may double up">· lit in prompt</span>
                )}
              </div>

              {/* MOTION — video only; how the camera moves through the shot */}
              {isVideo && (
                <div className="row gap2 wrap" style={{ alignItems: "center" }}>
                  <span className="t-xs muted" style={{ width: 52, flex: "none" }}>Motion</span>
                  {MOTION_PRESETS.map((mp) => (
                    <button
                      key={mp.id}
                      type="button"
                      className={`chip ${motion === mp.id ? "on" : ""}`}
                      title={mp.phrase}
                      onClick={() => setMotion((c) => (c === mp.id ? "" : mp.id))}
                    >
                      <Icon name={mp.glyph} size={13} /> {mp.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ONE-VARIABLE RE-ROLL — sweep a single axis, hold everything else */}
              {!isVideo && (
                <div className="row gap2 wrap" style={{ alignItems: "center", borderTop: "1px solid var(--line-2)", paddingTop: 8 }}>
                  <span className="t-xs muted" style={{ width: 52, flex: "none" }} title="Fire one render per value of a single axis — your one-variable iteration, made a button">Vary</span>
                  {SWEEP_AXES.map((s) => (
                    <button
                      key={s.axis}
                      type="button"
                      className={`chip ${sweepAxis === s.axis ? "on" : ""}`}
                      title={`Render ${s.values.length} variants sweeping ${s.label.toLowerCase()}, holding prompt + every other setting`}
                      onClick={() => setSweepAxis((a) => (a === s.axis ? null : s.axis))}
                    >
                      {s.label} ×{s.values.length}
                    </button>
                  ))}
                  {sweepAxis && (
                    <span className="t-xs muted">
                      {hasSeed ? "· locked base — only this axis changes" : "· explore — base may also drift"}
                    </span>
                  )}
                </div>
              )}
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
              <VariantSwitch models={catalog} value={model} onChange={setModel} />
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
                <span className="amt">{est ? <CountUp value={sweeping ? sweepTotalUsd : est.usd} decimals={(sweeping ? sweepTotalUsd : est.usd) >= 1 ? 2 : 3} prefix="$" /> : "—"}</span>
                {sweeping ? (
                  <span className="t-xs muted">{sweepValues.length} variants · 1 axis</span>
                ) : budget ? (
                  <span className="t-xs muted">{usd(budget.remainingWeekUsd)} left this week</span>
                ) : null}
              </div>
              {/* Generate anchored to the lower-right corner of the box */}
              <Btn
                variant="primary"
                size="lg"
                disabled={(busy || sweepBusy) || !prompt.trim() || !est || (sweeping ? sweepOverCap : overCap) || missingRef}
                onClick={onGenerate}
                title={missingRef ? "Add a reference first" : sweeping ? `Render ${sweepValues.length} variants sweeping one axis` : `Generate (${mod}↵)`}
              >
                {busy || sweepBusy
                  ? "Queueing…"
                  : missingRef
                  ? "Needs a reference"
                  : sweeping
                  ? (sweepOverThreshold ? "Review spend" : `Render ${sweepValues.length} variants`)
                  : overThreshold
                  ? "Review spend"
                  : "Generate"}
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
            {employee ? `${employee.name} style auto-appended` : "Standard — base model, raw prompt"}
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
                    <div className="row gap1 wrap">
                      {cameraBadge(s.camera) && (
                        <span className="chip soft" style={{ height: 18 }} title="Camera direction for this shot">
                          {cameraBadge(s.camera)}
                        </span>
                      )}
                      {isVideo && s.motion && (
                        <span className="chip soft" style={{ height: 18 }}>
                          {MOTION_PRESETS.find((m) => m.id === s.motion)?.label}
                        </span>
                      )}
                    </div>
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
                <div className="row gap4 wrap" style={{ alignItems: "center" }}>
                  <label className="row gap2" style={{ alignItems: "center" }}>
                    <span className="t-xs muted">Sequence name</span>
                    <input className="input" value={seqName} onChange={(e) => setSeqName(e.target.value)} style={{ height: 30, width: 160, fontSize: 12.5 }} />
                  </label>
                  <label className="row gap2" style={{ alignItems: "center", cursor: "pointer" }} title="Hold the composer's current depth + light across every shot (brand-DNA lens lock); each shot keeps its own framing">
                    <Switch on={seqLockLens} onChange={setSeqLockLens} />
                    <span className="t-xs muted">Lock lens across shots</span>
                  </label>
                </div>
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
          {/* MODEL ROUTER — one card per model family; swap variants inline */}
          <div className="between" style={{ alignItems: "center" }}>
            <span className="t-label" style={{ margin: 0 }}>Models — pick one, swap the source inline</span>
            <label className="row gap2" style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 9, color: "var(--tx-3)", display: "grid", placeItems: "center", pointerEvents: "none" }}>
                <Icon name="search" size={13} />
              </span>
              <input
                className="input"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Search models…"
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
                {families
                  .filter((f) => f.featured)
                  .map((f) => (
                    <FamilyCard key={f.key} family={f} currentId={model} onPick={setModel} />
                  ))}
              </div>
            </div>
          )}

          <div className="col gap3" style={{ marginTop: 14 }}>
            {([
              { key: "image", label: "Image" },
              { key: "video", label: "Video" },
            ] as const).map(({ key, label }) => {
              const list = familyMatches.filter((f) => f.isVideo === (key === "video"));
              if (list.length === 0) return null;
              return (
                <div key={key}>
                  <div className="t-xs muted" style={{ marginBottom: 6 }}>{label}</div>
                  <div className="row gap2 wrap">
                    {list.map((f) => (
                      <FamilyCard key={f.key} family={f} currentId={model} onPick={setModel} />
                    ))}
                  </div>
                </div>
              );
            })}
            {familyMatches.length === 0 && (
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
              {camPhrase && <span style={{ color: "var(--accent-hi)" }}>, {camPhrase}</span>}
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
          spec={isVideo ? `${numImages > 1 ? `${numImages}×` : ""}${seconds}s · ${ratio}` : `×${numImages} · ${ratio}`}
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

      {sweepSpendOpen && est && budget && sweepAxis && (
        <SpendTakeover
          estimate={sweepTotalUsd}
          modelLabel={`${modelInfo?.label ?? model} · ${sweepValues.length} variants`}
          spec={`vary ${sweepAxis} · ${sweepValues.length}×1 · ${ratio} · ${hasSeed ? "locked base" : "explore"}`}
          afterWeek={budget.spentWeekUsd + sweepTotalUsd}
          weeklyCap={budget.settings.weeklyCapUsd}
          overCap={sweepOverCap}
          busy={sweepBusy}
          onCancel={() => setSweepSpendOpen(false)}
          onConfirm={() => runSweep(true)}
        />
      )}

      {trimFile && modelInfo && (
        <TrimModal
          file={trimFile}
          maxSec={modelInfo.refMedia.maxVideoSec}
          maxMB={modelInfo.refMedia.maxVideoMB}
          model={model}
          project={project}
          onCancel={() => setTrimFile(null)}
          onComplete={(assets) => {
            addRefAssets(assets);
            setTrimFile(null);
            toast({ kind: "ok", title: "Trimmed & added ✂️", sub: "Your clip is in as a reference" });
          }}
        />
      )}
    </div>
  );
}
