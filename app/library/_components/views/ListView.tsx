"use client";

import styles from "../../library.module.css";
import { type Asset, fmtSize, resLabel, resColor } from "../lib";
import { type CardCtx } from "./ctx";

/* List view — a dense table. Only columns we actually have data for (no fabricated
   fps/modified). Row click inspects, double-click opens the full review tool. */
export function ListView({ assets, ctx }: { assets: Asset[]; ctx: CardCtx }) {
  return (
    <div className={styles.list}>
      <div className={`${styles.listRow} ${styles.listHead}`}>
        <span>Name</span><span>Review</span><span>Res</span><span>Codec</span>
        <span>Rating</span><span>Size</span>
      </div>
      {assets.map((a, i) => {
        const st = ctx.stateMeta(a.review_state);
        const rating = a.rating ?? 0;
        const res = resLabel(a.height);
        const sel = ctx.isSelected(a.id);
        const insp = ctx.isInspected(a.id);
        return (
          <div
            key={a.id}
            className={`${styles.listRow} ${insp ? styles.listOn : ""} ${sel ? styles.listSel : ""}`}
            style={{ ["--i" as string]: Math.min(i, 12) }}
            role="button"
            tabIndex={0}
            aria-label={a.filename}
            draggable
            onDragStart={(e) => ctx.onDragStart(e, a)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); ctx.onToggleSelect(a, e.shiftKey); }
              else if (ctx.selectMode) ctx.onToggleSelect(a, false);
              else ctx.onInspect(a);
            }}
            onDoubleClick={() => ctx.onOpen(a)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); ctx.onOpen(a); }
              else if (e.key === " ") { e.preventDefault(); ctx.onToggleSelect(a, false); }
            }}
            onContextMenu={(e) => ctx.onContextMenu(e, a)}
          >
            <span className={styles.listName} title={a.rel_path}>
              <button
                className={`${styles.check} ${styles.checkInline} ${sel ? styles.checkOn : ""}`}
                onClick={(e) => { e.stopPropagation(); ctx.onToggleSelect(a, e.shiftKey); }}
                role="checkbox"
                aria-checked={sel}
                aria-label={`Select ${a.filename}`}
              >{sel && "✓"}</button>
              {a.filename}
            </span>
            <span className={styles.listState}>
              {st && <span className={styles.dot} style={{ background: st.color, boxShadow: `0 0 7px -1px ${st.color}` }} />}
              {st?.label ?? "—"}
            </span>
            <span className={styles.mono} style={{ color: resColor(a.height) }}>{res ?? "—"}</span>
            <span className={styles.mono}>{a.codec ?? "—"}</span>
            <span className={styles.stars}>{rating > 0 ? "★".repeat(rating) : "—"}</span>
            <span className={styles.mono}>{fmtSize(a.size_bytes) ?? "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
