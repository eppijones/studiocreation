"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import styles from "../../library.module.css";
import {
  type BrowseFolder, type BrowseFile, THUMB_KIND, DISPLAY_ICON,
  resLabel, hueFor, assetFromBrowseFile,
} from "../lib";
import { type CardCtx } from "./ctx";

interface Col { path: string; folders: BrowseFolder[]; files: BrowseFile[]; loading: boolean; }

/* Columns (Miller) view — macOS-Finder-style cascade. One column per level of the
   current path (root → … → current folder); selecting a folder in ANY column
   navigates there (truncating deeper columns), so you can step in and back up
   freely. The root column is always present, so you can never get stranded. */
export function ColumnsView({
  path, volumeId, rootLabel = "Library", onOpenFolder, activeId, ctx,
}: {
  path: string;
  volumeId: number | null;
  rootLabel?: string;
  onOpenFolder: (path: string) => void;
  activeId: number | null;
  ctx: CardCtx;
}) {
  const [cols, setCols] = useState<Col[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const segs = path ? path.split("/") : [];
    const prefixes = ["", ...segs.map((_, i) => segs.slice(0, i + 1).join("/"))];
    let cancelled = false;
    setCols(prefixes.map((p) => ({ path: p, folders: [], files: [], loading: true })));
    Promise.all(prefixes.map(async (p) => {
      const sp = new URLSearchParams();
      if (p) sp.set("path", p);
      if (volumeId != null) sp.set("volumeId", String(volumeId));
      try {
        const r = await fetch(`/api/library/browse?${sp.toString()}`);
        const d = await r.json();
        return { path: p, folders: d.folders ?? [], files: d.files ?? [], loading: false };
      } catch {
        return { path: p, folders: [], files: [], loading: false };
      }
    })).then((res) => { if (!cancelled) setCols(res); });
    return () => { cancelled = true; };
  }, [path, volumeId]);

  // Keep the deepest column in view when drilling in.
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols.length]);

  return (
    <div className={styles.columns} ref={scrollRef}>
      {cols.map((col, i) => {
        const trail = cols[i + 1]?.path; // the folder selected in this column (leads deeper)
        const label = i === 0 ? rootLabel : (col.path.split("/").pop() || rootLabel);
        const empty = !col.loading && col.folders.length === 0 && col.files.length === 0;
        return (
          <div className={styles.colList} key={col.path || "__root"}>
            <div className={styles.colHd}>{label}</div>
            {col.folders.map((f) => (
              <button
                key={`d:${f.path}`}
                className={`${styles.colItem} ${trail === f.path ? styles.colOn : ""}`}
                onClick={() => onOpenFolder(f.path)}
              >
                <span className={styles.colSquare} style={{ background: `oklch(0.6 0.15 ${hueFor(f.name)})` }} />
                <span className={styles.colName}>{f.name}</span>
                <span className={styles.colCount}>{f.count}</span>
                <Icon name="chevronRight" size={13} />
              </button>
            ))}
            {col.files.map((f) => {
              const a = f.asset ? assetFromBrowseFile(f, f.asset, volumeId) : null;
              const on = !!a && activeId === a.id;
              const tk = a ? THUMB_KIND[a.kind] : null;
              const s = a ? ctx.stateMeta(a.review_state) : null;
              return (
                <button
                  key={`f:${f.relPath}`}
                  className={`${styles.colItem} ${styles.colFile} ${on ? styles.colOn : ""}`}
                  onClick={() => { if (a) ctx.onInspect(a); }}
                  onDoubleClick={() => { if (a) ctx.onOpen(a); }}
                  disabled={!a}
                  title={f.name}
                >
                  <span className={styles.colThumb} style={{ ["--hue" as string]: hueFor(f.name) }}>
                    <span className={styles.mesh} />
                    {a && tk ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/library/media/${a.id}/${tk}`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <span className={styles.colFileIcon}><Icon name={a ? "film" : (DISPLAY_ICON[f.displayKind] ?? "copy")} size={14} /></span>
                    )}
                  </span>
                  <span className={styles.colFileMeta}>
                    <span className={styles.colName}>{f.name}</span>
                    <span className={styles.colSub}>{a ? (resLabel(a.height) ?? a.kind) : (f.ext || "file").toUpperCase()}</span>
                  </span>
                  {s && <span className={styles.dot} style={{ background: s.color, boxShadow: `0 0 7px ${s.color}` }} />}
                </button>
              );
            })}
            {col.loading && <div className={styles.colEmpty}>Loading…</div>}
            {empty && <div className={styles.colEmpty}>Empty folder</div>}
          </div>
        );
      })}
    </div>
  );
}
