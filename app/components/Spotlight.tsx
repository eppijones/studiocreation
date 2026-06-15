"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { glowVars, relTime } from "./studio";

export interface SpotlightItem {
  id: number;
  blob_url?: string | null;
  content_type?: string | null;
  score?: number | null;
  label?: string;
  project?: string;
  created_at?: string;
  duration_s?: number | null;
  hueKey?: string | number | null;
}

function isVideoKind(kind?: string | null): boolean {
  return !!kind && /video|mp4|webm|mov/.test(kind);
}

/**
 * Apple-TV-style coverflow: a large center card flanked by smaller, dimmed
 * cards floating over a hue-keyed radial glow. Click a side card to bring it
 * forward; click the centred one to open it. Drag / arrows / dots to move.
 * Each render's quality score reads as the rating badge.
 */
export function Spotlight({
  items,
  title = "Spotlight",
  subtitle,
  autoPlayMs = 5200,
  href = (it) => `/gallery/${it.id}`,
}: {
  items: SpotlightItem[];
  title?: string;
  subtitle?: string;
  autoPlayMs?: number;
  href?: (it: SpotlightItem) => string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number } | null>(null);
  const movedRef = useRef(false);

  const count = items.length;
  const clamp = useCallback((i: number) => ((i % count) + count) % count, [count]);
  const go = useCallback((dir: -1 | 1) => setActive((a) => clamp(a + dir)), [clamp]);

  // keep the active index valid as the underlying list changes
  useEffect(() => {
    if (count > 0 && active >= count) setActive(0);
  }, [count, active]);

  // gentle auto-advance, paused on hover / drag
  useEffect(() => {
    if (paused || count <= 1 || autoPlayMs <= 0) return;
    const t = setInterval(() => setActive((a) => clamp(a + 1)), autoPlayMs);
    return () => clearInterval(t);
  }, [paused, count, autoPlayMs, clamp]);

  // arrow keys when the stage has focus
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  // pointer drag / swipe
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX };
    movedRef.current = false;
    setPaused(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 60) {
      go(dx < 0 ? 1 : -1);
      drag.current = { x: e.clientX };
      movedRef.current = true;
    }
  };
  const endDrag = () => {
    drag.current = null;
    setPaused(false);
  };

  if (count === 0) return null;

  const activeItem = items[active];

  return (
    <section
      className="spotlight"
      style={glowVars(activeItem.hueKey ?? activeItem.id)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="spotlight-hd">
        <div>
          <p className="t-label t-eyebrow">{title}</p>
          {subtitle && <p className="t-sm muted" style={{ marginTop: 2 }}>{subtitle}</p>}
        </div>
        <div className="spotlight-nav">
          <button className="spot-arrow" onClick={() => go(-1)} aria-label="Previous">
            <Icon name="chevronRight" size={18} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button className="spot-arrow" onClick={() => go(1)} aria-label="Next">
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>

      <div
        className="spotlight-stage"
        ref={stageRef}
        tabIndex={0}
        role="listbox"
        aria-label={title}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="spotlight-glow" aria-hidden />
        {items.map((it, i) => {
          // shortest signed distance on the ring → coverflow offset
          let off = i - active;
          if (off > count / 2) off -= count;
          if (off < -count / 2) off += count;
          const abs = Math.abs(off);
          const hidden = abs > 2;
          const isActive = off === 0;
          const vid = isVideoKind(it.content_type);
          const src = it.blob_url;
          const score = it.score;

          return (
            <article
              key={it.id}
              className={`spot-card ${isActive ? "on" : ""} ${hidden ? "ghost" : ""}`}
              style={{
                ...glowVars(it.hueKey ?? it.id),
                transform: `translate(-50%, -50%) translateX(${off * 56}%) scale(${
                  1 - abs * 0.16
                })`,
                zIndex: 30 - abs,
                opacity: hidden ? 0 : 1 - abs * 0.26,
                pointerEvents: hidden ? "none" : "auto",
              }}
              role="option"
              aria-selected={isActive}
              aria-hidden={hidden}
              onClick={() => {
                if (movedRef.current) {
                  movedRef.current = false;
                  return;
                }
                if (isActive) router.push(href(it));
                else setActive(i);
              }}
            >
              <div className="spot-art">
                <div className="mesh" />
                {src ? (
                  vid ? (
                    <video src={src} muted loop playsInline autoPlay={isActive} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={it.label ?? ""} loading="lazy" />
                  )
                ) : (
                  <div className="mglyph">
                    <Icon name={vid ? "video" : "image"} size={30} />
                  </div>
                )}
                <div className="spot-scrim" />

                {score != null && (
                  <span className={`spot-rating ${score >= 8 ? "hi" : score >= 5 ? "mid" : "lo"}`}>
                    {Number(score).toFixed(1)} <span className="spot-star">★</span>
                  </span>
                )}
                {vid && (
                  <span className="spot-kind">
                    <Icon name="play" size={11} />
                  </span>
                )}

                <div className="spot-meta">
                  <span className="spot-title">{it.label || `Render #${it.id}`}</span>
                  {isActive && (
                    <div className="spot-chips">
                      {it.project && <span className="spot-chip">{it.project}</span>}
                      <span className="spot-chip">
                        {vid ? `video${it.duration_s ? ` · ${it.duration_s}s` : ""}` : "image"}
                      </span>
                      {it.created_at && <span className="spot-chip">{relTime(it.created_at)}</span>}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="spotlight-dots">
        {items.map((it, i) => (
          <button
            key={it.id}
            className={`spot-dot ${i === active ? "on" : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Go to ${it.label || `render ${it.id}`}`}
          />
        ))}
      </div>
    </section>
  );
}
