"use client";

/* ===================================================================
   MEDIA LIBRARY (StudioLibrary) — the footage archive surface.
   Portal One redesign: a full-height media-management workspace —
   library tree (pane 2) · browser with Grid/List/Columns/Gallery
   (pane 3) · Inspector (pane 4). The app nav is pane 1 (AppShell).

   A WRITABLE index of produced files on disk (local test volume now,
   the on-prem archive in Oslo later). NOT the AI-render Gallery —
   separate data model, separate local Postgres. All file ops hit the
   writable local volume through /api/library/fs.
   =================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "../components/Icon";
import styles from "./library.module.css";
import {
  type Asset, type Collection, type Status, type BrowseResult, type AssetDetail,
  type ReviewState, type BrowseFolder,
  KIND_ICON, DISPLAY_ICON, KIND_ORDER,
  fmtSize, folderOf, assetFromBrowseFile,
} from "./_components/lib";
import { LibraryTree, type SmartFolder } from "./_components/LibraryTree";
import { Inspector } from "./_components/Inspector";
import { FolderCard } from "./_components/FolderCard";
import { GridView } from "./_components/views/GridView";
import { ListView } from "./_components/views/ListView";
import { ColumnsView } from "./_components/views/ColumnsView";
import { GalleryView } from "./_components/views/GalleryView";
import { type CardCtx } from "./_components/views/ctx";

type ContextMenu = { x: number; y: number; asset: Asset } | null;
type SubMenu = "" | "collection" | "state" | "move";
type ViewMode = "grid" | "list" | "columns" | "gallery";

const VIEWS: { key: ViewMode; icon: string; label: string }[] = [
  { key: "grid", icon: "grid", label: "Grid" },
  { key: "list", icon: "list", label: "List" },
  { key: "columns", icon: "columns", label: "Columns" },
  { key: "gallery", icon: "gallery", label: "Gallery" },
];

export default function MediaLibraryPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [meaning, setMeaning] = useState(false); // semantic ("by meaning") search
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [codec, setCodec] = useState("");
  const [minHeight, setMinHeight] = useState(0);
  const [path, setPath] = useState("");
  const folder = path;
  const [sort, setSort] = useState("recent");
  const [reviewState, setReviewState] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  // Which Source / Smart-Folder is highlighted ("" | recents | favorites | uhd | review:<key>).
  const [smart, setSmart] = useState("");

  // Layout mode (orthogonal to the data mode below).
  const [view, setView] = useState<ViewMode>("grid");
  const [more, setMore] = useState(false);

  // File-explorer (browse) state.
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Inspector (pane 4) — the actively-inspected asset.
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [inspectDetail, setInspectDetail] = useState<AssetDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Selection + interaction state.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const lastClicked = useRef<number | null>(null);
  const orderRef = useRef<number[]>([]);
  const [menu, setMenu] = useState<ContextMenu>(null);
  const [menuSub, setMenuSub] = useState<SubMenu>("");
  const [bar, setBar] = useState<SubMenu>("");
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  const [dropColl, setDropColl] = useState<number | null>(null);
  const [dropTile, setDropTile] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; folder: BrowseFolder } | null>(null);
  const dragIds = useRef<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const segRef = useRef<HTMLDivElement | null>(null);
  const [segInk, setSegInk] = useState({ left: 0, width: 0 });

  // Upload.
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileDrag, setFileDrag] = useState(false);
  const fileDragDepth = useRef(0);

  // ── data modes ───────────────────────────────────────────────────
  const searchActive =
    q.trim() !== "" || kinds.size > 0 || codec !== "" ||
    minHeight > 0 || reviewState !== "" || minRating > 0 || smart !== "";
  const dataMode: "collection" | "search" | "explorer" =
    activeCollection ? "collection" : searchActive ? "search" : "explorer";

  // ── loaders ──────────────────────────────────────────────────────
  const loadStatus = useCallback(() => {
    fetch("/api/library/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const volumeId = status?.volumes[0]?.id ?? null;

  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true);
    const p = new URLSearchParams();
    if (path) p.set("path", path);
    if (volumeId != null) p.set("volumeId", String(volumeId));
    try {
      const r = await fetch(`/api/library/browse?${p.toString()}`);
      const d = (await r.json()) as BrowseResult;
      setBrowse(d?.error ? null : d);
    } catch { setBrowse(null); } finally { setBrowseLoading(false); }
  }, [path, volumeId]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    if (activeCollection) {
      try {
        const r = await fetch(`/api/library/collections/${activeCollection.id}`);
        const d = await r.json();
        setAssets((d.assets as Asset[]) ?? []);
      } catch { setAssets([]); } finally { setLoading(false); }
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
      // "By meaning" → pgvector semantic search; otherwise lexical browse query.
      let url = `/api/library/assets?${p.toString()}`;
      if (meaning && q.trim()) {
        const sp = new URLSearchParams({ q: q.trim(), limit: "60" });
        if (kinds.size) sp.set("kind", [...kinds][0]);
        url = `/api/library/search?${sp.toString()}`;
      }
      const r = await fetch(url);
      const d = await r.json();
      // Empty semantic result (no embeddings / model offline) → fall back to lexical.
      if (meaning && q.trim() && (d.fallback || (d.assets ?? []).length === 0)) {
        const fb = await fetch(`/api/library/assets?${p.toString()}`);
        setAssets(((await fb.json()).assets as Asset[]) ?? []);
      } else {
        setAssets((d.assets as Asset[]) ?? []);
      }
    } catch { setAssets([]); } finally { setLoading(false); }
  }, [q, meaning, kinds, codec, minHeight, folder, reviewState, minRating, sort, activeCollection]);

  const reload = useCallback(() => {
    if (dataMode === "explorer") loadBrowse(); else loadAssets();
  }, [dataMode, loadBrowse, loadAssets]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (dataMode === "explorer") loadBrowse(); else loadAssets();
    }, 220);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [dataMode, loadBrowse, loadAssets]);

  // Inspector detail fetch.
  const reloadInspect = useCallback(async () => {
    if (inspectId == null) return;
    try {
      const r = await fetch(`/api/library/assets/${inspectId}`);
      const d = await r.json();
      setInspectDetail(d?.error ? null : d);
    } catch { /* keep last */ }
  }, [inspectId]);

  useEffect(() => {
    if (inspectId == null) { setInspectDetail(null); return; }
    let cancelled = false;
    setInspectLoading(true);
    fetch(`/api/library/assets/${inspectId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInspectDetail(d?.error ? null : d); })
      .catch(() => { if (!cancelled) setInspectDetail(null); })
      .finally(() => { if (!cancelled) setInspectLoading(false); });
    return () => { cancelled = true; };
  }, [inspectId]);

  // Dismiss menus.
  useEffect(() => {
    if (!menu && !folderMenu && !more) return;
    const close = () => { setMenu(null); setMenuSub(""); setFolderMenu(null); setMore(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey); };
  }, [menu, folderMenu, more]);

  // Position the sliding view-toggle "ink" under the active view — and re-measure
  // on resize / once fonts settle, since button widths can shift after first paint.
  useEffect(() => {
    const place = () => {
      const btn = segRef.current?.querySelector<HTMLElement>(`[data-view="${view}"]`);
      if (btn) setSegInk({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready?.then(place).catch(() => {});
    return () => window.removeEventListener("resize", place);
  }, [view]);

  // ⌘K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── helpers ──────────────────────────────────────────────────────
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const toggleKind = (k: string) =>
    setKinds((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const stateMeta = useCallback(
    (key: string | null): ReviewState | null =>
      key ? status?.reviewStates.find((s) => s.key === key) ?? null : null,
    [status]
  );

  const clearSelection = () => { setSelected(new Set()); setBar(""); };

  const toggleSelect = (id: number, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked.current != null) {
        const order = orderRef.current;
        const a = order.indexOf(lastClicked.current);
        const b = order.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(order[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastClicked.current = id;
  };

  const inspect = (a: Asset) => setInspectId(a.id);

  // Crossfade between view modes via the View Transitions API (honors reduced-motion;
  // falls back to an instant switch where unsupported). flushSync makes the new view
  // paint inside the transition callback so it's captured.
  const switchView = useCallback((v: ViewMode) => {
    const d = typeof document !== "undefined"
      ? (document as Document & { startViewTransition?: (cb: () => void) => void })
      : null;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (d?.startViewTransition && !reduce) d.startViewTransition(() => flushSync(() => setView(v)));
    else setView(v);
  }, []);

  // ── write operations ─────────────────────────────────────────────
  const idsToActOn = (anchor: Asset): number[] =>
    selected.has(anchor.id) && selected.size > 0 ? [...selected] : [anchor.id];

  const volumeFor = useCallback(
    (a: Asset | undefined): number | null => a?.volume_id ?? status?.volumes[0]?.id ?? null,
    [status]
  );

  const moveAssets = useCallback(async (ids: number[], destFolder: string) => {
    let moved = 0;
    for (const id of ids) {
      try {
        const r = await fetch("/api/library/fs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "moveAsset", assetId: id, destFolder }),
        });
        const d = await r.json();
        if (d.moved || d.ok) moved++;
      } catch { /* keep going */ }
    }
    flash(`Moved ${moved} asset${moved === 1 ? "" : "s"} → ${destFolder || "root"}`);
    clearSelection(); reload(); loadStatus();
  }, [flash, reload, loadStatus]);

  const addToCollection = useCallback(async (collectionId: number, ids: number[], label: string) => {
    try {
      await fetch("/api/library/collections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", collectionId, assetIds: ids }),
      });
      flash(`Added ${ids.length} to “${label}”`);
    } catch { flash("Couldn’t add to collection"); }
    clearSelection(); loadStatus();
    if (activeCollection?.id === collectionId) loadAssets();
  }, [flash, loadStatus, loadAssets, activeCollection]);

  const newCollection = useCallback(async (ids: number[]): Promise<void> => {
    const name = window.prompt("New collection name");
    if (!name?.trim()) return;
    try {
      await fetch("/api/library/collections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: name.trim(), assetIds: ids.length ? ids : undefined }),
      });
      flash(`Created “${name.trim()}”`);
    } catch { flash("Couldn’t create collection"); }
    clearSelection(); loadStatus();
  }, [flash, loadStatus]);

  const setStateFor = useCallback(async (ids: number[], state: string, label: string) => {
    for (const id of ids) {
      try {
        await fetch("/api/library/review", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: id, action: "state", state }),
        });
      } catch { /* keep going */ }
    }
    flash(`Set ${ids.length} → ${label}`);
    clearSelection(); reload(); loadStatus();
    if (ids.includes(inspectId ?? -1)) reloadInspect();
  }, [flash, reload, loadStatus, inspectId, reloadInspect]);

  const rateFor = useCallback(async (ids: number[], rating: number) => {
    for (const id of ids) {
      try {
        await fetch("/api/library/review", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: id, action: "rating", rating }),
        });
      } catch { /* keep going */ }
    }
    flash(`Rated ${ids.length} → ${rating === 0 ? "cleared" : `${rating}★`}`);
    clearSelection(); reload();
    if (ids.includes(inspectId ?? -1)) reloadInspect();
  }, [flash, reload, inspectId, reloadInspect]);

  const renameAsset = useCallback(async (a: Asset) => {
    const name = window.prompt("Rename file", a.filename);
    if (!name?.trim() || name.trim() === a.filename) return;
    const vol = volumeFor(a);
    if (vol == null) return;
    try {
      await fetch("/api/library/fs", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "delete", assetId: id, mode: "trash" }),
        });
        const d = await r.json();
        if (d.deleted || d.ok) n++;
      } catch { /* keep going */ }
    }
    flash(`Trashed ${n} asset${n === 1 ? "" : "s"}`);
    if (ids.includes(inspectId ?? -1)) setInspectId(null);
    clearSelection(); reload(); loadStatus();
  }, [flash, reload, loadStatus, inspectId]);

  const copyPath = useCallback((a: Asset) => {
    navigator.clipboard?.writeText(a.rel_path).then(() => flash("Path copied"), () => flash("Couldn’t copy path"));
  }, [flash]);

  const makeFolder = useCallback(async () => {
    const name = window.prompt("New folder name");
    if (!name?.trim()) return;
    const vol = status?.volumes[0]?.id;
    if (vol == null) { flash("No writable volume"); return; }
    const p = folder ? `${folder}/${name.trim()}` : name.trim();
    try {
      await fetch("/api/library/fs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "mkdir", volumeId: vol, path: p }),
      });
      flash(`Folder created → ${p}`);
    } catch { flash("Couldn’t create folder"); }
    reload(); loadStatus();
  }, [flash, folder, status, reload, loadStatus]);

  const shareAssets = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      const r = await fetch("/api/library/share", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "asset", targetId: ids[0], allowComments: true, allowDownload: false, expiresInDays: 30 }),
      });
      const d = await r.json();
      const token = d?.link?.token;
      if (token) {
        const url = `${window.location.origin}/library/share/${token}`;
        navigator.clipboard?.writeText(url).catch(() => {});
        flash(`Share link copied · ${url}`);
      } else flash("Couldn’t create share link");
    } catch { flash("Share failed"); }
  }, [flash]);

  // ── upload ───────────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const volId = status?.volumes[0]?.id;
    if (volId == null) { flash("No writable volume"); return; }
    const dest = activeCollection ? "" : path;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("volumeId", String(volId));
      fd.set("destFolder", dest);
      for (const f of files) fd.append("files", f);
      const r = await fetch("/api/library/upload", { method: "POST", body: fd });
      const d = (await r.json()) as { added?: unknown[]; skipped?: unknown[]; error?: string };
      if (!r.ok || d.error) { flash(d.error ? `Upload failed · ${d.error}` : "Upload failed"); return; }
      const n = d.added?.length ?? 0;
      const skipped = d.skipped?.length ?? 0;
      flash(`Uploaded ${n} file${n === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
      reload(); loadStatus();
    } catch { flash("Upload failed"); } finally { setUploading(false); }
  }, [status, activeCollection, path, flash, reload, loadStatus]);

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    uploadFiles(files);
  };

  const dragHasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const onPageDragEnter = (e: React.DragEvent) => { if (!dragHasFiles(e)) return; fileDragDepth.current += 1; setFileDrag(true); };
  const onPageDragOver = (e: React.DragEvent) => { if (!dragHasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const onPageDragLeave = (e: React.DragEvent) => { if (!dragHasFiles(e)) return; fileDragDepth.current = Math.max(0, fileDragDepth.current - 1); if (fileDragDepth.current === 0) setFileDrag(false); };
  const onPageDrop = (e: React.DragEvent) => { if (!dragHasFiles(e)) return; e.preventDefault(); fileDragDepth.current = 0; setFileDrag(false); uploadFiles(Array.from(e.dataTransfer.files ?? [])); };

  // ── compare ──────────────────────────────────────────────────────
  const selectedVideoIds = useMemo(
    () => assets.filter((a) => selected.has(a.id) && a.kind === "video").map((a) => a.id),
    [assets, selected]
  );
  const canCompare = selectedVideoIds.length >= 2 && selectedVideoIds.length <= 4;
  const openCompare = () => { if (canCompare) router.push(`/library/compare?ids=${selectedVideoIds.join(",")}`); };

  // ── drag-and-drop ────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, a: Asset) => {
    const ids = selected.has(a.id) && selected.size > 0 ? [...selected] : [a.id];
    dragIds.current = ids;
    e.dataTransfer.setData("text/plain", ids.join(","));
    e.dataTransfer.effectAllowed = "move";
  };
  const dropOnTile = (e: React.DragEvent, destFolder: string) => {
    e.preventDefault(); setDropTile(null);
    if (dragIds.current.length) moveAssets(dragIds.current, destFolder);
    dragIds.current = [];
  };

  // ── navigation ───────────────────────────────────────────────────
  const goExplorer = useCallback((p: string) => {
    setActiveCollection(null); setSmart("");
    setQ(""); setKinds(new Set()); setCodec(""); setMinHeight(0); setReviewState(""); setMinRating(0);
    setPath(p);
  }, []);

  const renameFolder = useCallback(async (f: BrowseFolder) => {
    const name = window.prompt("Rename folder", f.name);
    if (!name?.trim() || name.trim() === f.name) return;
    if (volumeId == null) { flash("No writable volume"); return; }
    try {
      await fetch("/api/library/fs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "rename", volumeId, path: f.path, name: name.trim() }),
      });
      flash(`Renamed folder → ${name.trim()}`);
    } catch { flash("Rename failed"); }
    loadBrowse(); loadStatus();
  }, [volumeId, flash, loadBrowse, loadStatus]);

  const trashFolder = useCallback(async (f: BrowseFolder) => {
    if (!window.confirm(`Move folder “${f.name}” to the trash?`)) return;
    if (volumeId == null) { flash("No writable volume"); return; }
    try {
      await fetch("/api/library/fs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "trashFolder", volumeId, path: f.path }),
      });
      flash(`Trashed folder → ${f.name}`);
    } catch { flash("Couldn’t trash folder"); }
    loadBrowse(); loadStatus();
  }, [volumeId, flash, loadBrowse, loadStatus]);

  // ── smart folders / sources ──────────────────────────────────────
  const clearFilters = () => { setQ(""); setKinds(new Set()); setCodec(""); setMinHeight(0); setReviewState(""); setMinRating(0); };
  const onRoot = () => { setActiveCollection(null); setSmart(""); clearFilters(); setPath(""); };
  const onRecents = () => { setActiveCollection(null); clearFilters(); setSmart("recents"); setSort("recent"); };
  const onFavorites = () => { setActiveCollection(null); clearFilters(); setSmart("favorites"); setMinRating(4); };
  const onSmart = (s: SmartFolder) => {
    setActiveCollection(null); clearFilters();
    if (s.kind === "uhd") { setSmart("uhd"); setMinHeight(2160); }
    else { setSmart(`review:${s.key}`); setReviewState(s.key); }
  };
  const onCollection = (c: Collection) => { setActiveCollection(c); setSmart(""); clearFilters(); setPath(""); };

  // ── derived ──────────────────────────────────────────────────────
  const proxied = useMemo(() => status?.byStatus.find((s) => s.status === "proxied")?.n ?? 0, [status]);
  const queued = (status?.jobs.queued ?? 0) + (status?.jobs.running ?? 0);
  const vol = status?.volumes[0];
  const availableKinds = status?.facets.kinds ?? KIND_ORDER;
  const reviewStates = useMemo(() => status?.reviewStates ?? [], [status]);
  const collections = status?.collections ?? [];
  const selCount = selected.size;

  const smartFolders: SmartFolder[] = useMemo(() => {
    const rs = reviewStates;
    const needs = rs.find((s) => /review|new|to.?review|pending/i.test(s.label)) ?? rs[0];
    const appr = rs.find((s) => /client|approv|deliver/i.test(s.label));
    const out: SmartFolder[] = [];
    if (needs) out.push({ kind: "review", key: needs.key, label: needs.label, color: needs.color });
    if (appr && appr.key !== needs?.key) out.push({ kind: "review", key: appr.key, label: appr.label, color: appr.color });
    out.push({ kind: "uhd", key: "uhd", label: "Ultra HD · 4K+", color: "var(--starxi)" });
    return out;
  }, [reviewStates]);

  const approveState = reviewStates.find((s) => /approv|deliver|final|accept/i.test(s.label) || /approv/i.test(s.kind ?? ""));
  const rejectState = reviewStates.find((s) => /reject|fail|declin/i.test(s.label) || /reject/i.test(s.kind ?? ""));
  const codecProRes = (status?.facets.codecs ?? []).find((c) => /prores/i.test(c));

  // The asset list the current view renders (explorer → indexed files of `path`).
  const viewAssets: Asset[] = useMemo(() => {
    if (dataMode === "explorer") {
      return (browse?.files ?? [])
        .filter((f) => f.asset)
        .map((f) => assetFromBrowseFile(f, f.asset!, browse!.volumeId));
    }
    return assets;
  }, [dataMode, browse, assets]);
  orderRef.current = viewAssets.map((a) => a.id);

  const ctx: CardCtx = {
    stateMeta,
    isSelected: (id) => selected.has(id),
    isInspected: (id) => inspectId === id,
    selectMode: selCount > 0,
    onInspect: inspect,
    onOpen: (a) => router.push(`/library/${a.id}`),
    onToggleSelect: (a, shift) => toggleSelect(a.id, shift),
    onContextMenu: (e, a) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, asset: a }); setMenuSub(""); },
    onDragStart,
  };

  // Folder cards for grid+explorer (up tile + browsed folders).
  const folderNodes = dataMode === "explorer" ? [
    ...(path ? [(
      <FolderCard key="__up" up name="Up one level"
        onOpen={() => goExplorer(folderOf(path))}
        isDrop={dropTile === "↑"}
        onDragOver={(e) => { e.preventDefault(); setDropTile("↑"); }}
        onDragLeave={() => setDropTile((d) => (d === "↑" ? null : d))}
        onDrop={(e) => dropOnTile(e, folderOf(path))}
      />
    )] : []),
    ...(browse?.folders ?? []).map((f, i) => (
      <FolderCard key={`dir:${f.path}`} name={f.name} count={f.count} index={path ? i + 1 : i}
        isDrop={dropTile === f.path}
        onOpen={() => goExplorer(f.path)}
        onContextMenu={(e) => { e.preventDefault(); setFolderMenu({ x: e.clientX, y: e.clientY, folder: f }); }}
        onDragOver={(e) => { e.preventDefault(); setDropTile(f.path); }}
        onDragLeave={() => setDropTile((d) => (d === f.path ? null : d))}
        onDrop={(e) => dropOnTile(e, f.path)}
      />
    )),
  ] : undefined;

  // Un-indexed files (grid+explorer only).
  const extraNodes = dataMode === "explorer"
    ? (browse?.files ?? []).filter((f) => !f.asset).map((f) => (
        <div key={`file:${f.relPath}`} className={styles.fileCard} title={f.relPath}>
          <div className={styles.fileGlyph}>
            <Icon name={DISPLAY_ICON[f.displayKind] ?? "copy"} size={30} />
            <span className={styles.extTag}>{(f.ext || "file").toUpperCase()}</span>
          </div>
          <div className={styles.cardMeta}>
            <div className={styles.cardTop}><span className={styles.fname} title={f.name}>{f.name}</span></div>
            <div className={styles.cardSub}>
              <span>{f.displayKind}</span>
              {fmtSize(String(f.sizeBytes)) && <><span className={styles.subDot} /><span>{fmtSize(String(f.sizeBytes))}</span></>}
            </div>
          </div>
        </div>
      ))
    : undefined;

  // breadcrumb
  const crumbs = dataMode === "explorer"
    ? (browse?.breadcrumb ?? [{ name: "Library", path: "" }])
    : activeCollection ? [{ name: "Library", path: "" }, { name: activeCollection.name, path: "@collection" }]
    : smart ? [{ name: "Library", path: "" }, { name: smartLabel(smart, smartFolders), path: "@smart" }]
    : [{ name: "Library", path: "" }, { name: "Search results", path: "@search" }];

  // empty states
  const noIndex = status?.error || (status && status.total === 0);
  const explorerEmpty = dataMode === "explorer" && browse && browse.folders.length === 0 && browse.files.length === 0 && !browseLoading;
  const flatEmpty = dataMode !== "explorer" && viewAssets.length === 0 && !loading;
  const viewNeedsAssets = view === "list" || view === "gallery";
  const noAssetsForView = viewNeedsAssets && viewAssets.length === 0 && !(dataMode === "explorer" && browseLoading);

  const volumeName = inspectDetail
    ? status?.volumes.find((v) => v.id === inspectDetail.asset.volume_id)?.name
    : undefined;

  return (
    <div
      className={styles.workspace}
      onDragEnter={onPageDragEnter}
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      <input ref={fileInput} type="file" multiple hidden onChange={onFilePicked} />

      {fileDrag && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropInner}>
            <Icon name="upload" size={34} />
            <div>Drop to upload to {activeCollection || !folder ? "Media Library root" : folder}</div>
          </div>
        </div>
      )}
      {uploading && (
        <div className={styles.uploadOverlay}>
          <div className={styles.dropInner}><Icon name="hourglass" size={30} /><div>Uploading…</div></div>
        </div>
      )}

      {/* ── pane 2 · library tree ── */}
      <LibraryTree
        status={status}
        activeFolder={path}
        activeCollection={activeCollection}
        smart={smart}
        searchActive={searchActive}
        smartFolders={smartFolders}
        onRoot={onRoot}
        onRecents={onRecents}
        onFavorites={onFavorites}
        onSmart={onSmart}
        onFolder={goExplorer}
        onCollection={onCollection}
        onNewCollection={() => newCollection([])}
        dropFolder={dropFolder}
        dropColl={dropColl}
        onFolderDragOver={(e, f) => { e.preventDefault(); setDropFolder(f); }}
        onFolderDragLeave={(f) => setDropFolder((d) => (d === f ? null : d))}
        onFolderDrop={(e, f) => { e.preventDefault(); setDropFolder(null); if (dragIds.current.length) moveAssets(dragIds.current, f); dragIds.current = []; }}
        onCollDragOver={(e, c) => { e.preventDefault(); setDropColl(c.id); }}
        onCollDragLeave={(c) => setDropColl((d) => (d === c.id ? null : d))}
        onCollDrop={(e, c) => { e.preventDefault(); setDropColl(null); if (dragIds.current.length) addToCollection(c.id, dragIds.current, c.name); dragIds.current = []; }}
      />

      {/* ── pane 3 · browser ── */}
      <main className={styles.browser}>
        <header className={styles.browserHd}>
          <nav className={styles.crumbs} aria-label="Folder path">
            {crumbs.map((c, i, arr) => (
              <span key={c.path || "root"} className={styles.crumbSeg}>
                <button
                  className={`${styles.crumb} ${i === arr.length - 1 ? styles.crumbCur : ""}`}
                  onClick={() => { if (i === 0) onRoot(); else if (dataMode === "explorer") goExplorer(c.path); }}
                >
                  {c.name}
                </button>
                {i < arr.length - 1 && <Icon name="chevronRight" size={12} />}
              </span>
            ))}
          </nav>
          <div className={styles.stats}>
            <span className={styles.statPill}><b>{status?.total ?? "—"}</b> indexed</span>
            <span className={styles.statPill}><b>{proxied}</b> proxied</span>
            <span className={styles.statPill}><b>{queued}</b> queue</span>
            {vol && (
              <span className={`${styles.statPill} ${vol.status === "active" ? styles.statOk : styles.statWarn}`}>
                <span className={styles.statLed} /> {vol.kind} volume
              </span>
            )}
            <button className={`${styles.statPill} ${styles.statBtn}`} onClick={() => router.push("/library/automation")} title="Automation rules">
              <Icon name="spark" size={12} /> Automation
            </button>
          </div>
        </header>

        {/* command bar */}
        <div className={styles.cmd}>
          <div className={styles.seg} ref={segRef} role="group" aria-label="View mode">
            <span className={styles.segInk} style={{ left: segInk.left, width: segInk.width }} aria-hidden />
            {VIEWS.map((v) => (
              <button key={v.key} data-view={v.key} aria-pressed={view === v.key} className={`${styles.segBtn} ${view === v.key ? styles.segOn : ""}`} onClick={() => switchView(v.key)} title={v.label}>
                <Icon name={v.icon} size={15} /> {v.label}
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              placeholder={meaning ? "Describe what you're looking for…" : "Search footage, codecs, paths…"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              className={`${styles.meaningToggle} ${meaning ? styles.meaningOn : ""}`}
              onClick={() => setMeaning((v) => !v)}
              title="Search by meaning (semantic) — find footage by what it shows or says"
            >
              <Icon name="spark" size={13} /> Meaning
            </button>
            <kbd className={styles.kbd}>⌘K</kbd>
          </label>
          <div className={styles.sortWrap}>
            <Icon name="sort" size={14} />
            <select className={styles.sortSel} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="recent">Newest</option>
              <option value="name">Name</option>
              <option value="duration">Duration</option>
              <option value="size">Size</option>
            </select>
          </div>
          <button className={styles.cmdBtn} onClick={makeFolder} title="Create a new folder"><Icon name="folder" size={14} /> New folder</button>
          <button className={`${styles.cmdBtn} ${styles.cmdPrimary}`} onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Icon name="upload" size={15} /> {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>

        {/* filter chips */}
        <div className={styles.chips}>
          <span className={styles.chipsLabel}>Filter</span>
          {availableKinds.map((k) => (
            <button key={k} className={`${styles.chip} ${kinds.has(k) ? styles.chipOn : ""}`} onClick={() => toggleKind(k)}>
              <Icon name={KIND_ICON[k] ?? "grid"} size={12} /> {k}
            </button>
          ))}
          {reviewStates.map((s) => {
            const on = reviewState === s.key;
            return (
              <button key={s.key} className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                onClick={() => { setReviewState(on ? "" : s.key); setSmart(""); }}>
                <span className={styles.dot} style={{ background: s.color, boxShadow: `0 0 7px -1px ${s.color}` }} /> {s.label}
              </button>
            );
          })}
          <button className={`${styles.chip} ${minHeight >= 2160 ? styles.chipOn : ""}`} onClick={() => { setMinHeight(minHeight >= 2160 ? 0 : 2160); setSmart(""); }}>≥ 4K</button>
          {codecProRes && (
            <button className={`${styles.chip} ${codec === codecProRes ? styles.chipOn : ""}`} onClick={() => setCodec(codec === codecProRes ? "" : codecProRes)}>ProRes</button>
          )}
          <button className={`${styles.chip} ${minRating >= 4 ? styles.chipOn : ""}`} onClick={() => { setMinRating(minRating >= 4 ? 0 : 4); setSmart(""); }}>★ 4+</button>

          <div className={styles.moreWrap} onClick={(e) => e.stopPropagation()}>
            <button className={`${styles.chip} ${styles.chipDashed}`} onClick={() => setMore((m) => !m)}>
              <Icon name="filter" size={13} /> More filters
            </button>
            {more && (
              <div className={styles.morePop}>
                {(status?.facets.codecs.length ?? 0) > 0 && (
                  <label className={styles.moreField}>
                    <span>Codec</span>
                    <select className={styles.moreSel} value={codec} onChange={(e) => setCodec(e.target.value)}>
                      <option value="">Any codec</option>
                      {status?.facets.codecs.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                )}
                <label className={styles.moreField}>
                  <span>Min resolution</span>
                  <select className={styles.moreSel} value={minHeight} onChange={(e) => setMinHeight(Number(e.target.value))}>
                    <option value={0}>Any</option>
                    <option value={720}>≥ 720p</option>
                    <option value={1080}>≥ 1080p</option>
                    <option value={2160}>≥ 2160p (4K)</option>
                  </select>
                </label>
                <label className={styles.moreField}>
                  <span>Min rating</span>
                  <select className={styles.moreSel} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                    <option value={0}>Any rating</option>
                    <option value={3}>≥ 3★</option>
                    <option value={4}>≥ 4★</option>
                    <option value={5}>5★ only</option>
                  </select>
                </label>
                {searchActive && (
                  <button className={styles.moreClear} onClick={() => { onRoot(); setMore(false); }}>
                    <Icon name="x" size={12} /> Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* content */}
        <div className={styles.content}>
          {noIndex ? (
            <div className={styles.empty}>
              <p>No footage indexed yet.</p>
              <p className={styles.emptySub}>
                Drop files into <code>studiolibrary/test-media</code>, then run <code>pnpm library:once</code> to crawl + build proxies.
              </p>
            </div>
          ) : view === "columns" ? (
            /* Columns self-manages its cascade (incl. empty folders), so the
               folder navigation is always available — never short-circuited. */
            <ColumnsView path={path} volumeId={volumeId} onOpenFolder={goExplorer} activeId={inspectId} ctx={ctx} />
          ) : explorerEmpty ? (
            <div className={styles.empty}>This folder is empty. Drop files here or use Upload.</div>
          ) : flatEmpty ? (
            <div className={styles.empty}>Nothing matches these filters.</div>
          ) : noAssetsForView ? (
            <div className={styles.empty}>No footage in this view. Switch to <b>Grid</b> to browse folders.</div>
          ) : view === "list" ? (
            <ListView assets={viewAssets} ctx={ctx} />
          ) : view === "gallery" ? (
            <GalleryView assets={viewAssets} activeId={inspectId} ctx={ctx} />
          ) : (
            <GridView folders={folderNodes} assets={viewAssets} extra={extraNodes} ctx={ctx} loading={dataMode === "explorer" ? browseLoading : loading} />
          )}
        </div>

        {/* bulk action bar */}
        {selCount > 0 && (
          <div className={styles.bulk} onClick={(e) => e.stopPropagation()}>
            <span className={styles.bulkCount}>
              <b>{selCount}</b> selected
              <button className={styles.bulkClear} onClick={clearSelection}>clear</button>
            </span>
            <div className={styles.bulkActions}>
              <div className={styles.menuWrap}>
                <button className={styles.bulkBtn} onClick={() => setBar(bar === "collection" ? "" : "collection")}>
                  <Icon name="layers" size={13} /> Collection <Icon name="chevronDown" size={11} />
                </button>
                {bar === "collection" && (
                  <div className={styles.pop}>
                    {collections.map((c) => (
                      <button key={c.id} className={styles.popItem} onClick={() => addToCollection(c.id, [...selected], c.name)}>
                        <Icon name="layers" size={12} /> {c.name} <span className={styles.popN}>{c.count}</span>
                      </button>
                    ))}
                    <button className={styles.popItem} onClick={() => newCollection([...selected])}><Icon name="plus" size={12} /> New collection…</button>
                  </div>
                )}
              </div>
              <div className={styles.menuWrap}>
                <button className={styles.bulkBtn} onClick={() => setBar(bar === "state" ? "" : "state")}>
                  <Icon name="checkcircle" size={13} /> State <Icon name="chevronDown" size={11} />
                </button>
                {bar === "state" && (
                  <div className={styles.pop}>
                    {reviewStates.map((s) => (
                      <button key={s.key} className={styles.popItem} onClick={() => setStateFor([...selected], s.key, s.label)}>
                        <span className={styles.dot} style={{ background: s.color }} /> {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.menuWrap}>
                <button className={styles.bulkBtn} onClick={() => setBar(bar === "move" ? "" : "move")}>
                  <Icon name="star" size={13} /> Rate <Icon name="chevronDown" size={11} />
                </button>
                {bar === "move" && (
                  <div className={styles.pop}>
                    {[5, 4, 3, 2, 1, 0].map((r) => (
                      <button key={r} className={styles.popItem} onClick={() => rateFor([...selected], r)}>{r === 0 ? "Clear rating" : "★".repeat(r)}</button>
                    ))}
                  </div>
                )}
              </div>
              <FolderPickerButton folders={status?.folders ?? []} onPick={(f) => moveAssets([...selected], f)} />
              <button className={styles.bulkBtn} onClick={openCompare} disabled={!canCompare} title={canCompare ? "Compare side-by-side" : "Select 2–4 videos to compare"}>
                <Icon name="film" size={13} /> Compare
              </button>
              <button className={styles.bulkBtn} onClick={() => shareAssets([...selected])}><Icon name="share" size={13} /> Share</button>
              <button className={`${styles.bulkBtn} ${styles.bulkDanger}`} onClick={() => deleteAssets([...selected])}><Icon name="trash" size={13} /> Delete</button>
            </div>
          </div>
        )}
      </main>

      {/* ── pane 4 · inspector ── */}
      <Inspector
        detail={inspectDetail}
        loading={inspectLoading}
        reviewStates={reviewStates}
        approveState={approveState}
        rejectState={rejectState}
        volumeName={volumeName}
        onSetState={(key) => inspectId != null && setStateFor([inspectId], key, reviewStates.find((s) => s.key === key)?.label ?? key)}
        onRate={(r) => inspectId != null && rateFor([inspectId], r)}
        onAddTag={async (label) => {
          if (inspectId == null) return;
          await fetch("/api/library/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: inspectId, action: "tag", label }) }).catch(() => {});
          flash(`Tagged → ${label}`); reloadInspect();
        }}
        onOpen={() => inspectId != null && router.push(`/library/${inspectId}`)}
        onClose={() => setInspectId(null)}
        onShare={() => inspectId != null && shareAssets([inspectId])}
      />

      {/* ── context menus + toast ── */}
      {menu && (
        <div className={styles.ctx} style={{ left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 240), top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button className={styles.ctxItem} onClick={() => { router.push(`/library/${menu.asset.id}`); setMenu(null); }}><Icon name="expand" size={13} /> Open</button>
          <button className={styles.ctxItem} onClick={() => { inspect(menu.asset); setMenu(null); }}><Icon name="eye" size={13} /> Inspect</button>
          <button className={styles.ctxItem} onClick={() => { renameAsset(menu.asset); setMenu(null); }}><Icon name="tools" size={13} /> Rename…</button>
          <button className={styles.ctxItem} onClick={() => { copyPath(menu.asset); setMenu(null); }}><Icon name="copy" size={13} /> Copy path</button>
          <div className={styles.ctxSub}>
            <button className={styles.ctxItem} onClick={() => setMenuSub(menuSub === "move" ? "" : "move")}><Icon name="arrowRight" size={13} /> Move to folder <Icon name="chevronRight" size={12} /></button>
            {menuSub === "move" && (
              <div className={styles.ctxFlyout}>
                {(status?.folders ?? []).map((f) => (
                  <button key={f.folder} className={styles.ctxItem} onClick={() => { moveAssets(idsToActOn(menu.asset), f.folder); setMenu(null); }}>{f.folder.split("/").pop() || f.folder}</button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.ctxSub}>
            <button className={styles.ctxItem} onClick={() => setMenuSub(menuSub === "collection" ? "" : "collection")}><Icon name="layers" size={13} /> Add to collection <Icon name="chevronRight" size={12} /></button>
            {menuSub === "collection" && (
              <div className={styles.ctxFlyout}>
                {collections.map((c) => (
                  <button key={c.id} className={styles.ctxItem} onClick={() => { addToCollection(c.id, idsToActOn(menu.asset), c.name); setMenu(null); }}>{c.name}</button>
                ))}
                <button className={styles.ctxItem} onClick={() => { newCollection(idsToActOn(menu.asset)); setMenu(null); }}><Icon name="plus" size={12} /> New collection…</button>
              </div>
            )}
          </div>
          <div className={styles.ctxSub}>
            <button className={styles.ctxItem} onClick={() => setMenuSub(menuSub === "state" ? "" : "state")}><Icon name="checkcircle" size={13} /> Set state <Icon name="chevronRight" size={12} /></button>
            {menuSub === "state" && (
              <div className={styles.ctxFlyout}>
                {reviewStates.map((s) => (
                  <button key={s.key} className={styles.ctxItem} onClick={() => { setStateFor(idsToActOn(menu.asset), s.key, s.label); setMenu(null); }}><span className={styles.dot} style={{ background: s.color }} /> {s.label}</button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.ctxDivider} />
          <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => { deleteAssets(idsToActOn(menu.asset)); setMenu(null); }}><Icon name="trash" size={13} /> Delete</button>
        </div>
      )}

      {folderMenu && (
        <div className={styles.ctx} style={{ left: Math.min(folderMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 240), top: folderMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button className={styles.ctxItem} onClick={() => { goExplorer(folderMenu.folder.path); setFolderMenu(null); }}><Icon name="expand" size={13} /> Open</button>
          <button className={styles.ctxItem} onClick={() => { renameFolder(folderMenu.folder); setFolderMenu(null); }}><Icon name="tools" size={13} /> Rename…</button>
          <div className={styles.ctxDivider} />
          <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => { trashFolder(folderMenu.folder); setFolderMenu(null); }}><Icon name="trash" size={13} /> Delete folder</button>
        </div>
      )}

      {toast && (
        <div className={styles.toast}><Icon name="check" size={14} /> <span>{toast}</span></div>
      )}
    </div>
  );
}

function smartLabel(smart: string, smartFolders: SmartFolder[]): string {
  if (smart === "recents") return "Recents";
  if (smart === "favorites") return "Favorites";
  if (smart === "uhd") return "Ultra HD · 4K+";
  if (smart.startsWith("review:")) {
    const key = smart.slice(7);
    return smartFolders.find((s) => s.key === key)?.label ?? "Filtered";
  }
  return "Filtered";
}

/** "Move to…" folder picker for the bulk bar. */
function FolderPickerButton({ folders, onPick }: { folders: { folder: string; n: number }[]; onPick: (folder: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.menuWrap}>
      <button className={styles.bulkBtn} onClick={() => setOpen((o) => !o)}><Icon name="arrowRight" size={13} /> Move <Icon name="chevronDown" size={11} /></button>
      {open && (
        <div className={styles.pop}>
          {folders.length === 0 && <div className={styles.popEmpty}>No folders</div>}
          {folders.map((f) => (
            <button key={f.folder} className={styles.popItem} onClick={() => { onPick(f.folder); setOpen(false); }} title={f.folder}>
              <Icon name="chevronRight" size={12} /> {f.folder.split("/").pop() || f.folder} <span className={styles.popN}>{f.n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
