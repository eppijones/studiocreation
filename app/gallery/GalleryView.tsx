"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStudio } from "../components/AppShell";
import { Card, Btn, Chip, Seg, ProviderBadge, useToast } from "../components/ui";
import { Tile } from "../components/Media";
import { Icon } from "../components/Icon";
import { JobProgress } from "../components/JobProgress";
import { glowVars, modelShort, relTime, isInFlight, usd, type ClientJob } from "../components/studio";

type AssetStatus = "new" | "flagged" | "hidden" | "approved" | "delivered";

interface GalleryAsset {
  id: number;
  job_id: number;
  blob_url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  review_note: string | null;
  status: AssetStatus;
  tags: string[];
  approved_by: string | null;
  created_at: string;
  model: string;
  project: string;
  label: string;
  operator: string;
  prompt: string;
  est_usd: string;
  actual_usd: string | null;
  request_id?: string | null;
}

type KindFilter = "" | "image" | "video";
type Layout = "masonry" | "grid";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Everything" },
  { value: "new", label: "To review" },
  { value: "approved", label: "✅ Used" },
  { value: "hidden", label: "🙈 Hidden" },
  { value: "delivered", label: "🚀 Delivered" },
];

const SKELETON_ASPECTS = ["3 / 4", "1 / 1", "4 / 5", "9 / 16", "3 / 4", "1 / 1", "4 / 5", "3 / 4"];

function isVideo(ct: string | null | undefined): boolean {
  return !!ct && ct.startsWith("video");
}

function aspectFor(a: GalleryAsset): string | undefined {
  if (a.width && a.height) return `${a.width} / ${a.height}`;
  return undefined;
}

export function GalleryView({ initialOpenId }: { initialOpenId?: number } = {}) {
  const toast = useToast();
  const { jobs, activeJobs, role } = useStudio();
  // Permanent delete is producer/finance/admin only (server-enforced); creatives Hide instead.
  const canDelete = role !== "" && role !== "creative";
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<KindFilter>("");
  const [statusFilter, setStatusFilter] = useState("active"); // active = everything except hidden
  const [projectFilter, setProjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<Layout>("masonry");
  const [openId, setOpenId] = useState<number | null>(initialOpenId ?? null);

  // Keep the address bar in sync so an open render is a shareable deep link
  // (/gallery/<id>), and closing returns to /gallery — without a full navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = openId != null ? `/gallery/${openId}` : "/gallery";
    if (window.location.pathname !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [openId]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // drag-drop organizer state
  const [extraProjects, setExtraProjects] = useState<string[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [newProject, setNewProject] = useState("");

  const loadAssets = useCallback(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // While renders are in flight, keep the wall live so finished ones drop in.
  useEffect(() => {
    if (activeJobs === 0) return;
    const id = setInterval(loadAssets, 3000);
    return () => clearInterval(id);
  }, [activeJobs, loadAssets]);

  // Catch the completion edge even if polling stops the instant the last job finishes.
  const doneCount = useMemo(() => jobs.filter((j) => j.status === "done").length, [jobs]);
  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount]);

  // In-flight jobs surface as animated placeholders at the head of the wall.
  const livePlaceholders = useMemo(() => {
    if (statusFilter !== "active" && statusFilter !== "new") return [] as ClientJob[];
    const q = query.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        isInFlight(j.status) &&
        (!projectFilter || j.project === projectFilter) &&
        (!q || `${j.prompt} ${j.label} ${j.project}`.toLowerCase().includes(q))
    );
  }, [jobs, statusFilter, projectFilter, query]);

  const filtersActive =
    kindFilter !== "" || statusFilter !== "active" || projectFilter !== "" || query.trim() !== "";

  const clearFilters = () => {
    setKindFilter("");
    setStatusFilter("active");
    setProjectFilter("");
    setQuery("");
  };

  // project buckets with live counts (+ any freshly-created empty buckets)
  const projects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      if (a.status === "hidden") continue;
      counts.set(a.project, (counts.get(a.project) ?? 0) + 1);
    }
    for (const p of extraProjects) if (!counts.has(p)) counts.set(p, 0);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [assets, extraProjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (statusFilter === "active") {
        if (a.status === "hidden") return false;
      } else if (a.status !== statusFilter) {
        return false;
      }
      if (projectFilter && a.project !== projectFilter) return false;
      const vid = isVideo(a.content_type);
      if (kindFilter === "image" && vid) return false;
      if (kindFilter === "video" && !vid) return false;
      if (q && !(`${a.prompt} ${a.label} ${a.project} ${a.tags.join(" ")}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [assets, statusFilter, projectFilter, kindFilter, query]);

  // Renders from one generation (count > 1) cluster under their job, so a
  // multi-up batch reads as a single boxed set on the wall. Assets arrive id-DESC
  // and a job's assets share consecutive ids, so they're already adjacent.
  const groups = useMemo(() => {
    const out: { jobId: number; assets: GalleryAsset[] }[] = [];
    for (const a of filtered) {
      const last = out[out.length - 1];
      if (last && last.jobId === a.job_id) last.assets.push(a);
      else out.push({ jobId: a.job_id, assets: [a] });
    }
    return out;
  }, [filtered]);

  const current = openId == null ? null : assets.find((a) => a.id === openId) ?? null;
  const currentIndex = current ? filtered.findIndex((a) => a.id === current.id) : -1;

  const patch = useCallback(
    async (asset: GalleryAsset, body: Record<string, unknown>) => {
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, ...body } : a)));
      try {
        const res = await fetch(`/api/assets/${asset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, ...updated } : a)));
        }
        return res.ok;
      } catch {
        return false;
      }
    },
    []
  );

  const applyStatus = useCallback(
    (asset: GalleryAsset, next: AssetStatus) => {
      patch(asset, { status: next });
      if (next === "approved") {
        toast({ kind: "ok", title: "Kept", sub: "Added to the used set — ready to finalize" });
      } else if (next === "hidden") {
        toast({ kind: "info", title: "Hidden", sub: "Tucked away — toggle Hidden to bring it back" });
      }
    },
    [patch, toast]
  );

  // toggle for the wall quick-actions (click an active state to undo it)
  const setStatus = useCallback(
    (asset: GalleryAsset, status: AssetStatus) => {
      applyStatus(asset, asset.status === status ? "new" : status);
    },
    [applyStatus]
  );

  const setTags = useCallback((asset: GalleryAsset, tags: string[]) => patch(asset, { tags }), [patch]);

  // Reassign an asset's project (moves its parent job). Mirror locally for siblings.
  const reassignProject = useCallback(
    async (assetId: number, project: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset || asset.project === project) return;
      const jobId = asset.job_id;
      setAssets((prev) => prev.map((a) => (a.job_id === jobId ? { ...a, project } : a)));
      try {
        await fetch(`/api/assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project }),
        });
        toast({ kind: "ok", title: `Moved to ${project}`, sub: "Project reassigned" });
      } catch {
        toast({ kind: "bad", title: "Move failed", sub: "Could not reassign project" });
      }
    },
    [assets, toast]
  );

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (currentIndex < 0) return;
      const next = filtered[currentIndex + dir];
      if (next) setOpenId(next.id);
    },
    [currentIndex, filtered]
  );

  // Permanent removal — drops the Blob original and the row. Used by the overlay
  // and the bulk bar; optimistic so the wall updates instantly.
  const removeAssets = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;
      setAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/assets/${id}`, { method: "DELETE" }))
      );
      const forbidden = results.some((r) => r.status === "fulfilled" && r.value.status === 403);
      const failed = results.filter((r) => r.status === "rejected" || (r.value && !r.value.ok)).length;
      if (forbidden) {
        toast({ kind: "bad", title: "Delete not allowed", sub: "Producer/admin only — Hide it instead. Reloading." });
        loadAssets();
      } else if (failed) {
        toast({ kind: "bad", title: "Some deletes failed", sub: `${failed} couldn't be removed — reloading` });
        loadAssets();
      } else {
        toast({
          kind: "ok",
          title: ids.length === 1 ? "Deleted" : `Deleted ${ids.length}`,
          sub: "Removed from the library for good",
        });
      }
    },
    [toast, loadAssets]
  );

  const confirmDelete = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      const ok = window.confirm(
        ids.length === 1
          ? "Delete this render permanently? This removes the file and can't be undone."
          : `Delete ${ids.length} renders permanently? This removes the files and can't be undone.`
      );
      if (ok) removeAssets(ids);
    },
    [removeAssets]
  );

  // ---- selection (bulk) ----
  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelect = useCallback(() => setSelected(new Set()), []);

  const batchStatus = useCallback(
    (status: AssetStatus) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      setAssets((prev) => prev.map((a) => (selected.has(a.id) ? { ...a, status } : a)));
      ids.forEach((id) =>
        fetch(`/api/assets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }).catch(() => {})
      );
      toast({
        kind: status === "approved" ? "ok" : "info",
        title: status === "approved" ? `Kept ${ids.length}` : `Hid ${ids.length}`,
        sub: status === "approved" ? "Added to the used set" : "Tucked away",
      });
      clearSelect();
    },
    [selected, toast, clearSelect]
  );

  const batchMove = useCallback(
    (project: string) => {
      const ids = [...selected];
      if (ids.length === 0 || !project) return;
      const jobIds = new Set(assets.filter((a) => selected.has(a.id)).map((a) => a.job_id));
      setAssets((prev) => prev.map((a) => (jobIds.has(a.job_id) ? { ...a, project } : a)));
      ids.forEach((id) =>
        fetch(`/api/assets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project }),
        }).catch(() => {})
      );
      toast({ kind: "ok", title: `Moved ${ids.length} → ${project}`, sub: "Project reassigned" });
      clearSelect();
    },
    [selected, assets, toast, clearSelect]
  );

  // ---- cull flow: decide, then jump to the next still-to-review render ----
  const decideAndAdvance = useCallback(
    (asset: GalleryAsset, status: AssetStatus) => {
      applyStatus(asset, status);
      const idx = filtered.findIndex((a) => a.id === asset.id);
      let next: GalleryAsset | undefined;
      for (let i = idx + 1; i < filtered.length; i++) {
        if (filtered[i].status === "new") { next = filtered[i]; break; }
      }
      if (!next) {
        for (let i = 0; i < idx; i++) {
          if (filtered[i].status === "new") { next = filtered[i]; break; }
        }
      }
      if (next) setOpenId(next.id);
      else toast({ kind: "ok", title: "All caught up", sub: "Nothing left to review" });
    },
    [filtered, applyStatus, toast]
  );

  const openFirstToReview = useCallback(() => {
    const first = filtered.find((a) => a.status === "new") ?? filtered[0];
    if (first) setOpenId(first.id);
  }, [filtered]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") setOpenId(null);
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(1);
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        decideAndAdvance(current, "approved");
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        decideAndAdvance(current, "hidden");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, navigate, decideAndAdvance]);

  function addProjectBucket() {
    const name = newProject.trim().slice(0, 60);
    if (!name) return;
    setExtraProjects((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewProject("");
  }

  const renderTile = (a: GalleryAsset) => {
    const dim = a.status === "hidden" || a.status === "flagged";
    const isSel = selected.has(a.id);
    return (
      <div
        key={a.id}
        className={`tile-wrap ${dragId === a.id ? "dragging" : ""} ${isSel ? "selected" : ""}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(a.id));
          e.dataTransfer.effectAllowed = "move";
          setDragId(a.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropTarget(null);
        }}
        style={dim ? { opacity: 0.5 } : undefined}
      >
        <button
          className={`tile-check ${isSel ? "on" : ""}`}
          title={isSel ? "Deselect" : "Select"}
          aria-label={isSel ? "Deselect render" : "Select render"}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(a.id);
          }}
        >
          {isSel && <Icon name="check" size={13} />}
        </button>
        <Tile
          asset={{
            id: a.id,
            blob_url: a.blob_url,
            content_type: a.content_type,
            status: a.status,
            score: a.score,
            hueKey: a.job_id,
            prompt: a.prompt,
            label: a.label,
            width: a.width,
            height: a.height,
            aspect: aspectFor(a) ?? "1 / 1",
            duration_s: a.duration_s,
            featured: a.tags.includes("showcaser"),
          }}
          fit={layout === "masonry" ? "natural" : "contain"}
          caption
          ariaLabel={`${a.project}/${a.label} — ${a.prompt || "render"}`}
          onClick={(e?: React.MouseEvent) => {
            if (e && (e.metaKey || e.ctrlKey || selected.size > 0)) {
              toggleSelect(a.id);
            } else {
              setOpenId(a.id);
            }
          }}
        />
        {/* one-tap decision — happy → Use, not → Hide */}
        <div className="tile-actions">
          <button
            className={`tile-act use ${a.status === "approved" ? "on ok" : ""}`}
            title="Use this (U)"
            onClick={(e) => {
              e.stopPropagation();
              setStatus(a, "approved");
            }}
          >
            <Icon name="checkcircle" size={14} /> Use
          </button>
          <button
            className={`tile-act ${a.status === "hidden" ? "on bad" : ""}`}
            title="Hide (H)"
            onClick={(e) => {
              e.stopPropagation();
              setStatus(a, "hidden");
            }}
          >
            <Icon name="x" size={14} /> Hide
          </button>
        </div>
      </div>
    );
  };

  const toReview = filtered.filter((a) => a.status === "new").length;
  const kept = filtered.filter((a) => a.status === "approved" || a.status === "delivered").length;
  const title = filtersActive ? `${filtered.length} renders filtered` : `${filtered.length} renders`;
  const statusLine =
    filtered.length === 0
      ? "Nothing matches — loosen a filter."
      : `${toReview} to review · ${kept} kept · drag a render onto a project to organize`;

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Gallery</p>
          <h1 className="t-h1">{title}</h1>
          <p className="t-body">{statusLine}</p>
        </div>
        <div className="actions row gap3 wrap">
          {toReview > 0 && (
            <Btn variant="primary" size="sm" icon="play" onClick={openFirstToReview}>
              Review {toReview}
            </Btn>
          )}
          <label className="row gap2" style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 11, color: "var(--tx-3)", display: "grid", placeItems: "center", pointerEvents: "none" }}>
              <Icon name="search" size={15} />
            </span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompt, tag, project"
              style={{ paddingLeft: 34, width: 240 }}
            />
          </label>
          <Seg
            options={[
              { value: "masonry", label: "Masonry" },
              { value: "grid", label: "Grid" },
            ]}
            value={layout}
            onChange={(v) => setLayout(v as Layout)}
          />
        </div>
      </div>

      <div className="split" style={{ gridTemplateColumns: "224px 1fr" }}>
        {/* ORGANIZER RAIL */}
        <Card pad style={{ alignSelf: "start", position: "sticky", top: 0 }}>
          <div className="col gap5">
            {/* PROJECTS — click to filter, drag a render here to move it */}
            <div>
              <span className="field-label">Projects</span>
              <div className="col gap1">
                <button
                  className={`proj-row ${projectFilter === "" ? "on" : ""}`}
                  onClick={() => setProjectFilter("")}
                >
                  <span className="grow">All projects</span>
                  <span className="proj-count">{assets.filter((a) => a.status !== "hidden").length}</span>
                </button>
                {projects.map(([p, n]) => (
                  <button
                    key={p}
                    className={`proj-row ${projectFilter === p ? "on" : ""} ${dropTarget === p ? "drop" : ""}`}
                    onClick={() => setProjectFilter((cur) => (cur === p ? "" : p))}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget(p);
                    }}
                    onDragLeave={() => setDropTarget((d) => (d === p ? null : d))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = Number(e.dataTransfer.getData("text/plain"));
                      if (id) reassignProject(id, p);
                      setDropTarget(null);
                      setDragId(null);
                    }}
                  >
                    <span className="grow" style={{ textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p}
                    </span>
                    <span className="proj-count">{n}</span>
                  </button>
                ))}
              </div>
              <div className="row gap2" style={{ marginTop: 8 }}>
                <input
                  className="input"
                  style={{ height: 30, fontSize: 12 }}
                  placeholder="+ new project"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addProjectBucket()}
                />
              </div>
              {dragId != null && <p className="t-xs muted" style={{ marginTop: 8 }}>Drop on a project to move it.</p>}
            </div>

            <FilterGroup label="Type">
              <Seg
                options={[
                  { value: "", label: "All" },
                  { value: "image", label: "Image" },
                  { value: "video", label: "Video" },
                ]}
                value={kindFilter}
                onChange={(v) => setKindFilter(v as KindFilter)}
              />
            </FilterGroup>

            <FilterGroup label="Status">
              <div className="row gap2 wrap">
                {STATUS_OPTIONS.map((o) => (
                  <Chip key={o.value} on={statusFilter === o.value} onClick={() => setStatusFilter(o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </FilterGroup>

            {filtersActive && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ alignSelf: "flex-start" }}>
                <Icon name="x" size={13} /> Clear filters
              </button>
            )}
          </div>
        </Card>

        {/* WALL */}
        <div style={{ minWidth: 0 }}>
          {loading ? (
            <div className={layout === "masonry" ? "masonry" : "grid-4"}>
              {SKELETON_ASPECTS.map((ar, i) => (
                <div key={i} className="tile skeleton" style={{ aspectRatio: ar }} />
              ))}
            </div>
          ) : filtered.length === 0 && livePlaceholders.length === 0 ? (
            <div className="empty">
              <Icon name="gallery" size={40} />
              <span>
                {assets.length === 0
                  ? "No renders yet — send something from Create."
                  : "Nothing matches these filters."}
              </span>
              {filtersActive && assets.length > 0 && (
                <Btn variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Btn>
              )}
            </div>
          ) : (
            <div className={layout === "masonry" ? "masonry" : "grid-4"}>
              {livePlaceholders.map((j) => (
                <LiveTile key={`live-${j.id}`} job={j} />
              ))}
              {groups.map((g) =>
                g.assets.length === 1 ? (
                  renderTile(g.assets[0])
                ) : (
                  <div key={`group-${g.jobId}`} className="tile-group">
                    <div className="tile-group-hd">
                      <span className="tile-group-count">{g.assets.length}-up</span>
                      <span className="tile-group-prompt">
                        {g.assets[0].prompt || `${g.assets[0].project}/${g.assets[0].label}`}
                      </span>
                    </div>
                    <div className="tile-group-grid">{g.assets.map(renderTile)}</div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulkbar">
          <span className="bulk-count">{selected.size} selected</span>
          <button className="bulk-act use" onClick={() => batchStatus("approved")}>
            <Icon name="checkcircle" size={15} /> Use
          </button>
          <button className="bulk-act hide" onClick={() => batchStatus("hidden")}>
            <Icon name="x" size={15} /> Hide
          </button>
          {canDelete && (
            <button className="bulk-act del" onClick={() => confirmDelete([...selected])}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
          <span className="bulk-sep" />
          <label className="bulk-move">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) batchMove(e.target.value);
              }}
            >
              <option value="">Move to…</option>
              {projects.map(([p]) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button className="bulk-clear" onClick={clearSelect} aria-label="Clear selection">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {current && (
        <ReviewOverlay
          asset={current}
          index={currentIndex}
          total={filtered.length}
          strip={filtered}
          canDelete={canDelete}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex >= 0 && currentIndex < filtered.length - 1}
          onClose={() => setOpenId(null)}
          onPrev={() => navigate(-1)}
          onNext={() => navigate(1)}
          onJump={(id) => setOpenId(id)}
          onDecide={(s) => decideAndAdvance(current, s)}
          onTags={(t) => setTags(current, t)}
          onDelete={() => {
            const ok = window.confirm(
              "Delete this render permanently? This removes the file and can't be undone."
            );
            if (!ok) return;
            setOpenId(null);
            removeAssets([current.id]);
          }}
        />
      )}
    </div>
  );
}

/** Route entry for /gallery — keeps the default export a clean Next page while
 *  the reusable wall lives in `GalleryView` (also used by /gallery/[id]). */
export default function GalleryPage() {
  return <GalleryView />;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

/** Animated placeholder for an in-flight render — fades out once the real tile lands. */
function LiveTile({ job }: { job: ClientJob }) {
  const err = job.status === "error";
  return (
    <div className={`live-tile ${err ? "err" : ""}`} style={glowVars(job.operator)}>
      <div className="mesh" />
      <div className="live-head">
        <span className="live-dot" />
        {modelShort(job.model)} · {job.project}/{job.label}
      </div>
      <div className="live-prompt">{job.prompt || "Generating…"}</div>
      {err ? (
        <div className="t-xs" style={{ color: "var(--bad-tx)" }}>⚠️ {job.error ?? "Failed"}</div>
      ) : (
        <JobProgress job={job} />
      )}
    </div>
  );
}

function ReviewOverlay({
  asset,
  index,
  total,
  strip,
  canDelete,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onJump,
  onDecide,
  onTags,
  onDelete,
}: {
  asset: GalleryAsset;
  index: number;
  total: number;
  strip: GalleryAsset[];
  canDelete: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (id: number) => void;
  onDecide: (s: AssetStatus) => void;
  onTags: (tags: string[]) => void;
  onDelete: () => void;
}) {
  const vid = isVideo(asset.content_type);
  const kept = asset.status === "approved" || asset.status === "delivered";
  const estUsd = Number(asset.est_usd ?? 0);
  const actualUsd = asset.actual_usd != null ? Number(asset.actual_usd) : null;
  const cost = actualUsd ?? estUsd;
  const driftPct = actualUsd != null && estUsd > 0 ? Math.round((Math.abs(actualUsd - estUsd) / estUsd) * 1000) / 10 : null;
  const dims = asset.width && asset.height ? `${asset.width}×${asset.height}` : "—";
  const format = vid ? `video${asset.duration_s ? ` · ${asset.duration_s}s` : ""}` : "image";
  const [tagDraft, setTagDraft] = useState("");
  const stripRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

  // keep the active thumbnail in view as you move through the set
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(".strip-thumb.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [asset.id]);

  // track native fullscreen so the icon flips expand ⇄ compress
  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === artRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else artRef.current?.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else artRef.current?.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="review sheet" onClick={(e) => e.stopPropagation()}>
        {/* ART — opening the review plays video with sound, from the start */}
        <div className={`review-art ${isFs ? "fs" : ""}`} ref={artRef}>
          {vid ? (
            <video
              src={asset.blob_url}
              controls
              autoPlay
              loop
              playsInline
              muted={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.blob_url}
              alt={asset.label}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}
          <span className="review-counter">{index + 1} / {total}</span>
          <button
            className="review-fs"
            onClick={toggleFullscreen}
            aria-label={isFs ? "Exit fullscreen" : "View fullscreen"}
            title={isFs ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          >
            <Icon name={isFs ? "compress" : "expand"} size={16} />
          </button>
          {hasPrev && (
            <button className="review-nav" style={{ left: 16 }} onClick={onPrev} aria-label="Previous">
              <Icon name="chevronRight" size={20} style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
          {hasNext && (
            <button className="review-nav" style={{ right: 16 }} onClick={onNext} aria-label="Next">
              <Icon name="chevronRight" size={20} />
            </button>
          )}
          {/* FILMSTRIP — see where you are, jump anywhere */}
          <div className="filmstrip" ref={stripRef}>
            {strip.map((s) => {
              const sv = isVideo(s.content_type);
              const sk = s.status === "approved" || s.status === "delivered";
              return (
                <button
                  key={s.id}
                  className={`strip-thumb ${s.id === asset.id ? "on" : ""} ${sk ? "kept" : ""}`}
                  style={glowVars(s.job_id)}
                  onClick={() => onJump(s.id)}
                  aria-label={`Go to ${s.project}/${s.label}`}
                >
                  {s.blob_url && !sv ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.blob_url} alt="" loading="lazy" />
                  ) : (
                    <span className="strip-mesh" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SIDE */}
        <div className="review-side">
          <div className="between" style={{ alignItems: "flex-start" }}>
            <div>
              <h2 className="t-h2" style={{ margin: 0 }}>
                {asset.project}/{asset.label}
              </h2>
              <p className="t-xs mono muted" style={{ marginTop: 4 }}>
                #{asset.id} · {index + 1} of {total} · {relTime(asset.created_at)}
              </p>
            </div>
            <button className="icon-btn ghost" onClick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* what it cost to make this piece — actual fal bill once reconciled, estimate until then */}
          <div className={`review-cost ${actualUsd != null ? "billed" : ""}`}>
            <span className="review-cost-amt">{usd(cost, cost < 1 ? 3 : 2)}</span>
            <div className="col" style={{ gap: 2, minWidth: 0 }}>
              <span className="review-cost-lab">
                {actualUsd != null ? "Actual cost · billed by fal" : "Estimated cost"}
              </span>
              <span className="t-xs muted mono">
                {actualUsd != null
                  ? driftPct === null || driftPct === 0
                    ? `matches estimate (${usd(estUsd, 3)})`
                    : `est ${usd(estUsd, 3)} · ${actualUsd >= estUsd ? "+" : "−"}${driftPct}% vs estimate`
                  : "fal bill pending — reconcile on Costs to confirm"}
              </span>
            </div>
          </div>

          <div className="review-prompt mono">{asset.prompt || "No prompt recorded."}</div>

          {asset.score != null && (
            <div className={`ai-score ${asset.score >= 8 ? "hi" : asset.score >= 5 ? "mid" : "lo"}`}>
              <span className="ai-score-num">
                {asset.score}
                <span className="ai-score-max">/10</span>
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="t-label" style={{ margin: 0 }}>AI fidelity score</div>
                <div className="t-xs muted">{asset.review_note || "Auto-rated against the prompt."}</div>
              </div>
            </div>
          )}

          {/* FEATURE ON LOGIN — the `showcaser` tag drives the public login wall */}
          {(() => {
            const featured = asset.tags.includes("showcaser");
            return (
              <button
                type="button"
                className={`feature-toggle ${featured ? "on" : ""}`}
                onClick={() =>
                  onTags(
                    featured
                      ? asset.tags.filter((t) => t !== "showcaser")
                      : [...asset.tags, "showcaser"]
                  )
                }
                title="Tag as showcaser — features this render on the sign-in screen"
              >
                <span className="feature-ic">
                  <Icon name="spark" size={16} />
                </span>
                <span className="grow" style={{ textAlign: "left" }}>
                  <span className="feature-title">
                    {featured ? "Featured on the login screen" : "Feature on the login screen"}
                  </span>
                  <span className="feature-sub">
                    {featured ? "Showing in the studio showcase wall" : "Add to the showcase wall new visitors see"}
                  </span>
                </span>
                <span className={`sw ${featured ? "on" : ""}`} aria-hidden />
              </button>
            );
          })()}

          {/* TAGS — organize without leaving the review */}
          <div>
            <span className="t-label">Tags</span>
            <div className="row gap2 wrap" style={{ marginTop: 8, alignItems: "center" }}>
              {asset.tags.map((t) => (
                <Chip key={t} onRemove={() => onTags(asset.tags.filter((x) => x !== t))}>
                  {t}
                </Chip>
              ))}
              <input
                className="input"
                style={{ width: 150, height: 28, fontSize: 12 }}
                placeholder="+ tag"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagDraft.trim()) {
                    onTags([...asset.tags, tagDraft.trim()]);
                    setTagDraft("");
                  }
                }}
              />
            </div>
          </div>

          <div className="meta-rows mono">
            <div className="meta-row">
              <span className="k">Model</span>
              <span>{modelShort(asset.model)}</span>
            </div>
            <div className="meta-row">
              <span className="k">Operator</span>
              <span>{asset.operator}</span>
            </div>
            <div className="meta-row">
              <span className="k">Provider</span>
              <span>
                <ProviderBadge provider={asset.model} />
              </span>
            </div>
            <div className="meta-row">
              <span className="k">Format</span>
              <span>{format}</span>
            </div>
            <div className="meta-row">
              <span className="k">Dimensions</span>
              <span>{dims}</span>
            </div>
            {asset.approved_by && (
              <div className="meta-row">
                <span className="k">Approved by</span>
                <span>{asset.approved_by}</span>
              </div>
            )}
          </div>

          {kept && (
            <div className="hero-banner">
              <Icon name="checkcircle" size={16} /> In the used set · ready to finalize &amp; deliver
            </div>
          )}

          <div className="decide">
            <button
              className={`decide-btn use ${kept ? "on" : ""}`}
              onClick={() => onDecide("approved")}
            >
              <Icon name="checkcircle" size={18} />
              <span>{kept ? "Used" : "Use it"}</span>
              <kbd>U</kbd>
            </button>
            <button
              className={`decide-btn hide ${asset.status === "hidden" ? "on" : ""}`}
              onClick={() => onDecide("hidden")}
            >
              <Icon name="x" size={18} />
              <span>Hide</span>
              <kbd>H</kbd>
            </button>
          </div>
          <p className="t-xs muted" style={{ textAlign: "center" }}>
            Happy? Use it. Not? Hide it · jumps to the next to review · ← → move · f fullscreen · esc close
          </p>

          <div className="hr" />

          <div className="row gap2 wrap">
            <Btn variant="quiet" size="sm" icon="download" onClick={() => window.open(asset.blob_url, "_blank")}>
              Download
            </Btn>
            <Btn
              variant="quiet"
              size="sm"
              icon="share"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${window.location.origin}/gallery/${asset.id}`)
                  .catch(() => {});
              }}
            >
              Copy link
            </Btn>
            <Link href={`/create?ref=${asset.id}`}>
              <Btn variant="quiet" size="sm" icon="image">
                Use as reference
              </Btn>
            </Link>
            <Link href={`/create?iterate=${asset.id}`}>
              <Btn variant="quiet" size="sm" icon="refresh">
                Iterate
              </Btn>
            </Link>
            {(asset.status === "approved" || asset.status === "delivered") && (
              <Link href="/deliver">
                <Btn variant="quiet" size="sm" icon="deliver">
                  Finalize
                </Btn>
              </Link>
            )}
            {canDelete && (
              <button className="del-btn" onClick={onDelete} title="Delete permanently">
                <Icon name="trash" size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
