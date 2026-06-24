"use client";

import { useRef } from "react";
import styles from "../library.module.css";
import { hueFor } from "./lib";

/* One folder tile — the design's Folder component: a stacked "stack of frames"
   above a folder body. Per-folder colour is a deterministic hue hash of the name
   (mesh art, no fabricated thumbnails), so each archive folder keeps a stable look. */
export function FolderCard({
  name, count, isDrop, up, index = 0,
  onOpen, onContextMenu, onDragOver, onDragLeave, onDrop,
}: {
  name: string;
  count?: number;
  isDrop?: boolean;
  up?: boolean;
  index?: number;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const hue = hueFor(name);
  const style = {
    ["--hue" as string]: hue,
    ["--hue2" as string]: (hue + 40) % 360,
    ["--hue3" as string]: (hue + 320) % 360,
    ["--i" as string]: Math.min(index, 8),
  } as React.CSSProperties;

  // Pointer-driven parallax — write CSS vars straight to the node (no re-render per
  // move). Disabled under reduced-motion. Skipped for the plain "up one level" tile.
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const parallax = !up && !reduce;
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", String(((e.clientX - r.left) / r.width) * 2 - 1));
    el.style.setProperty("--py", String(((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const reset = () => { const el = ref.current; if (el) { el.style.setProperty("--px", "0"); el.style.setProperty("--py", "0"); } };

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.folder} ${isDrop ? styles.folderDrop : ""} ${up ? styles.folderUp : ""}`}
      style={style}
      onClick={onOpen}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseMove={parallax ? onMove : undefined}
      onMouseLeave={parallax ? reset : undefined}
      title={up ? "Up one level" : `${name} — open · drop assets to move here`}
    >
      <div className={styles.folderArt}>
        {up ? (
          <div className={styles.folderUpGlyph}>↑</div>
        ) : (
          <>
            <div className={`${styles.frame} ${styles.frame3}`} />
            <div className={`${styles.frame} ${styles.frame2}`} />
            <div className={`${styles.frame} ${styles.frame1}`} />
            <div className={styles.folderBody}>
              {count != null && <span className={styles.folderCount}>{count}</span>}
            </div>
          </>
        )}
      </div>
      <div className={styles.folderLabel}>
        <span className={styles.folderSquare} />
        <span className={styles.folderName} title={name}>{name}</span>
      </div>
      {!up && count != null && (
        <span className={styles.folderMeta}>{count} item{count === 1 ? "" : "s"}</span>
      )}
    </button>
  );
}
