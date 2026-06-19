"use client";

/** Create-composer helper components, extracted from page.tsx so the page module
 *  stays focused on behaviour. These are presentational/prop-driven — they hold no
 *  page state; everything comes in via props. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type ModelInfo } from "@/lib/pricing";
import { brandPath, topLevelBrands, subBrandsOf, type BrandProfile } from "@/lib/brandTypes";
import { Btn, FuelGauge, Seg } from "../components/ui";
import { Media } from "../components/Media";
import { Icon } from "../components/Icon";
import { JobProgress } from "../components/JobProgress";
import { money, usd, modelShort, relTime, isInFlight, glowVars, type ClientJob, type ClientJobAsset } from "../components/studio";
import { type RefAsset, type RefKind, refKind } from "./types";
import { buildFamilies, familyKey, familyOf, variantOf, variantSummary, VARIANT_META, type ModelFamily } from "./models";

/* ---------- result dock: live progress + the freshest render, inline ----------
   Closes the create→see→iterate loop — the render lands HERE with actions, so the
   operator never has to hop to the gallery to react to their own work. */
export function ResultDock({
  jobs,
  lastJobId,
  onIterate,
  onKeep,
  onAnimate,
  onCancel,
}: {
  jobs: ClientJob[];
  lastJobId: number | null;
  onIterate: () => void;
  onKeep: (assetId: number) => void;
  onAnimate: (asset: ClientJobAsset) => void;
  onCancel: (jobId: number) => void;
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
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: "none" }}
            onClick={() => onCancel(j.id)}
            title="Stop this generation"
          >
            <Icon name="x" size={13} /> Cancel
          </button>
        </div>
      ))}

      {result && <ResultCard job={result} onIterate={onIterate} onKeep={onKeep} onAnimate={onAnimate} />}
    </div>
  );
}

export function ResultCard({
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
/* Click-to-type numeric value with a commit-on-blur/Enter draft, clamped to
   [min,max]. Pairs with a slider so a value can be dragged OR typed exactly. */
function NumberField({
  value,
  min,
  max,
  suffix,
  ariaLabel,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  ariaLabel: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const skip = useRef(false);
  // Read the live input value on commit (not closed-over draft state) so a value
  // typed and committed in the same tick still lands.
  const commit = (raw: string) => {
    if (skip.current) {
      skip.current = false;
      setDraft(null);
      return;
    }
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, Math.round(n))));
    setDraft(null);
  };
  return (
    <span className="val-edit" title={`${min}–${max}${suffix ?? ""}`}>
      <input
        className="val-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={ariaLabel}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            skip.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      {suffix && <span className="val-suffix">{suffix}</span>}
    </span>
  );
}

export function ShapeControl({
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
        <span className="dock-ctl-k">Count</span>
        <input className="rng" type="range" min={min} max={max} value={numImages} aria-label="Number of images" onChange={(e) => onNumImages(Number(e.target.value))} />
        <NumberField value={numImages} min={min} max={max} suffix="×" ariaLabel="Number of images" onCommit={onNumImages} />
      </div>
    );
  }
  // Video — Length, plus a Count when the model can make more than one clip
  // (the composer fires one render per clip).
  const { min: cMin, max: cMax } = modelInfo?.numImages ?? { min: 1, max: 4 };
  const countCtl =
    cMax > cMin ? (
      <div className="dock-ctl">
        <span className="dock-ctl-k">Count</span>
        <input className="rng" type="range" min={cMin} max={cMax} value={numImages} aria-label="Number of clips" onChange={(e) => onNumImages(Number(e.target.value))} />
        <NumberField value={numImages} min={cMin} max={cMax} suffix="×" ariaLabel="Number of clips" onCommit={onNumImages} />
      </div>
    ) : null;
  const d = modelInfo?.durations ?? { mode: "range" as const, min: 1, max: 15 };
  if (d.mode === "discrete" && d.values?.length) {
    return (
      <>
        <div className="dock-ctl">
          <span className="dock-ctl-k">Length</span>
          <Seg options={d.values.map((v) => ({ value: String(v), label: `${v}s` }))} value={String(seconds)} onChange={(v) => onSeconds(Number(v))} />
        </div>
        {countCtl}
      </>
    );
  }
  const min = d.min ?? 1;
  const max = d.max ?? 15;
  return (
    <>
      <div className="dock-ctl">
        <span className="dock-ctl-k">Length</span>
        <input className="rng" type="range" min={min} max={max} value={seconds} aria-label="Length in seconds" onChange={(e) => onSeconds(Number(e.target.value))} />
        <NumberField value={seconds} min={min} max={max} suffix="s" ariaLabel="Length in seconds" onCommit={onSeconds} />
      </div>
      {countCtl}
    </>
  );
}

/* ---------- reference dock: upload + gallery, per-type slots, surfaced in the composer ---------- */
export function ReferenceDock({
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

  // Per-type limits, written plainly and shown as bold badges so the operator can
  // see at a glance what fits, e.g. "Video — up to 50 MB · 10s".
  const limits: { k: RefKind; label: string; value: string }[] = refMedia
    ? supported.map(({ k }) =>
        k === "image"
          ? { k, label: "Images", value: `up to ${refMedia.maxImageMB} MB` }
          : k === "video"
            ? { k, label: "Video", value: `up to ${refMedia.maxVideoMB} MB · ${refMedia.maxVideoSec}s` }
            : { k, label: "Audio", value: `up to ${refMedia.maxAudioMB} MB · ${refMedia.maxAudioSec}s` }
      )
    : [];

  return (
    <div className="ref-dock">
      <div className="ref-dock-bar">
        <span className="t-label" style={{ margin: 0 }}>
          <Icon name={headerIcon} size={12} /> References <span className="ref-count mono">{capLabel}</span>
        </span>
        {required && (
          <span className={`ref-req ${missing ? "miss" : "ok"}`}>
            <span className="led" /> {missing ? "Needs a reference" : "Locked in"}
          </span>
        )}
      </div>

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

      {/* Big, obvious entry points — upload from disk or pull from the gallery */}
      <div className={`ref-actions ${required && missing ? "needs" : ""}`}>
        <button
          type="button"
          className="ref-cta upload"
          disabled={uploading || allFull}
          onClick={() => fileInputRef.current?.click()}
          title={allFull ? "Reference slots full" : "Upload from your computer"}
        >
          <span className="ref-cta-ico">
            <Icon name="download" size={22} style={{ transform: "rotate(180deg)" }} />
          </span>
          <span className="ref-cta-tx">
            <span className="ref-cta-title">{uploading ? "Uploading…" : allFull ? "Slots full" : "Upload"}</span>
            <span className="ref-cta-sub">Drag &amp; drop, or click to browse</span>
          </span>
        </button>
        <button
          type="button"
          className={`ref-cta gallery ${open ? "on" : ""}`}
          onClick={onToggleOpen}
          title="Pick from the gallery"
        >
          <span className="ref-cta-ico">
            <Icon name="gallery" size={22} />
          </span>
          <span className="ref-cta-tx">
            <span className="ref-cta-title">Gallery</span>
            <span className="ref-cta-sub">{open ? "Choose one below" : "Reuse one of your renders"}</span>
          </span>
          <Icon name={open ? "chevronDown" : "chevronRight"} size={16} className="ref-cta-chev" />
        </button>
      </div>

      {limits.length > 0 && (
        <div className="ref-limits">
          <span className="ref-limits-k">Accepts</span>
          {limits.map((l) => (
            <span key={l.k} className="ref-limit">
              <b>{l.label}</b> {l.value}
            </span>
          ))}
        </div>
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

/* ---------- model popover: pick a FAMILY (Seedance 2.0, GPT Image 2…) — variants
   swap inline via VariantSwitch, so this is one decision not five ---------- */
export function ModelPopover({
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
  const families = useMemo(() => buildFamilies(models), [models]);
  const curKey = familyKey(value);
  const cur = families.find((f) => f.key === curKey);
  // Quick list: the pinned families for whichever mode we're in.
  const quick = families.filter((f) => f.featured && f.isVideo === isVideo);

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

  const pick = (f: ModelFamily) => {
    // Keep the current variant when the new family offers it; else land on its base.
    const want = variantOf(models.find((m) => m.id === value) ?? f.base);
    const match = f.members.find((m) => variantOf(m) === want) ?? f.base;
    onChange(match.id);
    setOpen(false);
  };

  return (
    <div className="brandpick" ref={ref} style={{ position: "relative" }}>
      <button type="button" className={`chip ${open ? "on" : ""}`} onClick={() => setOpen((v) => !v)} title="Switch model">
        <Icon name={isVideo ? "video" : "image"} size={13} /> {cur?.label ?? value}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="brandpick-pop" style={{ minWidth: 260, left: 0, right: "auto" }}>
          {quick.map((f) => (
            <button key={f.key} className={`brandpick-row ${curKey === f.key ? "on" : ""}`} onClick={() => pick(f)}>
              <span className="grow">{f.label}</span>
              {f.members.length > 1 && <span className="t-xs muted">{variantSummary(f)}</span>}
              {curKey === f.key && <Icon name="check" size={13} />}
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

/* ---------- variant switch: swap how the chosen model is driven — From text /
   From an image / From references / Edit — without leaving the composer ---------- */
export function VariantSwitch({
  models,
  value,
  onChange,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const family = useMemo(() => familyOf(models, value), [models, value]);
  if (!family || family.members.length < 2) return null;
  const options = family.members.map((m) => ({ value: m.id, label: VARIANT_META[variantOf(m)].short }));
  return (
    <span className="variant-switch" title="Swap how this model is driven — text, image or references">
      <Seg options={options} value={value} onChange={onChange} />
    </span>
  );
}

/* ---------- brand picker: project → sub-brand, where Generate used to sit ---------- */
export function BrandPicker({
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
export function SpendTakeover({
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
