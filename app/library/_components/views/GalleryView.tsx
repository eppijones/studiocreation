"use client";

import { useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import styles from "../../library.module.css";
import { type Asset, THUMB_KIND, fmtDur, fmtSize, resLabel, hueFor } from "../lib";
import { type CardCtx } from "./ctx";
import { useSpriteMeta, frameFromRatio, spriteStyle } from "../SpriteScrub";

/* A filmstrip cell with hover-scrub (reuses the sprite primitive). */
function StripCell({ a, current, ctx }: { a: Asset; current: boolean; ctx: CardCtx }) {
  const tk = THUMB_KIND[a.kind];
  const s = ctx.stateMeta(a.review_state);
  const isVideo = a.kind === "video";
  const [hovering, setHovering] = useState(false);
  const [frame, setFrame] = useState<number | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const sprite = useSpriteMeta(a.id, isVideo && hovering);
  const scrubbing = !!(sprite && frame != null);
  return (
    <button
      ref={ref}
      className={`${styles.stripCell} ${current ? styles.stripOn : ""}`}
      style={{ ["--hue" as string]: hueFor(a.filename) }}
      onClick={() => ctx.onInspect(a)}
      onDoubleClick={() => ctx.onOpen(a)}
      onMouseEnter={isVideo ? () => setHovering(true) : undefined}
      onMouseLeave={isVideo ? () => { setHovering(false); setFrame(null); } : undefined}
      onMouseMove={isVideo ? (e) => {
        if (!sprite || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        setFrame(frameFromRatio(sprite, Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))));
      } : undefined}
      title={a.filename}
    >
      <div className={styles.mesh} />
      {tk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/library/media/${a.id}/${tk}`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      )}
      {scrubbing && <div className={styles.spriteLayer} style={spriteStyle(sprite!, frame!, a.id)} />}
      {s && <span className={styles.stripDot} style={{ background: s.color, boxShadow: `0 0 7px ${s.color}` }} />}
      {fmtDur(a.duration_s) && <span className={styles.stripDur}>{fmtDur(a.duration_s)}</span>}
    </button>
  );
}

/* Gallery view — a large hero for the active asset above a filmstrip of every
   asset in the current result set. Clicking a frame inspects it; the hero "Open"
   button jumps to the full review tool. */
export function GalleryView({ assets, activeId, ctx }: { assets: Asset[]; activeId: number | null; ctx: CardCtx }) {
  if (assets.length === 0) return null;
  const hero = assets.find((a) => a.id === activeId) ?? assets[0];
  const st = ctx.stateMeta(hero.review_state);
  const tk = THUMB_KIND[hero.kind];
  const rating = hero.rating ?? 0;

  return (
    <div className={styles.galleryView}>
      <div className={styles.hero} style={{ ["--hue" as string]: hueFor(hero.filename) }}>
        <div className={styles.mesh} />
        {tk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`img-${hero.id}`} className={styles.heroImg} src={`/api/library/media/${hero.id}/${tk}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div className={styles.heroGrain} />
        <div className={styles.heroScrim} />
        <div className={styles.heroVignette} />
        <div className={styles.heroTop}>
          {st && (
            <span className={styles.heroBadge}>
              <span className={styles.dot} style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
              {st.label}
            </span>
          )}
        </div>
        {hero.kind === "video" && <span className={styles.heroPlay} onClick={() => ctx.onOpen(hero)}><Icon name="play" size={26} /></span>}
        <div className={styles.heroFoot} key={`foot-${hero.id}`}>
          <div className={styles.heroInfo}>
            <span className={styles.heroName}>{hero.filename}</span>
            <div className={styles.heroMeta}>
              {resLabel(hero.height) && <span>{resLabel(hero.height)}</span>}
              {hero.codec && <span>{hero.codec}</span>}
              {fmtDur(hero.duration_s) && <span>{fmtDur(hero.duration_s)}</span>}
              {fmtSize(hero.size_bytes) && <span>{fmtSize(hero.size_bytes)}</span>}
              {rating > 0 && <span className={styles.heroStars}>{"★".repeat(rating)}</span>}
            </div>
          </div>
          <button className={styles.heroBtn} onClick={() => ctx.onOpen(hero)}>
            <Icon name="expand" size={14} /> Open
          </button>
        </div>
      </div>

      <div className={styles.sectionHd}>
        <span className={styles.sectionLabel}>Filmstrip</span>
        <span className={styles.sectionN}>{assets.length}</span>
        <span className={styles.sectionLine} />
      </div>
      <div className={styles.strip}>
        {assets.map((a) => <StripCell key={a.id} a={a} current={a.id === hero.id} ctx={ctx} />)}
      </div>
    </div>
  );
}
