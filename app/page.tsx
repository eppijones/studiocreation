"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TransitionLink as Link, useVTNavigate } from "./components/nav";
import { useStudio } from "./components/AppShell";
import { Icon } from "./components/Icon";
import { useAssets, type StudioAsset } from "@/lib/useAssets";
import { hueFor, modelShort, relTime } from "./components/studio";
import styles from "./showcase.module.css";

// Each cast member gets a glyph; falls back to its kind icon (mirrors /create).
const ROLE_ICON: Record<string, string> = {
  "premium-motion-designer": "film",
  "video-editor": "video",
  "audio-engineer": "audio",
  "some-strategist": "spark",
  "graphic-designer": "image",
  "concept-artist": "wand",
  "keynote-designer": "dashboard",
  "product-photographer": "gallery",
  upscaler: "expand",
};

interface CastRole {
  id: string;
  name: string;
  order: number;
  studio: { kind: "image" | "video" } | null;
}

function isVideo(ct: string | null | undefined): boolean {
  return !!ct && ct.startsWith("video");
}

// Mesh-gradient face for a cast tile, by stable role hue (mirrors /create).
function roleMesh(hue: number): string {
  return (
    `radial-gradient(95% 120% at 14% 6%, oklch(0.6 0.2 ${hue}) 0%, transparent 56%),` +
    `radial-gradient(85% 110% at 88% 16%, oklch(0.52 0.22 ${(hue + 70) % 360}) 0%, transparent 52%),` +
    `radial-gradient(120% 100% at 55% 110%, oklch(0.34 0.16 ${(hue + 305) % 360}) 0%, transparent 62%),` +
    `var(--bg-2)`
  );
}

// A cast tile's face: curated still at /roles/<id>.{webp,jpg} → (null, mesh).
function CuratedArt({ roleId }: { roleId: string }) {
  const chain = useMemo(() => [`/roles/${roleId}.webp`, `/roles/${roleId}.jpg`], [roleId]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [roleId]);
  if (idx >= chain.length) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="role-photo" src={chain[idx]} alt="" loading="lazy" onError={() => setIdx((i) => i + 1)} />
  );
}

/* ===================================================================
   COMMAND SEARCH — the indexed, real-time entry into the library.
   Type → live matches across project / label / prompt / model / tags;
   ↑↓ to move, ⏎ to open, ⌘K or "/" to focus. Click a hit → open the file.
   =================================================================== */
function LibraryCommand({
  assets,
  onOpen,
}: {
  assets: StudioAsset[];
  onOpen: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const indexed = useMemo(() => assets.filter((a) => a.blob_url), [assets]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [] as StudioAsset[];
    const terms = query.split(/\s+/);
    return indexed
      .map((a) => ({
        a,
        hay: `${a.project} ${a.label} ${a.prompt} ${modelShort(a.model)} ${(a.tags ?? []).join(" ")}`.toLowerCase(),
      }))
      .filter(({ hay }) => terms.every((t) => hay.includes(t)))
      .slice(0, 8)
      .map(({ a }) => a);
  }, [q, indexed]);

  useEffect(() => setActive(0), [q]);

  // ⌘K / "/" to focus from anywhere; Esc clears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showDrop = focused && q.trim().length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQ("");
      inputRef.current?.blur();
      return;
    }
    if (!showDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) onOpen(r.id);
    }
  };

  return (
    <div className={styles.cmd}>
      {showDrop && (
        <div
          className={styles.cmdScrim}
          aria-hidden
          onMouseDown={() => {
            setQ("");
            inputRef.current?.blur();
          }}
        />
      )}
      <div className={`${styles.cmdField} ${focused ? styles.cmdFocused : ""}`}>
        <Icon name="search" size={18} className={styles.cmdIco} />
        <input
          ref={inputRef}
          className={styles.cmdInput}
          placeholder="Search the media library — project, prompt, model, tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setFocused(false), 130);
          }}
          onKeyDown={onKeyDown}
          aria-label="Search the media library"
          spellCheck={false}
        />
        {q ? (
          <button type="button" className={styles.cmdClear} onClick={() => setQ("")} aria-label="Clear search">
            <Icon name="x" size={14} />
          </button>
        ) : (
          <>
            <span className={styles.cmdIndexed}>
              <span className={styles.cmdLive} /> {indexed.length} indexed
            </span>
            <kbd className={styles.cmdHint}>⌘K</kbd>
          </>
        )}
      </div>

      {showDrop && (
        <div className={styles.cmdDrop}>
          {results.length === 0 ? (
            <div className={styles.cmdEmpty}>No files match “{q.trim()}”.</div>
          ) : (
            results.map((a, i) => (
              <button
                key={a.id}
                type="button"
                className={`${styles.cmdRow} ${i === active ? styles.cmdRowOn : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onOpen(a.id)}
              >
                <span className={styles.cmdThumb}>
                  {isVideo(a.content_type) ? (
                    <video src={a.blob_url} muted playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.blob_url} alt="" loading="lazy" />
                  )}
                </span>
                <span className={styles.cmdText}>
                  <span className={styles.cmdTitle}>
                    {a.project} <span className={styles.cmdSlash}>/</span> {a.label}
                  </span>
                  <span className={styles.cmdSub}>
                    {modelShort(a.model)} · {relTime(a.created_at)}
                  </span>
                </span>
                <span className={styles.cmdKind}>{isVideo(a.content_type) ? "VIDEO" : "IMAGE"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   COVERFLOW — the library as a cinematic 3D carousel. The centred card
   is the keeper; click it to open, click a neighbour to bring it forward.
   Drag, arrows and ←/→ all steer it; it drifts on its own until touched.
   =================================================================== */
const COVERFLOW_AUTO_MS = 3600; // unattended auto-play cadence
const COVERFLOW_HOLD_MS = 5200; // how long the deck rests on a card you picked before drifting on

function Coverflow({
  items,
  onOpen,
}: {
  items: StudioAsset[];
  onOpen: (id: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [stageW, setStageW] = useState(960);
  const [drag, setDrag] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [manualPaused, setManualPaused] = useState(false); // explicit Pause/Play (WCAG 2.2.2)
  const [holdUntil, setHoldUntil] = useState(0); // ms timestamp — auto-play resumes after this
  const stageRef = useRef<HTMLDivElement>(null);
  const vids = useRef<Map<number, HTMLVideoElement>>(new Map());
  const dragState = useRef<{ x: number; on: boolean; moved: boolean }>({ x: 0, on: false, moved: false });

  const count = items.length;
  const clamp = useCallback((i: number) => (count ? (i + count) % count : 0), [count]);
  // pure move — the auto-player uses this and keeps a steady cadence
  const advance = useCallback((dir: number) => setActive((i) => clamp(i + dir)), [clamp]);
  // a deliberate move — lands on a card and makes the deck rest there for a beat
  const hold = useCallback(() => setHoldUntil(Date.now() + COVERFLOW_HOLD_MS), []);
  const step = useCallback((dir: number) => { advance(dir); hold(); }, [advance, hold]);
  const goTo = useCallback((i: number) => { setActive(clamp(i)); hold(); }, [clamp, hold]);

  // Keep the active index in range as the library grows/shrinks.
  useEffect(() => {
    if (active > count - 1) setActive(0);
  }, [count, active]);

  // Measure the stage so card spacing scales with the viewport.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setStageW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The centred card and its two neighbours play & loop, so the deck always feels
  // alive — every file plays as it cycles through; the rest stay parked.
  useEffect(() => {
    vids.current.forEach((v, id) => {
      const i = items.findIndex((it) => it.id === id);
      let off = i - active;
      if (off > count / 2) off -= count;
      if (off < -count / 2) off += count;
      if (Math.abs(off) <= 1) v.play().catch(() => {});
      else v.pause();
    });
  }, [active, items, count]);

  // Auto-play: drifts on its own and re-arms after every move. It rests on a card
  // you picked (holdUntil) and stands still while you hover or drag — alive, yet
  // fully operable. Reduced-motion users get no drift.
  useEffect(() => {
    if (count <= 1 || hovering || dragging || focusWithin || manualPaused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const wait = Math.max(holdUntil - Date.now(), COVERFLOW_AUTO_MS);
    const id = setTimeout(() => advance(1), wait);
    return () => clearTimeout(id);
  }, [active, count, hovering, dragging, focusWithin, manualPaused, holdUntil, advance]);

  const cardW = Math.max(200, Math.min(330, stageW * 0.28));

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { x: e.clientX, on: true, moved: false };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.on) return;
    const dx = e.clientX - dragState.current.x;
    if (Math.abs(dx) > 4) dragState.current.moved = true;
    setDrag(dx);
  };
  const onPointerUp = () => {
    if (!dragState.current.on) return;
    const d = drag;
    const moved = dragState.current.moved;
    dragState.current.on = false;
    setDrag(0);
    setDragging(false);
    // a drag/scrub can cross several cards at once
    const steps = Math.round(-d / (cardW * 0.6));
    if (steps !== 0) setActive((i) => clamp(i + steps));
    // make the landing rest a beat (even a click-hold with no travel counts as "go here")
    if (moved || steps !== 0) hold();
  };

  const transformFor = (offset: number) => {
    const abs = Math.abs(offset);
    const sign = Math.sign(offset);
    const x = offset * cardW * 0.6 + drag * 0.6;
    const rotY = offset === 0 ? 0 : -sign * Math.min(50, 40 + (abs - 1) * 6);
    const z = -Math.min(abs, 3) * 110;
    const scale = Math.max(0.62, 1 - abs * 0.13);
    return `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${rotY}deg) scale(${scale})`;
  };

  const focusItem = items[active];

  return (
    <div
      className={styles.cf}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
      }}
    >
      <div
        ref={stageRef}
        className={styles.cfStage}
        tabIndex={0}
        role="listbox"
        aria-label="Recent renders"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "Enter" && focusItem) {
            onOpen(focusItem.id);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className={styles.cfFloor} aria-hidden />
        {items.map((a, i) => {
          let offset = i - active;
          // wrap so the deck is endless in both directions
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;
          const abs = Math.abs(offset);
          const hidden = abs > 3;
          return (
            <button
              key={a.id}
              type="button"
              className={`${styles.cfItem} ${offset === 0 ? styles.cfActive : ""}`}
              role="option"
              style={{
                transform: transformFor(offset),
                opacity: hidden ? 0 : offset === 0 ? 1 : Math.max(0.34, 1 - abs * 0.22),
                zIndex: 100 - abs,
                pointerEvents: hidden ? "none" : "auto",
                filter: offset === 0 ? "none" : `brightness(${Math.max(0.55, 1 - abs * 0.16)})`,
              }}
              aria-label={offset === 0 ? `Open ${a.project}/${a.label}` : `Bring ${a.project}/${a.label} forward`}
              aria-selected={offset === 0}
              onClick={() => {
                if (dragState.current.moved) return; // a drag, not a click
                if (offset === 0) onOpen(a.id);
                else goTo(i);
              }}
            >
              {isVideo(a.content_type) ? (
                <video
                  ref={(el) => {
                    if (el) vids.current.set(a.id, el);
                    else vids.current.delete(a.id);
                  }}
                  src={a.blob_url}
                  muted
                  loop
                  playsInline
                  preload="auto"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.blob_url}
                  alt=""
                  loading={abs <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
              )}
              {isVideo(a.content_type) && (
                <span className={styles.cfPlay}>
                  <Icon name="play" size={12} />
                </span>
              )}
            </button>
          );
        })}

        {count > 1 && (
          <>
            <button type="button" className={`${styles.cfArrow} ${styles.cfPrev}`} onClick={() => step(-1)} aria-label="Previous">
              <Icon name="chevronRight" size={20} />
            </button>
            <button type="button" className={`${styles.cfArrow} ${styles.cfNext}`} onClick={() => step(1)} aria-label="Next">
              <Icon name="chevronRight" size={20} />
            </button>
          </>
        )}
      </div>

      {/* focused caption + dots */}
      {focusItem && (
        <div className={styles.cfCaption}>
          <div className={styles.cfCapText}>
            <span className={styles.cfCapTitle}>
              {focusItem.project} <span className={styles.cmdSlash}>/</span> {focusItem.label}
            </span>
            <span className={styles.cfCapSub}>
              {modelShort(focusItem.model)} · {relTime(focusItem.created_at)}
              {focusItem.score != null ? ` · scored ${focusItem.score}/10` : ""}
            </span>
          </div>
          <button type="button" className={styles.cfOpen} onClick={() => onOpen(focusItem.id)}>
            Open <Icon name="arrowRight" size={15} />
          </button>
        </div>
      )}

      {count > 1 && (
        <div className={styles.cfDots} role="tablist" aria-label="Jump to render">
          {items.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={`${styles.cfDot} ${i === active ? styles.cfDotOn : ""}`}
              role="tab"
              onClick={() => goTo(i)}
              aria-label={`Render ${i + 1}`}
              aria-selected={i === active}
            />
          ))}
        </div>
      )}

      <div className={styles.cfControls}>
        <button
          type="button"
          className={styles.cfToggle}
          onClick={() => setManualPaused((p) => !p)}
          aria-pressed={manualPaused}
          aria-label={manualPaused ? "Resume auto-play" : "Pause auto-play"}
        >
          <Icon name={manualPaused ? "play" : "pause"} size={11} />
          {manualPaused ? "Paused" : "Auto-playing"}
        </button>
        <span className={styles.cfHint}>drag or ← → to steer · click to open</span>
      </div>
    </div>
  );
}

/* ===================================================================
   PRODUCTION TOOLS — collapsed to a single bar, expands to the full
   finishing & pipeline grid. (grid-template-rows tween = no JS height math)
   =================================================================== */
function ProductionTools({ activeJobs }: { activeJobs: number }) {
  const [open, setOpen] = useState(false);
  const tools = [
    {
      href: "/queue",
      icon: "queue",
      name: "Generations",
      desc: activeJobs > 0 ? `${activeJobs} on the line` : "Live queue & retries",
      accent: true,
    },
    { href: "/deliver", icon: "expand", name: "Upscale to 4K", desc: "Topaz super-res master" },
    { href: "/deliver", icon: "crop", name: "Reframe & exports", desc: "9:16 · 16:9 · 1:1 · scope" },
    { href: "/deliver", icon: "film", name: "Frame-rate finish", desc: "24 · 30 · 60 fps interpolate" },
    { href: "/create", icon: "workflows", name: "Sequence builder", desc: "Shot-by-shot, brand-locked" },
    { href: "/tools", icon: "tools", name: "Open full toolkit", desc: "Every utility & pipeline" },
  ];

  return (
    <div className={`${styles.tools} ${open ? styles.toolsOpen : ""}`}>
      <button
        type="button"
        className={styles.toolsBar}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="prod-tools-panel"
      >
        <span className={styles.toolsIco}>
          <Icon name="tools" size={20} />
        </span>
        <span className={styles.toolsHd}>
          <span className={styles.toolsName}>Production Tools</span>
          <span className={styles.toolsSub}>Finishing, generations &amp; pipelines — wired to your library.</span>
        </span>
        <span className={styles.toolsToggle}>
          {open ? "Hide" : `${tools.length} tools`}
          <Icon name="chevronDown" size={16} className={`${styles.toolsChev} ${open ? styles.toolsChevOpen : ""}`} />
        </span>
      </button>

      <div id="prod-tools-panel" className={`${styles.toolsPanel} ${open ? styles.toolsPanelOpen : ""}`}>
        <div className={styles.toolsPanelInner}>
          <div className={styles.toolsGrid}>
            {tools.map((t) => (
              <Link key={t.name} href={t.href} className={styles.surf}>
                <span className={`${styles.surfIcon} ${t.accent ? styles.surfIconAccent : ""}`}>
                  <Icon name={t.icon} size={19} />
                </span>
                <span className={styles.surfName}>{t.name}</span>
                <span className={styles.surfStat}>
                  {t.desc}
                  <Icon name="chevronRight" size={13} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeLauncher() {
  // navigate wraps the push in a native View Transition (shared headline morphs
  // into Create, the library panel morphs into the gallery); router is for prefetch.
  const router = useRouter();
  const navigate = useVTNavigate();
  const { activeJobs } = useStudio();

  const { assets: allAssets } = useAssets();
  const assets = useMemo(() => allAssets.filter((a) => a.status !== "hidden"), [allAssets]);
  const [cast, setCast] = useState<CastRole[]>([]);
  // Footage from the NEW Media Library (local Postgres), merged into the home
  // carousel alongside Gallery renders. Negative ids mark footage so each card
  // routes to its correct detail view. Fails soft if the library DB is offline.
  const [footage, setFootage] = useState<StudioAsset[]>([]);
  useEffect(() => {
    fetch("/api/library/feed")
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((d) => setFootage((d.assets as StudioAsset[]) ?? []))
      .catch(() => {});
  }, []);

  // Warm the two main destinations so the morph commits instantly.
  useEffect(() => {
    router.prefetch("/create");
    router.prefetch("/gallery");
  }, [router]);

  // The cast — generation roles with a studio preset (excludes meta-tools, order 50).
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setCast(((d.employees ?? []) as CastRole[]).filter((e) => e.studio && e.order < 50)))
      .catch(() => {});
  }, []);

  // Coverflow deck: the freshest renders that actually have a file.
  const recent = useMemo(
    () => [...assets].filter((a) => a.blob_url).sort((a, b) => b.id - a.id).slice(0, 9),
    [assets]
  );
  // UNIFIED deck: Gallery renders + Media Library footage, most-recent first.
  const deck = useMemo(
    () =>
      [...recent, ...footage]
        .filter((a) => a.blob_url)
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 12),
    [recent, footage]
  );

  const goMode = useCallback((mode: "image" | "video") => navigate(`/create?mode=${mode}`), [navigate]);
  const goRole = useCallback((roleId: string) => navigate(`/create?role=${roleId}`), [navigate]);
  // Negative id ⇒ Media Library footage → /library/<id>; otherwise a Gallery render.
  const openAsset = useCallback(
    (id: number) => navigate(id < 0 ? `/library/${-id}` : `/gallery/${id}`),
    [navigate]
  );

  return (
    <div className={styles.launch}>
      {/* gradient backdrop */}
      <div className={styles.bgWrap}>
        <div className={`${styles.bg} ${styles.on}`} style={{ ["--bgHue" as string]: hueFor("studio") }}>
          <div className={styles.bgMesh} />
        </div>
      </div>
      <div className={styles.launchScrim} />

      <div className={styles.launchInner}>
        <div className={styles.launchHead}>
          <span className={styles.eyebrow}>
            {activeJobs > 0 ? (
              <>
                <span className={styles.liveDot} /> {activeJobs} on the line
              </>
            ) : (
              <>
                <span className={styles.liveDot} /> Portal One · {assets.length} indexed · live
              </>
            )}
          </span>
          <h1 className={styles.launchTitle}>What are we making?</h1>
          <p className={styles.sub}>
            Search the whole library, lift a keeper from the deck, or start something new.
          </p>
        </div>

        {/* COMMAND SEARCH — indexed, real-time */}
        <LibraryCommand assets={assets} onOpen={openAsset} />

        {/* CREATE — the make-something surface */}
        <section className={`${styles.panel} ${styles.createPanel}`}>
          <div className={styles.panelHd}>
            <span className={styles.panelEyebrow} style={{ color: "var(--accent-hi)" }}>
              Create
            </span>
          </div>
          <p className={styles.panelLead}>Pick a format or a role — you drop straight into the composer.</p>

          <div className={styles.modeRow}>
            <button type="button" className={styles.modeBtn} onClick={() => goMode("image")}>
              <span className={styles.modeIco}>
                <Icon name="image" size={20} />
              </span>
              <span className={styles.modeName}>Image</span>
              <Icon name="arrowRight" size={16} />
            </button>
            <button type="button" className={styles.modeBtn} onClick={() => goMode("video")}>
              <span className={styles.modeIco}>
                <Icon name="video" size={20} />
              </span>
              <span className={styles.modeName}>Video</span>
              <Icon name="arrowRight" size={16} />
            </button>
          </div>

          {cast.length > 0 && (
            <>
              <span className={styles.castLabel}>
                <Icon name="wand" size={12} /> Jump in as…
              </span>
              <div className={styles.cast}>
                <button
                  type="button"
                  className="role-tile freeform"
                  onClick={() => goMode("image")}
                  aria-label="Standard — no role, start in Create"
                >
                  <div className="role-ico">
                    <Icon name="wand" size={18} />
                  </div>
                  <span className="ff-label">Standard</span>
                </button>
                {cast.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="role-tile"
                    onClick={() => goRole(e.id)}
                    aria-label={`${e.name} — open Create as this role`}
                  >
                    <span className="role-fill">
                      <span className="role-bg" style={{ background: roleMesh(hueFor(e.id)) }} />
                      <CuratedArt roleId={e.id} />
                      <span className="role-scrim" />
                    </span>
                    <div className="role-ico">
                      <Icon name={ROLE_ICON[e.id] ?? (e.studio?.kind === "video" ? "video" : "image")} size={16} />
                    </div>
                    <div className="role-meta">
                      <span className="role-name">{e.name}</span>
                      <span className="role-kind">{e.studio?.kind === "video" ? "Video" : "Image"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {/* RECENT MEDIA — unified cinematic coverflow: Gallery renders +
            Media Library footage, newest first. Each card opens its own view. */}
        <section className={`${styles.panel} ${styles.libPanel}`}>
          <Link href="/gallery" className={styles.panelHd}>
            <span className={styles.panelEyebrow} style={{ color: "var(--accent-gold, #e3b341)" }}>
              Recent media
            </span>
            <span className={styles.panelMeta}>
              {assets.length} render{assets.length === 1 ? "" : "s"}
              {footage.length ? ` · ${footage.length} from the archive` : ""} · Open
              <Icon name="arrowRight" size={13} style={{ verticalAlign: "-2px", marginLeft: 4 }} />
            </span>
          </Link>

          {deck.length > 0 ? (
            <Coverflow items={deck} onOpen={openAsset} />
          ) : (
            <div className={styles.libEmpty}>
              <Icon name="gallery" size={28} />
              <span>Your renders land here — make your first above.</span>
            </div>
          )}
        </section>

        {/* PRODUCTION TOOLS — expandable */}
        <ProductionTools activeJobs={activeJobs} />
      </div>
    </div>
  );
}
