"use client";

import Link from "next/link";
import { useStudio } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { usd } from "../components/studio";
import styles from "./tools.module.css";

type Tone = "accent" | "ok" | "run" | "warn" | "bad";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-wash)", fg: "var(--accent-hi)" },
  ok: { bg: "var(--ok-wash)", fg: "var(--ok-tx)" },
  run: { bg: "var(--run-wash)", fg: "var(--run-tx)" },
  warn: { bg: "var(--warn-wash)", fg: "var(--warn-tx)" },
  bad: { bg: "var(--bad-wash)", fg: "var(--bad-tx)" },
};

interface Tool {
  href?: string;
  icon: string;
  name: string;
  desc: string;
  tone: Tone;
  stat?: string;
  soon?: boolean;
}

function ToolCard({ t }: { t: Tool }) {
  const tone = TONE[t.tone];
  const body = (
    <>
      <div className={styles.toolTop}>
        <span className={styles.toolIcon} style={{ background: tone.bg, color: tone.fg }}>
          <Icon name={t.icon} size={19} />
        </span>
        {t.soon && <span className={styles.soonPill}>Soon</span>}
      </div>
      <span className={styles.toolName}>{t.name}</span>
      <span className={styles.toolDesc}>{t.desc}</span>
      {t.soon ? (
        <span className={styles.toolFoot} style={{ color: "var(--tx-4)" }}>
          In the pipeline
        </span>
      ) : (
        <span className={styles.toolFoot} style={{ color: tone.fg }}>
          {t.stat ?? "Open"}
          <Icon name="chevronRight" size={13} />
        </span>
      )}
    </>
  );

  if (t.soon || !t.href) {
    return (
      <div className={`${styles.tool} ${styles.soon}`} aria-disabled>
        {body}
      </div>
    );
  }
  return (
    <Link href={t.href} className={`${styles.tool} ${styles.link}`}>
      {body}
    </Link>
  );
}

function Section({ label, note, tools }: { label: string; note?: string; tools: Tool[] }) {
  return (
    <>
      <div className={styles.sectionLabel}>
        {label}
        {note && <span className={styles.note}>· {note}</span>}
      </div>
      <div className={styles.grid}>
        {tools.map((t) => (
          <ToolCard key={t.name} t={t} />
        ))}
      </div>
    </>
  );
}

export default function ToolsPage() {
  const { budget, activeJobs, needsScoring } = useStudio();

  const pipelines: Tool[] = [
    {
      href: "/deliver",
      icon: "checkcircle",
      name: "Review & Delivery",
      desc: "Approve renders, then master & export them in the Finalize Center.",
      tone: "run",
      stat: needsScoring > 0 ? `${needsScoring} to review` : "Approve & deliver",
    },
    {
      href: "/queue",
      icon: "queue",
      name: "Generations",
      desc: "Every job on the line — live progress, retries and one-tap cancel.",
      tone: "accent",
      stat: activeJobs > 0 ? `${activeJobs} on the line` : "Open queue",
    },
    {
      href: "/costs",
      icon: "costs",
      name: "Costs & budget",
      desc: "The weekly pool, per-job spend and the full spend ledger.",
      tone: "ok",
      stat: budget ? `${usd(budget.spentWeekUsd)} this week` : "Open ledger",
    },
  ];

  const creative: Tool[] = [
    {
      href: "/create",
      icon: "wand",
      name: "Roles — the cast",
      desc: "Graphic Designer, Concept Artist, Photographer & more route the model, ratio and house style in one tap.",
      tone: "accent",
      stat: "Open Create",
    },
    {
      href: "/brands",
      icon: "spark",
      name: "Brands",
      desc: "House palettes, type and brand-DNA lock — held consistent across a whole sequence.",
      tone: "warn",
      stat: "Manage brands",
    },
    {
      href: "/create",
      icon: "workflows",
      name: "Sequence builder",
      desc: "Build a film shot by shot. One role, brand and reference set across every shot, fired in order.",
      tone: "run",
      stat: "Open Create",
    },
  ];

  const finishing: Tool[] = [
    {
      href: "/deliver",
      icon: "expand",
      name: "Upscale to 4K",
      desc: "Topaz super-resolution for stills and video masters before delivery.",
      tone: "accent",
      stat: "Open finishing",
    },
    {
      href: "/deliver",
      icon: "crop",
      name: "Reframe & exports",
      desc: "9:16 · 16:9 · 4:5 · 1:1 · 2.35:1 — crop or letterbox via $0 ffmpeg recipes.",
      tone: "run",
      stat: "Open finishing",
    },
    {
      href: "/deliver",
      icon: "film",
      name: "Frame-rate finish",
      desc: "Interpolate to 24 · 25 · 30 · 50 · 60 fps for broadcast-grade delivery.",
      tone: "ok",
      stat: "Open finishing",
    },
  ];

  const soon: Tool[] = [
    { icon: "captions", name: "Subtitles", desc: "Transcribe & burn captions in 40+ languages.", tone: "ok", soon: true },
    { icon: "layers", name: "Background", desc: "Remove or replace backgrounds on any shot.", tone: "warn", soon: true },
    { icon: "eye", name: "Color grade", desc: "House LUTs & auto-match across a sequence.", tone: "accent", soon: true },
    { icon: "audio", name: "Audio master", desc: "Loudness, ducking & true-peak limiting to platform targets.", tone: "run", soon: true },
  ];

  return (
    <div className="screen-pad">
      <div className={styles.head}>
        <p className="t-label t-eyebrow" style={{ margin: 0 }}>Production Tools</p>
        <h1 className="t-display" style={{ margin: 0 }}>Your media toolkit</h1>
        <p className="muted" style={{ margin: 0, fontSize: 14, maxWidth: 560 }}>
          One-click utilities, review &amp; delivery, and the pipelines that run the floor — all wired to your library.
        </p>
      </div>

      <Section label="Pipelines & review" tools={pipelines} />
      <Section label="Create tools" tools={creative} />
      <Section label="Finishing" note="run on any approved clip" tools={finishing} />
      <Section label="Utilities" note="coming soon" tools={soon} />
    </div>
  );
}
