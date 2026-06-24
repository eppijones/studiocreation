"use client";

import { Icon } from "../../components/Icon";
import styles from "../library.module.css";
import { type Status, type Collection, hueFor } from "./lib";

export interface SmartFolder { kind: "review" | "uhd"; key: string; label: string; color: string; }

/* Pane 2 — the library tree. Sources (root / recents / favorites), Smart Folders
   (built data-driven from review states + a 4K preset), the real footage-archive
   folder tree, and Collections. Drag-drop targets for moves / add-to-collection
   are preserved on the folder + collection rows. Purely presentational. */
export function LibraryTree({
  status, activeFolder, activeCollection, smart, searchActive, smartFolders,
  onRoot, onRecents, onFavorites, onSmart, onFolder, onCollection, onNewCollection,
  dropFolder, dropColl, onFolderDragOver, onFolderDragLeave, onFolderDrop,
  onCollDragOver, onCollDragLeave, onCollDrop,
}: {
  status: Status | null;
  activeFolder: string;
  activeCollection: Collection | null;
  smart: string;
  searchActive: boolean;
  smartFolders: SmartFolder[];
  onRoot: () => void;
  onRecents: () => void;
  onFavorites: () => void;
  onSmart: (s: SmartFolder) => void;
  onFolder: (folder: string) => void;
  onCollection: (c: Collection) => void;
  onNewCollection: () => void;
  dropFolder: string | null;
  dropColl: number | null;
  onFolderDragOver: (e: React.DragEvent, folder: string) => void;
  onFolderDragLeave: (folder: string) => void;
  onFolderDrop: (e: React.DragEvent, folder: string) => void;
  onCollDragOver: (e: React.DragEvent, c: Collection) => void;
  onCollDragLeave: (c: Collection) => void;
  onCollDrop: (e: React.DragEvent, c: Collection) => void;
}) {
  const folders = status?.folders ?? [];
  const collections = status?.collections ?? [];
  const rootOn = !activeCollection && !smart && !searchActive && activeFolder === "";

  return (
    <aside className={styles.tree}>
      <div className={styles.treeSection}>
        <div className={styles.treeHd}>Sources</div>
        <button className={`${styles.treeItem} ${rootOn ? styles.treeOn : ""}`} onClick={onRoot}>
          <Icon name="layers" size={15} /> All footage
          {status && <span className={styles.treeN}>{status.total}</span>}
        </button>
        <button className={`${styles.treeItem} ${smart === "recents" ? styles.treeOn : ""}`} onClick={onRecents}>
          <Icon name="clock" size={15} /> Recents
        </button>
        <button className={`${styles.treeItem} ${smart === "favorites" ? styles.treeOn : ""}`} onClick={onFavorites}>
          <Icon name="star" size={15} /> Favorites
        </button>
      </div>

      {smartFolders.length > 0 && (
        <div className={styles.treeSection}>
          <div className={styles.treeHd}>Smart Folders</div>
          {smartFolders.map((s) => {
            const key = s.kind === "uhd" ? "uhd" : `review:${s.key}`;
            return (
              <button
                key={key}
                className={`${styles.treeItem} ${smart === key ? styles.treeOn : ""}`}
                onClick={() => onSmart(s)}
              >
                <span className={styles.treeDot} style={{ background: s.color, boxShadow: `0 0 8px -1px ${s.color}` }} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.treeSection}>
        <div className={styles.treeHd}>Footage Archive</div>
        {folders.length === 0 && <div className={styles.treeEmpty}>No folders yet</div>}
        {folders.map((f) => {
          const on = activeFolder === f.folder && !activeCollection && !smart;
          const isDrop = dropFolder === f.folder;
          const name = f.folder.split("/").pop() || f.folder;
          return (
            <button
              key={f.folder}
              className={`${styles.treeItem} ${styles.treeArchive} ${on ? styles.treeOn : ""} ${isDrop ? styles.treeDropOn : ""}`}
              onClick={() => onFolder(f.folder)}
              onDragOver={(e) => onFolderDragOver(e, f.folder)}
              onDragLeave={() => onFolderDragLeave(f.folder)}
              onDrop={(e) => onFolderDrop(e, f.folder)}
              title={`${f.folder} — browse · drop assets here to move`}
            >
              <span
                className={styles.treeSquare}
                style={{ background: `oklch(0.6 0.15 ${hueFor(name)})` }}
              />
              <span className={styles.treeLabel}>{name}</span>
              <span className={styles.treeN}>{f.n}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.treeSection}>
        <div className={styles.treeHd}>
          Collections
          <button className={styles.treeAdd} onClick={onNewCollection} title="New collection">
            <Icon name="plus" size={13} />
          </button>
        </div>
        {collections.length === 0 && <div className={styles.treeEmpty}>No collections yet</div>}
        {collections.map((c) => {
          const on = activeCollection?.id === c.id;
          const isDrop = dropColl === c.id;
          return (
            <button
              key={c.id}
              className={`${styles.treeItem} ${on ? styles.treeOn : ""} ${isDrop ? styles.treeDropOn : ""}`}
              onClick={() => onCollection(c)}
              onDragOver={(e) => onCollDragOver(e, c)}
              onDragLeave={() => onCollDragLeave(c)}
              onDrop={(e) => onCollDrop(e, c)}
              title={`${c.name} — drop assets here to add`}
            >
              <Icon name="layers" size={14} />
              <span className={styles.treeLabel}>{c.name}</span>
              <span className={styles.treeN}>{c.count}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
