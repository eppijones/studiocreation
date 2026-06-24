"use client";

import { type ReactNode } from "react";
import styles from "../../library.module.css";
import { AssetCard } from "../AssetCard";
import { type Asset } from "../lib";
import { type CardCtx, cardProps } from "./ctx";

function SectionHd({ label, n }: { label: string; n: number }) {
  return (
    <div className={styles.sectionHd}>
      <span className={styles.sectionLabel}>{label}</span>
      <span className={styles.sectionN}>{n}</span>
      <span className={styles.sectionLine} />
    </div>
  );
}

/* Grid view — the design's primary content. Explorer mode shows a Folders section
   (pre-rendered FolderCards) above a Footage section; flat (search/collection) mode
   shows only footage. `extra` carries un-indexed file tiles in explorer mode. */
export function GridView({
  folders, assets, extra, ctx, loading,
}: {
  folders?: ReactNode[];
  assets: Asset[];
  extra?: ReactNode[];
  ctx: CardCtx;
  loading?: boolean;
}) {
  const fileCount = assets.length + (extra?.length ?? 0);
  // First-load skeleton — shimmering placeholder cards while the feed resolves.
  if (loading && fileCount === 0 && !(folders && folders.length > 0)) {
    return (
      <div className={styles.gridView}>
        <div className={styles.cardGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div className={styles.skelCard} key={i}>
              <div className={`${styles.skel} ${styles.skelThumb}`} />
              <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "70%" }} />
              <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "45%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={styles.gridView}>
      {folders && folders.length > 0 && (
        <>
          <SectionHd label="Folders" n={folders.length} />
          <div className={styles.folderGrid}>{folders}</div>
        </>
      )}
      {(fileCount > 0 || folders) && <SectionHd label="Footage" n={fileCount} />}
      <div className={styles.cardGrid}>
        {assets.map((a, i) => <AssetCard key={a.id} index={i} {...cardProps(a, ctx)} />)}
        {extra}
      </div>
    </div>
  );
}
