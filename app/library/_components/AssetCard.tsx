"use client";

import { useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import styles from "../library.module.css";
import {
  type Asset, type ReviewState, THUMB_KIND, KIND_ICON,
  fmtDur, fmtSize, resLabel, resColor, hueFor,
} from "./lib";
import { useSpriteMeta, frameFromRatio, spriteStyle } from "./SpriteScrub";

/* One footage card — the design's AssetCard: 16:9 thumb with status pill,
   duration / comment badges and a selection checkbox, then a meta row with
   filename + resolution and codec · proxy · stars. Single-click inspects,
   double-click opens the full detail route, checkbox toggles multi-select. */
export function AssetCard({
  asset: a, state, inspected, selected, selectMode, index = 0,
  onInspect, onOpen, onToggleSelect, onContextMenu, onDragStart,
}: {
  asset: Asset;
  state: ReviewState | null;
  inspected: boolean;
  selected: boolean;
  selectMode: boolean;
  index?: number;
  onInspect: () => void;
  onOpen: () => void;
  onToggleSelect: (shift: boolean) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const tk = THUMB_KIND[a.kind];
  const dur = fmtDur(a.duration_s);
  const rating = a.rating ?? 0;
  const res = resLabel(a.height);
  const size = fmtSize(a.size_bytes);

  // Hover-scrub: video cards scrub their sprite sheet under the cursor.
  const isVideo = a.kind === "video";
  const [hovering, setHovering] = useState(false);
  const [frame, setFrame] = useState<number | null>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const sprite = useSpriteMeta(a.id, isVideo && hovering);
  const scrubbing = !!(sprite && frame != null);
  const onThumbMove = (e: React.MouseEvent) => {
    if (!sprite || !thumbRef.current) return;
    const r = thumbRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setFrame(frameFromRatio(sprite, ratio));
  };

  return (
    <div
      className={`${styles.card} ${inspected ? styles.cardOn : ""} ${selected ? styles.cardSel : ""}`}
      style={{ ["--i" as string]: Math.min(index, 8) }}
      role="button"
      tabIndex={0}
      aria-label={a.filename}
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); onToggleSelect(e.shiftKey); }
        else if (selectMode) onToggleSelect(false);
        else onInspect();
      }}
      onDoubleClick={(e) => { e.preventDefault(); onOpen(); }}
      onKeyDown={(e) => {
        // Enter opens the full review tool; Space toggles selection (listbox-style).
        if (e.key === "Enter") { e.preventDefault(); onOpen(); }
        else if (e.key === " ") { e.preventDefault(); onToggleSelect(false); }
      }}
      onContextMenu={onContextMenu}
      title={a.rel_path}
    >
      <div
        ref={thumbRef}
        className={`${styles.thumb} ${a.kind === "audio" ? styles.thumbAudio : ""}`}
        style={{ ["--hue" as string]: hueFor(a.filename) }}
        onMouseEnter={isVideo ? () => setHovering(true) : undefined}
        onMouseLeave={isVideo ? () => { setHovering(false); setFrame(null); } : undefined}
        onMouseMove={isVideo ? onThumbMove : undefined}
      >
        <div className={styles.mesh} />
        {tk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/library/media/${a.id}/${tk}`}
            alt=""
            loading="lazy"
            draggable={false}
            onError={(e) => { (e.currentTarget.style.display = "none"); }}
          />
        ) : (
          <span className={styles.thumbIcon}><Icon name={KIND_ICON[a.kind]} size={34} /></span>
        )}
        {/* sprite-scrub frame layer — fades in over the poster while hovering a video */}
        {scrubbing && <div className={styles.spriteLayer} style={spriteStyle(sprite!, frame!, a.id)} />}
        <div className={styles.thumbScrim} />

        {/* status pill (top-left) */}
        {state && (
          <span className={styles.thumbState}>
            <span className={styles.dot} style={{ background: state.color, boxShadow: `0 0 8px ${state.color}` }} />
            {state.label}
          </span>
        )}

        {/* selection checkbox (top-right) */}
        <button
          className={`${styles.check} ${selected ? styles.checkOn : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e.shiftKey); }}
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${a.filename}`}
          title={selected ? "Deselect" : "Select"}
        >
          {selected && <Icon name="check" size={12} />}
        </button>

        {a.kind === "video" && <span className={`${styles.playPip} ${scrubbing ? styles.playPipHide : ""}`}><Icon name="play" size={26} /></span>}
        {dur && <span className={styles.dur}>{dur}</span>}
        {a.open_comments > 0 && (
          <span className={styles.cmt}><Icon name="captions" size={11} /> {a.open_comments}</span>
        )}
        {/* hover-scrub progress line — scaleX (composited) so mousemove never thrashes layout */}
        {scrubbing && sprite && (
          <span className={styles.scrubBar} style={{ ["--p" as string]: (frame! + 0.5) / sprite.count }} />
        )}
      </div>

      <div className={styles.cardMeta}>
        <div className={styles.cardTop}>
          <span className={styles.fname} title={a.filename}>{a.filename}</span>
          {res && <span className={styles.resTag} style={{ color: resColor(a.height) }}>{res}</span>}
        </div>
        <div className={styles.cardSub}>
          {a.codec && <span>{a.codec}</span>}
          {a.codec && (size || rating > 0) && <span className={styles.subDot} />}
          {size && <span>{size}</span>}
          <span className={styles.grow} />
          {rating > 0 && (
            <span className={styles.stars} aria-label={`${rating} of 5`}>{"★".repeat(rating)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
