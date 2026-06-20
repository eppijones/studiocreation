"use client";

/* ===================================================================
   MEDIA LIBRARY (StudioLibrary) — the footage archive surface.
   A WRITABLE index of produced files on disk (local test volume now,
   the on-prem archive in Oslo later). NOT the AI-render Gallery — separate
   data model, separate local Postgres. Shares the Portal One design system.

   Beyond browse + filter, this surface is a working media-management tool:
   review signals on every card, review/rating filters, multi-select with a
   bulk action bar, a right-click context menu, drag-and-drop onto folders
   and collections (real fs moves), and a collections panel. All file ops hit
   the writable local volume through /api/library/fs.
   =================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../components/Icon";
import styles from "./library.module.css";

interface Asset {
  id: number;
  kind: "video" | "image" | "audio" | "doc" | "project";
  filename: string;
  rel_path: string;
  codec: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  size_bytes: string | null;
  review_state: string | null;
  rating: number | null;
  open_comments: number;
  volume_id: number | null;
}
interface ReviewState { key: string; label: string; color: string; ord: number; kind: string | null; }
interface Collection { id: number; name: string; count: number; cover_asset_id: number | null; }
interface Volume { id: number; name: string; kind: string; read_only: boolean; assets: number; status: string; }

// ── file-explorer (browse) types — mirror /api/library/browse ──────────
type DisplayKind =
  | "video" | "image" | "audio" | "doc" | "project"
  | "archive" | "disk" | "installer" | "code" | "other";
interface BrowseAsset {
  id: number;
  kind: "video" | "image" | "audio" | "doc" | "project";
  review_state: string | null;
  rating: number | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  status: string;
  open_comments: number;
}
interface BrowseFile {
  name: string;
  ext: string;
  relPath: string;
  displayKind: DisplayKind;
  sizeBytes: number;
  asset: BrowseAsset | null;
}
interface BrowseFolder { name: string; path: string; count: number; }
interface BrowseResult {
  volumeId: number;
  path: string;
  breadcrumb: { name: string; path: string }[];
  folders: BrowseFolder[];
  files: BrowseFile[];
  readOnly: boolean;
  error?: string;
}
interface Status {
  total: number;
  byKind: { kind: string; n: number }[];
  byStatus: { status: string; n: number }[];
  jobs: Record<string, number>;
  volumes: Volume[];
  folders: { folder: string; n: number }[];
  facets: { codecs: string[]; kinds: string[] };
  reviewStates: ReviewState[];
  collections: Collection[];
  error?: string;
}

const THUMB_KIND: Record<string, string | null> = {
  video: "poster", image: "thumb", audio: "waveform", doc: "page_preview", project: null,
};
const KIND_ICON: Record<string, string> = {
  video: "film", image: "image", audio: "audio", doc: "download", project: "tools",
};
// Icon per file-explorer displayKind — covers non-indexed files too.
const DISPLAY_ICON: Record<DisplayKind, string> = {
  video: "film", image: "image", audio: "audio", doc: "briefs", project: "tools",
  archive: "layers", disk: "download", installer: "bolt", code: "cpu", other: "copy",
};
const KIND_ORDER = ["video", "image", "audio", "doc", "project"];

function fmtDur(s: number | null): string | null {
  if (!s || s <= 0) return null;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtSize(b: string | null): string | null {
  if (!b) return null;
  const n = Number(b);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
/** The folder portion of a rel_path (everything before the final segment). */
function folderOf(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i < 0 ? "" : relPath.slice(0, i);
}
/** Adapt an indexed explorer file (BrowseFile with non-null asset) to the
 *  Asset shape the card renderer expects, so explorer + search share one card. */
function assetFromBrowseFile(f: BrowseFile, a: BrowseAsset, volumeId: number | null): Asset {
  return {
    id: a.id,
    kind: a.kind,
    filename: f.name,
    rel_path: f.relPath,
    codec: a.codec,
    width: a.width,
    height: a.height,
    duration_s: a.duration_s,
    size_bytes: f.sizeBytes != null ? String(f.sizeBytes) : null,
    review_state: a.review_state,
    rating: a.rating,
    open_comments: a.open_comments,
    volume_id: volumeId,
  };
}

type ContextMenu = { x: number; y: number; asset: Asset } | null;
type SubMenu = "" | "collection" | "state" | "move";

export default function MediaLibraryPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [codec, setCodec] = useState("");
  const [minHeight, setMinHeight] = useState(0);
  // `path` is the current explorer folder ("" = root). `folder` mirrors it for
  // the recursive assets query (search/filter mode), so search is scoped to the
  // folder the user is browsing.
  const [path, setPath] = useState("");
  const folder = path;
  const [sort, setSort] = useState("recent");
  // Review + rating filters.
  const [reviewState, setReviewState] = useState("");
  const [minRating, setMinRating] = useState(0);
  // Collection-mode: when set we show that collection's assets instead of the feed.
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);

  // File-explorer (browse) state — the default view.
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Selection + interaction state.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const lastClicked = useRef<number | null>(null);
  const [menu, setMenu] = useState<ContextMenu>(null);
  const [menuSub, setMenuSub] = useState<SubMenu>("");
  const [bar, setBar] = useState<SubMenu>(""); // open bulk-bar submenu
  const [dropFolder, setDropFolder] = useState<string | null>(null); // highlighted drop target (rail folder)
  const [dropColl, setDropColl] = useState<number | null>(null); // highlighted drop target (collection)
  const [dropTile, setDropTile] = useState<string | null>(null); // highlighted drop target (explorer folder tile)
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; folder: BrowseFolder } | null>(null);
  const dragIds = useRef<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload (OS file-drop overlay + toolbar button).
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileDrag, setFileDrag] = useState(false); // OS files dragged over the page
  const fileDragDepth = useRef(0); // dragenter/leave counter so nested elements don't flicker

  // ── view mode ────────────────────────────────────────────────────
  // Three modes, picked in priority order:
  //   collection → a collection is active (existing behaviour)
  //   search     → a query OR any filter is active (existing flat results)
  //   explorer   → the default Finder-style browse of the current `path`
  const searchActive =
    q.trim() !== "" || kinds.size > 0 || codec !== "" ||
    minHeight > 0 || reviewState !== "" || minRating > 0;
  const viewMode: "collection" | "search" | "explorer" =
    activeCollection ? "collection" : searchActive ? "search" : "explorer";

  // ── data loaders ─────────────────────────────────────────────────
  const loadStatus = useCallback(() => {
    fetch("/api/library/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const volumeId = status?.volumes[0]?.id ?? null;

  // Explorer browse loader — immediate folders + files of `path`.
  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true);
    const p = new URLSearchParams();
    if (path) p.set("path", path);
    if (volumeId != null) p.set("volumeId", String(volumeId));
    try {
      const r = await fetch(`/api/library/browse?${p.toString()}`);
      const d = (await r.json()) as BrowseResult;
      setBrowse(d?.error ? null : d);
    } catch {
      setBrowse(null);
    } finally {
      setBrowseLoading(false);
    }
  }, [path, volumeId]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    // Collection mode short-circuits the feed query.
    if (activeCollection) {
      try {
        const r = await fetch(`/api/library/collections/${activeCollection.id}`);
        const d = await r.json();
        setAssets((d.assets as Asset[]) ?? []);
      } catch {
        setAssets([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (kinds.size) p.set("kinds", [...kinds].join(","));
    if (codec) p.set("codec", codec);
    if (minHeight) p.set("minHeight", String(minHeight));
    if (folder) p.set("folder", folder);
    if (reviewState) p.set("reviewState", reviewState);
    if (minRating) p.set("minRating", String(minRating));
    if (sort) p.set("sort", sort);
    p.set("limit", "300");
    try {
      const r = await fetch(`/api/library/assets?${p.toString()}`);
      const d = await r.json();
      setAssets((d.assets as Asset[]) ?? []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [q, kinds, codec, minHeight, folder, reviewState, minRating, sort, activeCollection]);

  // Reload whichever view is currently showing (after a write op).
  const reload = useCallback(() => {
    if (viewMode === "explorer") loadBrowse();
    else loadAssets();
  }, [viewMode, loadBrowse, loadAssets]);

  // Debounced reload on any filter / path change. Explorer mode pulls the
  // on-disk browse; search + collection modes pull the flat assets feed.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (viewMode === "explorer") loadBrowse();
      else loadAssets();
    }, 220);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [viewMode, loadBrowse, loadAssets]);

  // Dismiss context menus on outside click / Escape (asset menu + folder menu).
  useEffect(() => {
    if (!menu && !folderMenu) return;
    const close = () => { setMenu(null); setMenuSub(""); setFolderMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey); };
  }, [menu, folderMenu]);

  // ── helpers ──────────────────────────────────────────────────────
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const toggleKind = (k: string) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const stateMeta = useCallback(
    (key: string | null): ReviewState | null =>
      key ? status?.reviewStates.find((s) => s.key === key) ?? null : null,
    [status]
  );

  const clearSelection = () => { setSelected(new Set()); setBar(""); };

  // Click-to-toggle selection (with shift-range as a bonus).
  const toggleSelect = (id: string | number, shift: boolean) => {
    const nid = Number(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked.current != null) {
        // Range select between the last anchor and this card, in display order.
        const order = assets.map((a) => a.id);
        const a = order.indexOf(lastClicked.current);
        const b = order.indexOf(nid);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(order[i]);
          return next;
        }
      }
      if (next.has(nid)) next.delete(nid); else next.add(nid);
      return next;
    });
    lastClicked.current = nid;
  };

  // ── write operations (each loops over a target set) ───────────────
  const idsToActOn = (anchor: Asset): number[] =>
    selected.has(anchor.id) && selected.size > 0 ? [...selected] : [anchor.id];

  const volumeFor = useCallback(
    (a: Asset | undefined): number | null =>
      a?.volume_id ?? status?.volumes[0]?.id ?? null,
    [status]
  );

  const moveAssets = useCallback(async (ids: number[], destFolder: string) => {
    let moved = 0;
    for (const id of ids) {
      try {
        const r = await fetch("/api/library/fs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "moveAsset", assetId: id, destFolder }),
        });
        const d = await r.json();
        if (d.moved || d.ok) moved++;
      } catch { /* keep going; report at the end */ }
    }
    flash(`Moved ${moved} asset${moved === 1 ? "" : "s"} → ${destFolder || "root"}`);
    clearSelection();
    reload();
    loadStatus();
  }, [flash, reload, loadStatus]);

  const addToCollection = useCallback(async (collectionId: number, ids: number[], label: string) => {
    try {
      await fetch("/api/library/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", collectionId, assetIds: ids }),
      });
      flash(`Added ${ids.length} to “${label}”`);
    } catch { flash("Couldn’t add to collection"); }
    clearSelection();
    loadStatus();
    if (activeCollection?.id === collectionId) loadAssets();
  }, [flash, loadStatus, loadAssets, activeCollection]);

  const newCollection = useCallback(async (ids: number[]): Promise<void> => {
    const name = window.prompt("New collection name");
    if (!name?.trim()) return;
    try {
      await fetch("/api/library/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: name.trim(), assetIds: ids.length ? ids : undefined }),
      });
      flash(`Created “${name.trim()}”`);
    } catch { flash("Couldn’t create collection"); }
    clearSelection();
    loadStatus();
  }, [flash, loadStatus]);

  const setStateFor = useCallback(async (ids: number[], state: string, label: string) => {
    for (const id of ids) {
      try {
        await fetch("/api/library/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: id, action: "state", state }),
        });
      } catch { /* keep going */ }
    }
    flash(`Set ${ids.length} → ${label}`);
    clearSelection();
    reload();
    loadStatus();
  }, [flash, reload, loadStatus]);

  const rateFor = useCallback(async (ids: number[], rating: number) => {
    for (const id of ids) {
      try {
        await fetch("/api/library/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: id, action: "rating", rating }),
        });
      } catch { /* keep going */ }
    }
    flash(`Rated ${ids.length} → ${rating === 0 ? "cleared" : `${rating}★`}`);
    clearSelection();
    reload();
  }, [flash, reload]);

  const renameAsset = useCallback(async (a: Asset) => {
    const name = window.prompt("Rename file", a.filename);
    if (!name?.trim() || name.trim() === a.filename) return;
    const vol = volumeFor(a);
    if (vol == null) return;
    try {
      await fetch("/api/library/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "rename", volumeId: vol, path: a.rel_path, name: name.trim() }),
      });
      flash(`Renamed → ${name.trim()}`);
    } catch { flash("Rename failed"); }
    reload();
  }, [flash, reload, volumeFor]);

  const deleteAssets = useCallback(async (ids: number[]) => {
    if (!window.confirm(`Move ${ids.length} asset${ids.length === 1 ? "" : "s"} to the trash?`)) return;
    let n = 0;
    for (const id of ids) {
      try {
        const r = await fetch("/api/library/fs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "delete", assetId: id, mode: "trash" }),
        });
        const d = await r.json();
        if (d.deleted || d.ok) n++;
      } catch { /* keep going */ }
    }
    flash(`Trashed ${n} asset${n === 1 ? "" : "s"}`);
    clearSelection();
    reload();
    loadStatus();
  }, [flash, reload, loadStatus]);

  const copyPath = useCallback((a: Asset) => {
    navigator.clipboard?.writeText(a.rel_path).then(
      () => flash("Path copied"),
      () => flash("Couldn’t copy path")
    );
  }, [flash]);

  const makeFolder = useCallback(async () => {
    const name = window.prompt("New folder name");
    if (!name?.trim()) return;
    const vol = status?.volumes[0]?.id;
    if (vol == null) { flash("No writable volume"); return; }
    const path = folder ? `${folder}/${name.trim()}` : name.trim();
    try {
      await fetch("/api/library/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "mkdir", volumeId: vol, path }),
      });
      flash(`Folder created → ${path}`);
    } catch { flash("Couldn’t create folder"); }
    reload();
    loadStatus();
  }, [flash, folder, status, reload, loadStatus]);

  const shareAssets = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const r = await fetch("/api/library/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "asset", targetId: ids[0],
          allowComments: true, allowDownload: false, expiresInDays: 30,
        }),
      });
      const d = await r.json();
      const token = d?.link?.token;
      if (token) {
        const url = `${window.location.origin}/library/share/${token}`;
        navigator.clipboard?.writeText(url).catch(() => {});
        flash(`Share link copied · ${url}`);
      } else {
        flash("Couldn’t create share link");
      }
    } catch { flash("Share failed"); }
  }, [flash]);

  // ── upload (OS files → /api/library/upload) ──────────────────────
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const volId = status?.volumes[0]?.id;
    if (volId == null) { flash("No writable volume"); return; }
    // Uploads target the CURRENT explorer `path`. Collection mode has no folder
    // of its own — land at root in that case.
    const dest = activeCollection ? "" : path;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("volumeId", String(volId));
      fd.set("destFolder", dest);
      for (const f of files) fd.append("files", f);
      const r = await fetch("/api/library/upload", { method: "POST", body: fd });
      const d = (await r.json()) as { added?: { id: number; relPath: string; kind: string }[]; skipped?: string[]; error?: string };
      if (!r.ok || d.error) {
        flash(d.error ? `Upload failed · ${d.error}` : "Upload failed");
        return;
      }
      const n = d.added?.length ?? 0;
      const skipped = d.skipped?.length ?? 0;
      flash(`Uploaded ${n} file${n === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
      reload();
      loadStatus();
    } catch {
      flash("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [status, activeCollection, path, flash, reload, loadStatus]);

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ""; // reset so picking the same file again re-fires
    uploadFiles(files);
  };

  // Whole-page OS-file drop. Gated on the "Files" type so internal card drags
  // (which only carry text/plain) never trip the overlay.
  const dragHasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const onPageDragEnter = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    fileDragDepth.current += 1;
    setFileDrag(true);
  };
  const onPageDragOver = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onPageDragLeave = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
    if (fileDragDepth.current === 0) setFileDrag(false);
  };
  const onPageDrop = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    fileDragDepth.current = 0;
    setFileDrag(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    uploadFiles(files);
  };

  // ── compare (2–4 selected videos → side-by-side route) ───────────
  const selectedVideoIds = useMemo(
    () => assets.filter((a) => selected.has(a.id) && a.kind === "video").map((a) => a.id),
    [assets, selected]
  );
  const canCompare = selectedVideoIds.length >= 2 && selectedVideoIds.length <= 4;
  const openCompare = () => {
    if (!canCompare) return;
    router.push(`/library/compare?ids=${selectedVideoIds.join(",")}`);
  };

  // ── drag-and-drop ────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, a: Asset) => {
    // Drag the whole selection if this card is part of it; else just this card.
    const ids = selected.has(a.id) && selected.size > 0 ? [...selected] : [a.id];
    dragIds.current = ids;
    e.dataTransfer.setData("text/plain", ids.join(","));
    e.dataTransfer.effectAllowed = "move";
  };
  const dropOnFolder = (e: React.DragEvent, destFolder: string) => {
    e.preventDefault();
    setDropFolder(null);
    const ids = dragIds.current;
    if (ids.length) moveAssets(ids, destFolder);
    dragIds.current = [];
  };
  const dropOnCollection = (e: React.DragEvent, c: Collection) => {
    e.preventDefault();
    setDropColl(null);
    const ids = dragIds.current;
    if (ids.length) addToCollection(c.id, ids, c.name);
    dragIds.current = [];
  };
  // Dropping cards onto an explorer folder tile moves them into that folder.
  const dropOnTile = (e: React.DragEvent, destFolder: string) => {
    e.preventDefault();
    setDropTile(null);
    const ids = dragIds.current;
    if (ids.length) moveAssets(ids, destFolder);
    dragIds.current = [];
  };

  // ── explorer navigation + folder ops ─────────────────────────────
  // Navigate the explorer to a folder, clearing search/filters/collection so we
  // actually land in explorer mode (not the flat search results).
  const goExplorer = useCallback((p: string) => {
    setActiveCollection(null);
    setQ("");
    setKinds(new Set());
    setCodec("");
    setMinHeight(0);
    setReviewState("");
    setMinRating(0);
    setPath(p);
  }, []);

  const renameFolder = useCallback(async (f: BrowseFolder) => {
    const cur = f.name;
    const name = window.prompt("Rename folder", cur);
    if (!name?.trim() || name.trim() === cur) return;
    if (volumeId == null) { flash("No writable volume"); return; }
    try {
      await fetch("/api/library/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "rename", volumeId, path: f.path, name: name.trim() }),
      });
      flash(`Renamed folder → ${name.trim()}`);
    } catch { flash("Rename failed"); }
    loadBrowse();
    loadStatus();
  }, [volumeId, flash, loadBrowse, loadStatus]);

  const trashFolder = useCallback(async (f: BrowseFolder) => {
    if (!window.confirm(`Move folder “${f.name}” to the trash?`)) return;
    if (volumeId == null) { flash("No writable volume"); return; }
    try {
      await fetch("/api/library/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "trashFolder", volumeId, path: f.path }),
      });
      flash(`Trashed folder → ${f.name}`);
    } catch { flash("Couldn’t trash folder"); }
    loadBrowse();
    loadStatus();
  }, [volumeId, flash, loadBrowse, loadStatus]);

  // ── derived ──────────────────────────────────────────────────────
  const proxied = useMemo(
    () => status?.byStatus.find((s) => s.status === "proxied")?.n ?? 0,
    [status]
  );
  const queued = (status?.jobs.queued ?? 0) + (status?.jobs.running ?? 0);
  const vol = status?.volumes[0];
  const availableKinds = status?.facets.kinds ?? KIND_ORDER;
  const reviewStates = status?.reviewStates ?? [];
  const collections = status?.collections ?? [];
  const selCount = selected.size;
  const RATINGS = [
    { v: 0, label: "Any rating" },
    { v: 3, label: "≥ 3★" },
    { v: 4, label: "≥ 4★" },
    { v: 5, label: "5★ only" },
  ];

  // Exit collection mode + return the explorer to the volume root.
  const goAllFolders = () => goExplorer("");

  // ── shared asset card ────────────────────────────────────────────
  // Used by BOTH search/collection mode and the explorer's indexed-file tiles.
  // The kind badge now lives in the meta row (below the thumb), not over media.
  const renderCard = (a: Asset) => {
    const tk = THUMB_KIND[a.kind];
    const dur = fmtDur(a.duration_s);
    const sel = selected.has(a.id);
    const st = stateMeta(a.review_state);
    const rating = a.rating ?? 0;
    return (
      <div
        key={a.id}
        className={`${styles.card} ${sel ? styles.cardSel : ""}`}
        draggable
        onDragStart={(e) => onDragStart(e, a)}
        onClick={(e) => {
          // Cmd/Ctrl/Shift click selects; plain click opens.
          if (e.metaKey || e.ctrlKey || e.shiftKey) {
            e.preventDefault();
            toggleSelect(a.id, e.shiftKey);
          } else if (selCount > 0) {
            // While in select mode, a plain click adds to selection.
            toggleSelect(a.id, false);
          } else {
            router.push(`/library/${a.id}`);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, asset: a });
          setMenuSub("");
        }}
      >
        <div className={`${styles.thumb} ${a.kind === "audio" ? styles.thumbAudio : ""}`}>
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
            <span className={styles.thumbIcon}><Icon name={KIND_ICON[a.kind]} size={40} /></span>
          )}

          {/* Hover/selected checkbox (top-right) — toggles, never navigates. */}
          <button
            className={`${styles.checkbox} ${sel ? styles.checkboxOn : ""}`}
            onClick={(e) => { e.stopPropagation(); toggleSelect(a.id, e.shiftKey); }}
            aria-label={sel ? "Deselect" : "Select"}
            title={sel ? "Deselect" : "Select"}
          >
            {sel && <Icon name="check" size={12} />}
          </button>

          {/* Nothing covers the media but the small duration pill + hover play. */}
          {a.kind === "video" && (
            <span className={styles.playPip}><Icon name="play" size={30} /></span>
          )}
          {dur && <span className={styles.dur}>{dur}</span>}
        </div>

        <div className={styles.meta}>
          <div className={styles.fname} title={a.filename}>{a.filename}</div>
          <div className={styles.fpath} title={a.rel_path}>
            {folderOf(a.rel_path) || "/"}
          </div>

          {/* Review signals row: read-only stars + open-comments badge. */}
          {(rating > 0 || a.open_comments > 0) && (
            <div className={styles.signals}>
              {rating > 0 && (
                <span className={styles.stars} aria-label={`${rating} of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={i <= rating ? styles.starOn : styles.starOff}>★</span>
                  ))}
                </span>
              )}
              {a.open_comments > 0 && (
                <span className={styles.commentBadge} title={`${a.open_comments} open comment(s)`}>
                  <Icon name="captions" size={12} /> {a.open_comments}
                </span>
              )}
            </div>
          )}

          {/* Spec chips — kind chip now lives here (off the thumbnail), beside
              resolution / codec / size + the review-state chip. */}
          <div className={styles.specs}>
            <span className={`${styles.spec} ${styles.kindChip}`}>
              <Icon name={KIND_ICON[a.kind]} size={11} /> {a.kind}
            </span>
            {a.height && <span className={styles.spec}>{a.height}p</span>}
            {a.codec && <span className={styles.spec}>{a.codec}</span>}
            {fmtSize(a.size_bytes) && <span className={styles.spec}>{fmtSize(a.size_bytes)}</span>}
            {st && (
              <span
                className={`${styles.spec} ${styles.stateChipMeta}`}
                style={{ background: `${st.color}26`, color: "#fff" }}
                title={st.label}
              >
                <span className={styles.stateDot} style={{ background: st.color }} />
                {st.label}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={styles.wrap}
      onDragEnter={onPageDragEnter}
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      {/* Hidden file input fed by the toolbar "Upload" button. */}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={onFilePicked}
      />

      {/* Whole-page OS-file drop overlay — only while dragging real files in. */}
      {fileDrag && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropOverlayInner}>
            <Icon name="download" size={34} />
            <div className={styles.dropOverlayText}>
              Drop to upload to {activeCollection || !folder ? "Media Library root" : folder}
            </div>
          </div>
        </div>
      )}

      {/* Uploading state — translucent backdrop while files are in flight. */}
      {uploading && (
        <div className={styles.uploadOverlay}>
          <div className={styles.dropOverlayInner}>
            <Icon name="hourglass" size={30} />
            <div className={styles.dropOverlayText}>Uploading…</div>
          </div>
        </div>
      )}

      <div className={styles.head}>
        <div>
          <div className={styles.title}>Media Library · footage archive</div>
          <div className={styles.count}>
            {status ? status.total : "—"}
            <small>assets indexed{vol ? ` · ${vol.name}` : ""}</small>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{proxied}</span>
            <span className={styles.statLbl}>proxied</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{queued}</span>
            <span className={styles.statLbl}>in queue</span>
          </div>
          {vol && (
            <div className={styles.stat}>
              <span className={`${styles.dot} ${vol.status === "active" ? styles.dotOk : styles.dotWarn}`} />
              <span className={styles.statLbl}>{vol.kind} volume</span>
            </div>
          )}
          <button
            className={styles.stat}
            style={{ cursor: "pointer", font: "inherit" }}
            onClick={() => router.push("/library/automation")}
            title="Automation rules"
          >
            <Icon name="spark" size={13} />
            <span className={styles.statLbl}>Automation</span>
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* ── filter / folder rail ─────────────────────────────── */}
        <aside className={styles.rail}>
          <div>
            <div className={styles.railHd}>Type</div>
            <div className={styles.filterGroup}>
              {availableKinds.map((k) => (
                <button
                  key={k}
                  className={`${styles.kindBtn} ${kinds.has(k) ? styles.kindOn : ""}`}
                  onClick={() => toggleKind(k)}
                >
                  <Icon name={KIND_ICON[k] ?? "grid"} size={12} />
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Review-state chips (single-select; click again to clear). */}
          {reviewStates.length > 0 && (
            <div>
              <div className={styles.railHd}>Review</div>
              <div className={styles.filterGroup}>
                {reviewStates.map((s) => {
                  const on = reviewState === s.key;
                  return (
                    <button
                      key={s.key}
                      className={`${styles.stateChip} ${on ? styles.stateChipOn : ""}`}
                      style={on
                        ? { background: s.color, borderColor: s.color, color: "#fff" }
                        : { borderColor: s.color }}
                      onClick={() => setReviewState(on ? "" : s.key)}
                    >
                      <span className={styles.stateDotSm} style={{ background: on ? "#fff" : s.color }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className={styles.railHd}>Min rating</div>
            <select className={styles.select} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              {RATINGS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </div>

          {(status?.facets.codecs.length ?? 0) > 0 && (
            <div>
              <div className={styles.railHd}>Codec</div>
              <select className={styles.select} value={codec} onChange={(e) => setCodec(e.target.value)}>
                <option value="">Any codec</option>
                {status?.facets.codecs.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className={styles.railHd}>Min resolution</div>
            <select className={styles.select} value={minHeight} onChange={(e) => setMinHeight(Number(e.target.value))}>
              <option value={0}>Any</option>
              <option value={720}>≥ 720p</option>
              <option value={1080}>≥ 1080p</option>
              <option value={2160}>≥ 2160p (4K)</option>
            </select>
          </div>

          <div>
            <div className={styles.railHd}>Sort</div>
            <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Newest</option>
              <option value="name">Name</option>
              <option value="duration">Duration</option>
              <option value="size">Size</option>
            </select>
          </div>

          <div>
            <div className={styles.railHd}>Folders</div>
            <div className={styles.tree}>
              <button
                className={`${styles.treeItem} ${folder === "" && !activeCollection ? styles.treeOn : ""}`}
                onClick={goAllFolders}
              >
                <Icon name="grid" size={13} /> All folders
                <span className="n">{status?.total ?? ""}</span>
              </button>
              {status?.folders.map((f) => {
                const isDrop = dropFolder === f.folder;
                return (
                  <button
                    key={f.folder}
                    className={`${styles.treeItem} ${folder === f.folder && !activeCollection ? styles.treeOn : ""} ${isDrop ? styles.dropTarget : ""}`}
                    onClick={() => goExplorer(f.folder)}
                    title={`${f.folder} — click to browse · drop assets here to move`}
                    onDragOver={(e) => { e.preventDefault(); setDropFolder(f.folder); }}
                    onDragLeave={() => setDropFolder((d) => (d === f.folder ? null : d))}
                    onDrop={(e) => dropOnFolder(e, f.folder)}
                  >
                    <Icon name="chevronRight" size={12} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.folder.split("/").pop() || f.folder}
                    </span>
                    <span className="n">{f.n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collections panel — list + create; each row is a drop target. */}
          <div>
            <div className={styles.railHd}>
              Collections
              <button className={styles.railAdd} onClick={() => newCollection([])} title="New collection">
                <Icon name="plus" size={13} />
              </button>
            </div>
            <div className={styles.tree}>
              {collections.length === 0 && (
                <div className={styles.railEmpty}>No collections yet</div>
              )}
              {collections.map((c) => {
                const isDrop = dropColl === c.id;
                const on = activeCollection?.id === c.id;
                return (
                  <button
                    key={c.id}
                    className={`${styles.treeItem} ${on ? styles.treeOn : ""} ${isDrop ? styles.dropTarget : ""}`}
                    onClick={() => { setActiveCollection(c); setPath(""); }}
                    title={`${c.name} — drop assets here to add`}
                    onDragOver={(e) => { e.preventDefault(); setDropColl(c.id); }}
                    onDragLeave={() => setDropColl((d) => (d === c.id ? null : d))}
                    onDrop={(e) => dropOnCollection(e, c)}
                  >
                    <Icon name="layers" size={13} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                    <span className="n">{c.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── main: search + grid ──────────────────────────────── */}
        <div>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <Icon name="search" size={16} />
              <input
                placeholder="Search filename or path…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <button className={styles.toolBtn} onClick={makeFolder} title="Create a new folder">
              <Icon name="plus" size={14} /> New folder
            </button>
            <button
              className={styles.toolBtn}
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              title="Upload files to this folder"
            >
              <Icon name="download" size={14} /> {uploading ? "Uploading…" : "Upload"}
            </button>
            <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>
              {viewMode === "explorer"
                ? (browseLoading
                    ? "loading…"
                    : `${browse?.folders.length ?? 0} folder${(browse?.folders.length ?? 0) === 1 ? "" : "s"} · ${browse?.files.length ?? 0} file${(browse?.files.length ?? 0) === 1 ? "" : "s"}`)
                : `${activeCollection ? `“${activeCollection.name}” · ` : ""}${loading ? "loading…" : `${assets.length} result${assets.length === 1 ? "" : "s"}`}`}
            </span>
          </div>

          {/* Mode hint when searching/filtering — explains the flat results and
              offers a way back to browsing the current folder. */}
          {viewMode === "search" && (
            <div className={styles.modeHint}>
              <Icon name="search" size={13} />
              <span>
                Searching in <strong>{path || "all folders"}</strong>
              </span>
              <button
                className={styles.modeHintClear}
                onClick={() => goExplorer(path)}
                title="Clear search + filters and browse this folder"
              >
                <Icon name="x" size={12} /> Back to browsing
              </button>
            </div>
          )}

          {/* ── EXPLORER mode (default): breadcrumb + folder/file tiles ── */}
          {viewMode === "explorer" ? (
            <>
              <nav className={styles.crumbs} aria-label="Folder path">
                {(browse?.breadcrumb ?? [{ name: "Library", path: "" }]).map((c, i, arr) => (
                  <span key={c.path || "root"} className={styles.crumbSeg}>
                    <button
                      className={`${styles.crumb} ${i === arr.length - 1 ? styles.crumbCur : ""}`}
                      onClick={() => goExplorer(c.path)}
                    >
                      {i === 0 ? <Icon name="grid" size={13} /> : null} {c.name}
                    </button>
                    {i < arr.length - 1 && <Icon name="chevronRight" size={12} />}
                  </span>
                ))}
              </nav>

              {status?.error || (status && status.total === 0) ? (
                <div className={styles.empty}>
                  <p>No footage indexed yet.</p>
                  <p style={{ marginTop: 8, fontSize: 13 }}>
                    Drop files into <code>studiolibrary/test-media</code>, then run{" "}
                    <code>pnpm library:once</code> to crawl + build proxies.
                  </p>
                </div>
              ) : (browse && browse.folders.length === 0 && browse.files.length === 0 && !browseLoading) ? (
                <div className={styles.empty}>This folder is empty. Drop files here or use Upload.</div>
              ) : (
                <div className={styles.grid}>
                  {/* Up-one-level tile (only when not at root). */}
                  {path && (
                    <button
                      className={`${styles.folderTile} ${styles.upTile}`}
                      onClick={() => goExplorer(folderOf(path))}
                      onDragOver={(e) => { e.preventDefault(); setDropTile("↑"); }}
                      onDragLeave={() => setDropTile((d) => (d === "↑" ? null : d))}
                      onDrop={(e) => dropOnTile(e, folderOf(path))}
                      title="Up one level"
                    >
                      <span className={`${styles.folderGlyph} ${dropTile === "↑" ? styles.tileDrop : ""}`}>
                        <Icon name="folderUp" size={32} />
                      </span>
                      <span className={styles.folderName}>Up one level</span>
                    </button>
                  )}

                  {/* Folder tiles — enter on click, drop target for moves. */}
                  {browse?.folders.map((f) => {
                    const isDrop = dropTile === f.path;
                    return (
                      <button
                        key={`dir:${f.path}`}
                        className={`${styles.folderTile} ${isDrop ? styles.tileDropOn : ""}`}
                        onClick={() => goExplorer(f.path)}
                        onDoubleClick={() => goExplorer(f.path)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setFolderMenu({ x: e.clientX, y: e.clientY, folder: f });
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDropTile(f.path); }}
                        onDragLeave={() => setDropTile((d) => (d === f.path ? null : d))}
                        onDrop={(e) => dropOnTile(e, f.path)}
                        title={`${f.name} — open · drop assets to move here · right-click for options`}
                      >
                        <span className={styles.folderGlyph}><Icon name="folder" size={32} /></span>
                        <span className={styles.folderName} title={f.name}>{f.name}</span>
                        <span className={styles.folderCount}>{f.count} item{f.count === 1 ? "" : "s"}</span>
                      </button>
                    );
                  })}

                  {/* File tiles — indexed → full asset card; un-indexed → generic. */}
                  {browse?.files.map((f) => {
                    if (f.asset) {
                      return renderCard(assetFromBrowseFile(f, f.asset, browse.volumeId));
                    }
                    return (
                      <div
                        key={`file:${f.relPath}`}
                        className={styles.fileTile}
                        title={f.relPath}
                      >
                        <div className={`${styles.thumb} ${styles.fileGlyphWrap}`}>
                          <span className={styles.thumbIcon}>
                            <Icon name={DISPLAY_ICON[f.displayKind] ?? "copy"} size={40} />
                          </span>
                          <span className={styles.extTag}>{(f.ext || "file").toUpperCase()}</span>
                        </div>
                        <div className={styles.meta}>
                          <div className={styles.fname} title={f.name}>{f.name}</div>
                          <div className={styles.fpath}>{f.displayKind}</div>
                          <div className={styles.specs}>
                            <span className={`${styles.spec} ${styles.kindChip}`}>
                              <Icon name={DISPLAY_ICON[f.displayKind] ?? "copy"} size={11} />{" "}
                              {f.ext ? f.ext.toUpperCase() : "FILE"}
                            </span>
                            {fmtSize(String(f.sizeBytes)) && (
                              <span className={styles.spec}>{fmtSize(String(f.sizeBytes))}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : status?.error || (status && status.total === 0) ? (
            <div className={styles.empty}>
              <p>No footage indexed yet.</p>
              <p style={{ marginTop: 8, fontSize: 13 }}>
                Drop files into <code>studiolibrary/test-media</code>, then run{" "}
                <code>pnpm library:once</code> to crawl + build proxies.
              </p>
            </div>
          ) : assets.length === 0 && !loading ? (
            <div className={styles.empty}>Nothing matches these filters.</div>
          ) : (
            /* ── SEARCH / COLLECTION mode: flat results ── */
            <div className={styles.grid}>
              {assets.map((a) => renderCard(a))}
            </div>
          )}
        </div>
      </div>

      {/* ── bulk action bar (sticky, when ≥1 selected) ─────────────── */}
      {selCount > 0 && (
        <div className={styles.bulkBar} onClick={(e) => e.stopPropagation()}>
          <span className={styles.bulkCount}>
            {selCount} selected
            <button className={styles.bulkClear} onClick={clearSelection}>clear</button>
          </span>

          <div className={styles.bulkActions}>
            {/* Add to collection ▾ */}
            <div className={styles.bulkMenuWrap}>
              <button className={styles.bulkBtn} onClick={() => setBar(bar === "collection" ? "" : "collection")}>
                <Icon name="layers" size={13} /> Add to collection <Icon name="chevronDown" size={12} />
              </button>
              {bar === "collection" && (
                <div className={styles.popMenu}>
                  {collections.map((c) => (
                    <button key={c.id} className={styles.popItem} onClick={() => addToCollection(c.id, [...selected], c.name)}>
                      <Icon name="layers" size={12} /> {c.name} <span className={styles.popN}>{c.count}</span>
                    </button>
                  ))}
                  <button className={styles.popItem} onClick={() => newCollection([...selected])}>
                    <Icon name="plus" size={12} /> New collection…
                  </button>
                </div>
              )}
            </div>

            {/* Set state ▾ */}
            <div className={styles.bulkMenuWrap}>
              <button className={styles.bulkBtn} onClick={() => setBar(bar === "state" ? "" : "state")}>
                <Icon name="checkcircle" size={13} /> Set state <Icon name="chevronDown" size={12} />
              </button>
              {bar === "state" && (
                <div className={styles.popMenu}>
                  {reviewStates.map((s) => (
                    <button key={s.key} className={styles.popItem} onClick={() => setStateFor([...selected], s.key, s.label)}>
                      <span className={styles.stateDot} style={{ background: s.color }} /> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rate ▾ */}
            <div className={styles.bulkMenuWrap}>
              <button className={styles.bulkBtn} onClick={() => setBar(bar === "move" ? "" : "move")}>
                <Icon name="spark" size={13} /> Rate <Icon name="chevronDown" size={12} />
              </button>
              {bar === "move" && (
                <div className={styles.popMenu}>
                  {[5, 4, 3, 2, 1, 0].map((r) => (
                    <button key={r} className={styles.popItem} onClick={() => rateFor([...selected], r)}>
                      {r === 0 ? "Clear rating" : "★".repeat(r)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Move to… (folder picker) */}
            <FolderPickerButton
              folders={status?.folders ?? []}
              onPick={(f) => moveAssets([...selected], f)}
            />

            <button
              className={styles.bulkBtn}
              onClick={openCompare}
              disabled={!canCompare}
              title={canCompare ? "Compare side-by-side" : "Select 2–4 videos to compare"}
            >
              <Icon name="film" size={13} /> Compare
            </button>

            <button className={styles.bulkBtn} onClick={() => shareAssets([...selected])}>
              <Icon name="share" size={13} /> Share
            </button>
            <button className={`${styles.bulkBtn} ${styles.bulkDanger}`} onClick={() => deleteAssets([...selected])}>
              <Icon name="trash" size={13} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ── right-click context menu ───────────────────────────────── */}
      {menu && (
        <div
          className={styles.ctxMenu}
          style={{ left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 230), top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.ctxItem} onClick={() => { router.push(`/library/${menu.asset.id}`); setMenu(null); }}>
            <Icon name="expand" size={13} /> Open
          </button>
          <button className={styles.ctxItem} onClick={() => { renameAsset(menu.asset); setMenu(null); }}>
            <Icon name="tools" size={13} /> Rename…
          </button>
          <button className={styles.ctxItem} onClick={() => { copyPath(menu.asset); setMenu(null); }}>
            <Icon name="copy" size={13} /> Copy path
          </button>

          {/* Move to folder ▸ */}
          <div className={styles.ctxSub}>
            <button className={styles.ctxItem} onClick={() => setMenuSub(menuSub === "move" ? "" : "move")}>
              <Icon name="arrowRight" size={13} /> Move to folder <Icon name="chevronRight" size={12} />
            </button>
            {menuSub === "move" && (
              <div className={styles.ctxFlyout}>
                {(status?.folders ?? []).map((f) => (
                  <button key={f.folder} className={styles.ctxItem}
                    onClick={() => { moveAssets(idsToActOn(menu.asset), f.folder); setMenu(null); }}>
                    {f.folder.split("/").pop() || f.folder}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add to collection ▸ */}
          <div className={styles.ctxSub}>
            <button className={styles.ctxItem} onClick={() => setMenuSub(menuSub === "collection" ? "" : "collection")}>
              <Icon name="layers" size={13} /> Add to collection <Icon name="chevronRight" size={12} />
            </button>
            {menuSub === "collection" && (
              <div className={styles.ctxFlyout}>
                {collections.map((c) => (
                  <button key={c.id} className={styles.ctxItem}
                    onClick={() => { addToCollection(c.id, idsToActOn(menu.asset), c.name); setMenu(null); }}>
                    {c.name}
                  </button>
                ))}
                <button className={styles.ctxItem}
                  onClick={() => { newCollection(idsToActOn(menu.asset)); setMenu(null); }}>
                  <Icon name="plus" size={12} /> New collection…
                </button>
              </div>
            )}
          </div>

          {/* Set state ▸ */}
          <div className={styles.ctxSub}>
            <button className={styles.ctxItem} onClick={() => setMenuSub(menuSub === "state" ? "" : "state")}>
              <Icon name="checkcircle" size={13} /> Set state <Icon name="chevronRight" size={12} />
            </button>
            {menuSub === "state" && (
              <div className={styles.ctxFlyout}>
                {reviewStates.map((s) => (
                  <button key={s.key} className={styles.ctxItem}
                    onClick={() => { setStateFor(idsToActOn(menu.asset), s.key, s.label); setMenu(null); }}>
                    <span className={styles.stateDot} style={{ background: s.color }} /> {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.ctxDivider} />
          <button className={`${styles.ctxItem} ${styles.ctxDanger}`}
            onClick={() => { deleteAssets(idsToActOn(menu.asset)); setMenu(null); }}>
            <Icon name="trash" size={13} /> Delete
          </button>
        </div>
      )}

      {/* ── folder-tile right-click menu (explorer) ────────────────── */}
      {folderMenu && (
        <div
          className={styles.ctxMenu}
          style={{ left: Math.min(folderMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 230), top: folderMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.ctxItem} onClick={() => { goExplorer(folderMenu.folder.path); setFolderMenu(null); }}>
            <Icon name="expand" size={13} /> Open
          </button>
          <button className={styles.ctxItem} onClick={() => { renameFolder(folderMenu.folder); setFolderMenu(null); }}>
            <Icon name="tools" size={13} /> Rename…
          </button>
          <div className={styles.ctxDivider} />
          <button className={`${styles.ctxItem} ${styles.ctxDanger}`}
            onClick={() => { trashFolder(folderMenu.folder); setFolderMenu(null); }}>
            <Icon name="trash" size={13} /> Delete folder
          </button>
        </div>
      )}

      {/* ── transient confirmation banner ──────────────────────────── */}
      {toast && (
        <div className={styles.toast}>
          <Icon name="check" size={14} /> <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

/** Small self-contained "Move to…" folder picker for the bulk bar. */
function FolderPickerButton({
  folders, onPick,
}: { folders: { folder: string; n: number }[]; onPick: (folder: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.bulkMenuWrap}>
      <button className={styles.bulkBtn} onClick={() => setOpen((o) => !o)}>
        <Icon name="arrowRight" size={13} /> Move to… <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className={styles.popMenu}>
          {folders.length === 0 && <div className={styles.railEmpty}>No folders</div>}
          {folders.map((f) => (
            <button key={f.folder} className={styles.popItem}
              onClick={() => { onPick(f.folder); setOpen(false); }} title={f.folder}>
              <Icon name="chevronRight" size={12} />
              {f.folder.split("/").pop() || f.folder}
              <span className={styles.popN}>{f.n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
