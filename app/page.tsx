"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudio } from "./components/AppShell";
import { Btn, Seg } from "./components/ui";
import { Tile } from "./components/Media";
import { Icon } from "./components/Icon";
import { estimate } from "@/lib/pricing";
import { useAssets } from "@/lib/useAssets";
import { hueFor, money } from "./components/studio";
import styles from "./showcase.module.css";

type Mode = "image" | "video";

// Mirror of the create page's per-mode routing, so a draft handed off here
// lands on the same model + ratio when /create hydrates from localStorage.
const MODE_DEFAULTS: Record<Mode, { model: string; ratio: string; seconds?: number }> = {
  image: { model: "openai/gpt-image-2", ratio: "16:9" },
  video: { model: "fal-ai/veo3.1/fast", ratio: "9:16", seconds: 5 },
};

interface ShowAsset {
  id: number;
  job_id: number;
  blob_url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  status: string;
  project: string;
  label: string;
  prompt: string;
  model: string;
  created_at: string;
}

function isVideo(ct: string | null | undefined): boolean {
  return !!ct && ct.startsWith("video");
}

export default function HomeShowcase() {
  const router = useRouter();
  const { jobs, activeJobs } = useStudio();

  const { assets: allAssets } = useAssets();
  const assets = useMemo(() => allAssets.filter((a) => a.status !== "hidden"), [allAssets]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("image");
  const [focused, setFocused] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [morph, setMorph] = useState(false);

  const dockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const morphPanelRef = useRef<HTMLDivElement>(null);
  const morphRootRef = useRef<HTMLDivElement>(null);


  // Featured backdrop: lead with the studio's best-scored work, then the freshest.
  const featured = useMemo(() => {
    const withMedia = assets.filter((a) => a.blob_url);
    const ranked = [...withMedia].sort((a, b) => {
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sb !== sa) return sb - sa;
      return b.id - a.id;
    });
    return ranked.slice(0, 6);
  }, [assets]);

  // Auto-advance the backdrop, paused while composing.
  useEffect(() => {
    if (paused || focused || featured.length < 2) return;
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % featured.length), 7000);
    return () => clearInterval(id);
  }, [paused, focused, featured.length]);

  useEffect(() => {
    if (heroIdx >= featured.length) setHeroIdx(0);
  }, [featured.length, heroIdx]);

  const hero = featured[heroIdx];

  const est = useMemo(() => {
    try {
      const d = MODE_DEFAULTS[mode];
      return estimate({
        provider: "fal",
        model: d.model,
        count: mode === "video" ? (d.seconds ?? 5) : 1,
        quality: mode === "image" ? "high" : undefined,
      });
    } catch {
      return null;
    }
  }, [mode]);

  // Hand the draft to /create via an explicit deep link (mirrors its existing
  // ?ref / ?iterate handling) — robust, unlike racing localStorage on mount.
  const createHref = useCallback(() => {
    const p = new URLSearchParams();
    if (prompt.trim()) p.set("prompt", prompt.trim());
    p.set("mode", mode);
    return `/create?${p.toString()}`;
  }, [prompt, mode]);

  const goToCreate = useCallback(() => {
    const href = createHref();

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rect = dockRef.current?.getBoundingClientRect();

    if (reduce || !rect) {
      router.push(href);
      return;
    }

    // FLIP: render the morph panel full-screen, then invert it onto the dock's
    // current box and release — it grows from the dock into the create surface.
    setMorph(true);
    requestAnimationFrame(() => {
      const panel = morphPanelRef.current;
      const root = morphRootRef.current;
      if (!panel || !root) {
        router.push(href);
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = rect.width / vw;
      const sy = rect.height / vh;
      panel.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(${sx}, ${sy})`;
      panel.style.borderRadius = "22px";
      // next frame: release to full screen
      requestAnimationFrame(() => {
        panel.style.transform = "translate(0,0) scale(1,1)";
        panel.style.borderRadius = "0px";
        root.classList.add(styles.go);
      });
    });

    window.setTimeout(() => router.push(href), 470);
  }, [router, createHref]);

  const canCreate = !morph;

  return (
    <div className={styles.wrap}>
      {/* HERO — rotating library backdrop + the create dock */}
      <section
        className={styles.hero}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className={styles.bgWrap}>
          {featured.length === 0 && (
            <div
              className={`${styles.bg} ${styles.on}`}
              style={{ ["--bgHue" as string]: hueFor("studio") }}
            >
              <div className={styles.bgMesh} />
            </div>
          )}
          {featured.map((a, i) => (
            <div
              key={a.id}
              className={`${styles.bg} ${i === heroIdx ? styles.on : ""}`}
              aria-hidden={i !== heroIdx}
            >
              {isVideo(a.content_type) ? (
                <video src={a.blob_url} muted loop playsInline autoPlay />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.blob_url} alt="" />
              )}
            </div>
          ))}
        </div>
        <div className={styles.scrim} />

        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>
            {activeJobs > 0 ? (
              <>
                <span className={styles.liveDot} /> {activeJobs} on the line
              </>
            ) : (
              <>StudioCreation · {assets.length} in the library</>
            )}
          </span>
          <h1 className={styles.headline}>What are we making?</h1>
          <p className={styles.sub}>
            Browse the studio below, or start something new — every render is one top model at delivery quality.
          </p>

          <div
            ref={dockRef}
            className={`${styles.dock} ${focused ? styles.focused : ""}`}
          >
            <textarea
              ref={inputRef}
              className={styles.dockInput}
              value={prompt}
              rows={1}
              placeholder={mode === "video" ? "Describe the shot… a cinematic move through…" : "Describe the image… a studio render of…"}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canCreate) {
                  e.preventDefault();
                  goToCreate();
                }
              }}
            />
            <div className={styles.dockBar}>
              <Seg
                options={[
                  { value: "image", label: "Image" },
                  { value: "video", label: "Video" },
                ]}
                value={mode}
                onChange={(v) => setMode(v as Mode)}
              />
              <span className={styles.dockSpacer} />
              <span className={styles.dockCost}>
                <b>{est ? money(est.usd) : "—"}</b> · {mode === "image" ? "GPT Image 2" : "Veo 3.1 Fast"}
              </span>
              <Btn variant="primary" size="lg" disabled={!canCreate} onClick={goToCreate}>
                Create
                <Icon name="arrowRight" size={16} />
              </Btn>
            </div>
          </div>
        </div>

        {hero && (
          <Link href={`/gallery/${hero.id}`} className={styles.feat}>
            <span className={styles.featLabel}>Featured · {hero.project}</span>
            <span className={styles.featTitle}>
              {hero.label || `Render #${hero.id}`}
              {hero.score != null && hero.score >= 8 && <span className={styles.featScore}>{hero.score}/10</span>}
            </span>
            {hero.prompt && <span className={styles.featPrompt}>{hero.prompt}</span>}
          </Link>
        )}

        {featured.length > 1 && (
          <div className={styles.dots}>
            {featured.map((a, i) => (
              <button
                key={a.id}
                className={`${styles.dot} ${i === heroIdx ? styles.on : ""}`}
                aria-label={`Show featured render ${i + 1}`}
                onClick={() => setHeroIdx(i)}
              />
            ))}
          </div>
        )}
      </section>

      {/* RAILS — the browsable library */}
      <Rails assets={assets} jobs={jobs} onOpen={(id) => router.push(`/gallery/${id}`)} />

      {/* FLIP morph overlay → /create */}
      {morph && (
        <div ref={morphRootRef} className={styles.morphRoot}>
          <div ref={morphPanelRef} className={styles.morphPanel}>
            <span className={styles.morphTitle}>What are we making?</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- rails ---------- */
function Rails({
  assets,
  jobs,
  onOpen,
}: {
  assets: ShowAsset[];
  jobs: import("./components/studio").ClientJob[];
  onOpen: (id: number) => void;
}) {
  const toReview = assets.filter((a) => a.status === "new");
  const used = assets.filter((a) => a.status === "approved" || a.status === "delivered");
  const recent = [...assets].sort((a, b) => b.id - a.id);

  // top projects by volume, each its own row
  const byProject = useMemo(() => {
    const m = new Map<string, ShowAsset[]>();
    for (const a of recent) {
      if (!m.has(a.project)) m.set(a.project, []);
      m.get(a.project)!.push(a);
    }
    return Array.from(m.entries())
      .filter(([, list]) => list.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);
  }, [recent]);

  if (assets.length === 0 && jobs.length === 0) {
    return (
      <div className={styles.rails}>
        <div className="empty" style={{ padding: "48px 0" }}>
          <Icon name="gallery" size={40} />
          <span>The library is empty. Make your first render above — it lands here.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.rails}>
      {toReview.length > 0 && (
        <Rail title="Pick up where you left off" icon="play" count={toReview.length} href="/gallery" items={toReview} onOpen={onOpen} />
      )}
      <Rail title="Fresh from the line" icon="spark" count={recent.length} href="/gallery" items={recent} onOpen={onOpen} />
      {used.length > 0 && (
        <Rail title="The used set" icon="checkcircle" count={used.length} href="/deliver" items={used} onOpen={onOpen} />
      )}
      {byProject.map(([project, items]) => (
        <Rail key={project} title={project} icon="briefs" count={items.length} href="/gallery" items={items} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Rail({
  title,
  icon,
  count,
  href,
  items,
  onOpen,
}: {
  title: string;
  icon: string;
  count: number;
  href: string;
  items: ShowAsset[];
  onOpen: (id: number) => void;
}) {
  return (
    <section className={styles.rail}>
      <div className={styles.railHead}>
        <h2 className={styles.railTitle}>
          <Icon name={icon} size={17} /> {title} <span className={styles.railCount}>{count}</span>
        </h2>
        <Link href={href} className={styles.railLink}>
          See all <Icon name="chevronRight" size={13} />
        </Link>
      </div>
      <div className={styles.track}>
        {items.slice(0, 16).map((a) => (
          <div key={a.id} className={styles.card}>
            <Tile
              asset={{
                id: a.id,
                blob_url: a.blob_url,
                content_type: a.content_type,
                score: a.score,
                status: a.status,
                hueKey: a.job_id,
                prompt: a.prompt,
                label: a.label,
                width: a.width,
                height: a.height,
                aspect: "16 / 10",
                duration_s: a.duration_s,
              }}
              fit="cover"
              caption
              ariaLabel={`${a.project}/${a.label} — ${a.prompt || "render"}`}
              onClick={() => onOpen(a.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
