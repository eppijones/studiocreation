"use client";

import { useMemo, useState } from "react";
import { estimate } from "@/lib/pricing";
import { useStudio } from "../components/AppShell";
import { Card, Btn, Chip, Seg, Overlay, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { money, usd } from "../components/studio";

interface WorkflowJob {
  model: string;
  prompt: string;
  numImages?: number;
  seconds?: number;
  ratio: string;
  quality?: string;
  audio?: boolean;
  label: string;
}

interface Workflow {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  fields: { id: string; label: string; placeholder: string; textarea?: boolean }[];
  options?: { id: string; label: string; choices: [string, string][] }[];
  build: (v: Record<string, string>) => WorkflowJob[];
}

const WORKFLOWS: Workflow[] = [
  {
    id: "storyboard",
    icon: "gallery",
    title: "Storyboard",
    blurb:
      "One GPT Image 2 grid = the whole sequence boarded before a single video dollar is spent. Approve it, then feed it to Seedance as @Image1.",
    fields: [
      { id: "brief", label: "Brief / story beats", placeholder: "Anthem teaser: trophy reveal, crowd surge, hero close-up…", textarea: true },
    ],
    options: [
      { id: "panels", label: "Panels", choices: [["9", "9 (3×3)"], ["16", "16 (4×4)"]] },
    ],
    build: (v) => [
      {
        model: "openai/gpt-image-2",
        quality: "high",
        ratio: "16:9",
        numImages: 1,
        label: "storyboard",
        prompt: `A ${v.panels === "16" ? "16-panel (4×4)" : "9-panel (3×3)"} film storyboard grid, clean white gutters between panels. Each panel is one shot of this sequence: ${v.brief}. Annotate every panel with shot number, duration in seconds, camera move and a one-line action note in small clean text below the frame. Consistent characters, props and palette across all panels, cinematic lighting, professional director's storyboard style.`,
      },
    ],
  },
  {
    id: "character-pack",
    icon: "image",
    title: "Character pack",
    blurb:
      "Master reference sheet + style sheet on GPT Image 2 — the consistency stack. Reuse them as references on every future shot so the character never morphs.",
    fields: [
      { id: "character", label: "Character description", placeholder: "Viking-era striker figurine, braided beard, navy & gold kit…", textarea: true },
    ],
    build: (v) => [
      {
        model: "openai/gpt-image-2",
        quality: "high",
        ratio: "1:1",
        numImages: 1,
        label: "refsheet-master",
        prompt: `Character reference sheet on a single canvas: ${v.character}. Multi-view grid: front view, side profile, back view, dynamic action pose, face close-up. Same character in every view, no variation in appearance, consistent character design — identical face, wardrobe, proportions and materials across all views. Labeled angles, clean studio lighting, neutral background, palette and material swatches along the bottom edge.`,
      },
      {
        model: "openai/gpt-image-2",
        quality: "high",
        ratio: "1:1",
        numImages: 1,
        label: "refsheet-style",
        prompt: `Style reference board for: ${v.character}. Large material and texture close-ups, full color palette with swatches, lighting reference spheres showing the key light setup, surface finish details. No characters, only materials, palette and light. Clean studio layout on a single canvas.`,
      },
    ],
  },
  {
    id: "motion-graphics",
    icon: "film",
    title: "Motion graphics",
    blurb:
      "Premium motion design pass on Kling 3.0 Pro — hyperkinetic agency energy, brand-DNA locked. Audio on for the full mix.",
    fields: [
      { id: "concept", label: "Concept", placeholder: "Logo shatters into gold particles that re-form as the trophy…", textarea: true },
    ],
    options: [
      { id: "ratio", label: "Format", choices: [["16:9", "16:9 widescreen"], ["9:16", "9:16 vertical"], ["1:1", "1:1 square"]] },
      { id: "seconds", label: "Length", choices: [["5", "5s"], ["8", "8s"], ["10", "10s"]] },
    ],
    build: (v) => [
      {
        model: "fal-ai/kling-video/v3/pro/text-to-video",
        ratio: v.ratio || "16:9",
        seconds: Number(v.seconds || 5),
        audio: true,
        label: "motion-gfx",
        prompt: `High-end motion design: ${v.concept}. Hyperkinetic energy, smash cuts and speed ramps, bold typography integration, premium agency finish, consistent material and palette throughout, dramatic studio lighting, tier-1 motion design quality.`,
      },
    ],
  },
  {
    id: "quality-ladder",
    icon: "spark",
    title: "Quality ladder",
    blurb:
      "Four comps on GPT Image 2 at full quality from one brief (~$0.64) — every frame is a hero render, no cheap pass. Pick the winner, then finish it to 4K.",
    fields: [
      { id: "brief", label: "Brief", placeholder: "Moody product hero of the new away kit on wet asphalt…", textarea: true },
    ],
    options: [
      { id: "ratio", label: "Format", choices: [["16:9", "16:9"], ["9:16", "9:16"], ["1:1", "1:1"]] },
    ],
    build: (v) => [
      {
        model: "openai/gpt-image-2",
        ratio: v.ratio || "16:9",
        numImages: 4,
        quality: "high",
        label: "comp",
        prompt: v.brief,
      },
    ],
  },
];

export default function WorkflowsPage() {
  const { budget, refresh } = useStudio();
  const toast = useToast();

  const [open, setOpen] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [project, setProject] = useState("studio");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirmThreshold = budget?.settings.confirmThresholdUsd ?? 1.25;

  const workflow = WORKFLOWS.find((w) => w.id === open) ?? null;

  const jobs = useMemo(() => {
    if (!workflow) return [];
    const required = workflow.fields.every((f) => (values[f.id] ?? "").trim());
    if (!required) return [];
    const withDefaults = { ...values };
    for (const opt of workflow.options ?? []) {
      if (!withDefaults[opt.id]) withDefaults[opt.id] = opt.choices[0][0];
    }
    return workflow.build(withDefaults);
  }, [workflow, values]);

  const totalEst = useMemo(() => {
    let total = 0;
    for (const j of jobs) {
      try {
        total += estimate({
          provider: "fal",
          model: j.model,
          count: j.seconds ?? j.numImages ?? 1,
          quality: j.quality,
          audio: j.audio,
        }).usd;
      } catch {
        return null;
      }
    }
    return total;
  }, [jobs]);

  const overThreshold = totalEst !== null && totalEst > confirmThreshold;

  async function submit(confirmed: boolean) {
    if (!workflow || jobs.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const queued: number[] = [];
      for (const job of jobs) {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...job, project, confirmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === "confirm_required") {
            setConfirmOpen(true);
            return;
          }
          if (data.error === "weekly_cap_exceeded")
            throw new Error(`Weekly cap reached ($${data.budget?.settings.weeklyCapUsd}). Finance can raise it in Settings.`);
          if (data.error === "monthly_pool_exceeded")
            throw new Error(`Monthly team pool exhausted ($${data.budget?.settings.monthlyPoolUsd}).`);
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        queued.push(data.jobId);
      }
      setConfirmOpen(false);
      setValues({});
      toast({
        kind: "ok",
        title: `${queued.length} on the line`,
        sub: `${totalEst !== null ? money(totalEst) : ""} · review in the gallery when they land`,
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workflow failed");
    } finally {
      setBusy(false);
    }
  }

  function onLaunch() {
    if (overThreshold) setConfirmOpen(true);
    else submit(false);
  }

  return (
    <div className="screen-pad narrow">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Workflows</p>
          <h1 className="t-display">Production templates</h1>
          <p className="t-body">Common multi-job recipes — storyboards, character packs, mood boards, upscales.</p>
        </div>
      </div>

      {error && (
        <p className="err" style={{ marginBottom: 14 }}>
          ⚠️ {error}
        </p>
      )}

      <div className="col gap3">
        {WORKFLOWS.map((w) => {
          const isOpen = open === w.id;
          return (
            <Card key={w.id} className={isOpen ? "sel" : ""}>
              <button
                className="card-hd between"
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                onClick={() => {
                  setOpen(isOpen ? null : w.id);
                  setValues({});
                  setError(null);
                }}
              >
                <div className="row gap3" style={{ alignItems: "flex-start" }}>
                  <span className="nicon" style={{ color: "var(--accent-hi)", marginTop: 2 }}>
                    <Icon name={w.icon} size={20} />
                  </span>
                  <div className="col" style={{ gap: 4 }}>
                    <span className="t-h3">{w.title}</span>
                    <span className="t-sm muted" style={{ maxWidth: 560 }}>
                      {w.blurb}
                    </span>
                  </div>
                </div>
                <span style={{ color: "var(--tx-3)", flex: "none" }}>
                  <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={18} />
                </span>
              </button>

              {isOpen && (
                <div className="card-pad" style={{ paddingTop: 0 }}>
                  <div className="hr" style={{ margin: "0 0 16px" }} />

                  <div className="col gap4">
                    {w.fields.map((f) => (
                      <div key={f.id}>
                        <span className="field-label">{f.label}</span>
                        {f.textarea ? (
                          <textarea
                            className="input"
                            style={{ minHeight: 100 }}
                            placeholder={f.placeholder}
                            value={values[f.id] ?? ""}
                            onChange={(e) => setValues((p) => ({ ...p, [f.id]: e.target.value }))}
                            disabled={busy}
                          />
                        ) : (
                          <input
                            className="input"
                            placeholder={f.placeholder}
                            value={values[f.id] ?? ""}
                            onChange={(e) => setValues((p) => ({ ...p, [f.id]: e.target.value }))}
                            disabled={busy}
                          />
                        )}
                      </div>
                    ))}

                    <div className="row gap5 wrap">
                      {(w.options ?? []).map((opt) => (
                        <div key={opt.id}>
                          <span className="field-label">{opt.label}</span>
                          <Seg
                            options={opt.choices.map(([val, lab]) => ({ value: val, label: lab }))}
                            value={values[opt.id] ?? opt.choices[0][0]}
                            onChange={(v) => setValues((p) => ({ ...p, [opt.id]: v }))}
                          />
                        </div>
                      ))}
                      <div className="grow" style={{ minWidth: 160 }}>
                        <span className="field-label">Project</span>
                        <input className="input" value={project} onChange={(e) => setProject(e.target.value)} disabled={busy} />
                      </div>
                    </div>
                  </div>

                  <div className="hr" style={{ margin: "16px 0" }} />

                  <div className="between wrap gap3">
                    <div className="row gap2" style={{ alignItems: "baseline" }}>
                      {jobs.length > 0 && totalEst !== null ? (
                        <>
                          <span className="t-label" style={{ margin: 0 }}>
                            Preflight
                          </span>
                          <span className="t-h2 mono">{money(totalEst)}</span>
                          <span className="t-xs muted">
                            {jobs.length} job{jobs.length === 1 ? "" : "s"}
                          </span>
                          {overThreshold && (
                            <Chip on style={{ pointerEvents: "none" }}>
                              over the gate
                            </Chip>
                          )}
                        </>
                      ) : (
                        <span className="t-sm muted">Fill in the brief to see the cost.</span>
                      )}
                    </div>
                    <Btn
                      variant="primary"
                      icon="bolt"
                      disabled={busy || jobs.length === 0 || totalEst === null}
                      onClick={onLaunch}
                    >
                      {busy ? "Queueing…" : overThreshold ? "Review spend" : "Launch workflow"}
                    </Btn>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {confirmOpen && totalEst !== null && (
        <Overlay onClose={() => (busy ? undefined : setConfirmOpen(false))}>
          <Card pad className="sheet" style={{ maxWidth: 420, width: "100%" }}>
            <span className="t-label t-eyebrow">Spend confirmation · over the gate</span>
            <div className="t-display mono" style={{ fontSize: 34, margin: "6px 0 14px" }}>
              {money(totalEst)}
            </div>
            <div className="meta-rows mono t-sm">
              <div className="meta-row">
                <span className="k">Workflow</span>
                <span>{workflow?.title}</span>
              </div>
              <div className="meta-row">
                <span className="k">Jobs</span>
                <span>×{jobs.length}</span>
              </div>
              {budget && (
                <div className="meta-row">
                  <span className="k">Budget after</span>
                  <span>
                    {usd(budget.spentWeekUsd + totalEst)} / {usd(budget.settings.weeklyCapUsd)}
                  </span>
                </div>
              )}
            </div>
            <p className="t-xs muted" style={{ margin: "14px 0 16px" }}>
              🎬 This queues {jobs.length} billable job{jobs.length === 1 ? "" : "s"} on the hero line. Approving the plan is not
              approving the spend.
            </p>
            <div className="row gap3">
              <Btn
                variant="primary"
                size="lg"
                icon="shield"
                className="grow"
                disabled={busy}
                onClick={() => submit(true)}
              >
                {busy ? "Sending…" : `Commit ${money(totalEst)}`}
              </Btn>
              <Btn variant="ghost" size="lg" disabled={busy} onClick={() => setConfirmOpen(false)}>
                Back off
              </Btn>
            </div>
          </Card>
        </Overlay>
      )}
    </div>
  );
}
