"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../components/ui";
import { Icon } from "../components/Icon";
import { hueFor } from "../components/studio";

interface WorkItem {
  id: number;
  filename: string;
  rel_path: string;
  kind: string;
  review_state: string;
  open_tasks: number;
  last_assigned_at: string | null;
}
interface Velocity { actor: string; state_changes: number; comments: number }

const STATE_LABEL: Record<string, string> = {
  new: "To review", in_review: "In review", approved_internal: "Approved · internal",
  approved_client: "Approved · client", rejected: "Rejected", delivered: "Delivered",
};

export default function WorklistPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [velocity, setVelocity] = useState<Velocity[]>([]);
  const [loading, setLoading] = useState(true);
  const [anon, setAnon] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/library/worklist");
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
      setVelocity(Array.isArray(d.velocity) ? d.velocity : []);
      setAnon(!!d.anon);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <header className="page-hd">
        <div className="row gap3" style={{ alignItems: "center" }}>
          <span className="glyph"><Icon name="check" size={20} /></span>
          <div>
            <h1 className="t-h2" style={{ margin: 0 }}>My Work</h1>
            <p className="t-sm muted" style={{ margin: 0 }}>
              {items.length} asset{items.length === 1 ? "" : "s"} assigned to you
            </p>
          </div>
        </div>
      </header>

      {anon && (
        <Card className="t-sm muted" style={{ padding: "12px 14px" }}>
          Sign in with a per-user account to get a personal worklist. (Shared-password mode has no per-person queue.)
        </Card>
      )}

      <div className="worklist-grid">
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div className="t-sm muted" style={{ padding: 16 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div className="notif-empty" style={{ padding: 40 }}>
              <Icon name="check" size={26} />
              <span>Nothing assigned to you right now.</span>
            </div>
          ) : (
            items.map((it) => (
              <button key={it.id} className="work-row" onClick={() => router.push(`/library/${it.id}`)}>
                <span className="work-thumb" style={{ ["--hue" as string]: hueFor(it.rel_path) }}>
                  <Icon name={it.kind === "video" ? "video" : it.kind === "audio" ? "audio" : it.kind === "image" ? "image" : "film"} size={16} />
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="work-title">{it.filename}</span>
                  <span className="work-path">{it.rel_path}</span>
                </span>
                <span className="work-meta">
                  <span className={`pill ${it.review_state === "rejected" ? "error" : it.review_state.startsWith("approved") ? "ready" : "queued"}`}>
                    {STATE_LABEL[it.review_state] ?? it.review_state}
                  </span>
                  <span className="work-tasks"><Icon name="captions" size={12} /> {it.open_tasks} open</span>
                </span>
              </button>
            ))
          )}
        </Card>

        <Card style={{ padding: 16 }}>
          <div className="t-label" style={{ marginBottom: 10 }}>Team velocity · 7 days</div>
          {velocity.length === 0 ? (
            <p className="t-sm muted" style={{ margin: 0 }}>No activity yet.</p>
          ) : (
            <div className="col gap2">
              {velocity.map((v) => (
                <div key={v.actor} className="vel-row">
                  <span className="vel-av" style={{ ["--hue" as string]: hueFor(v.actor) }}>
                    {v.actor.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="grow t-sm">{v.actor}</span>
                  <span className="vel-stat" title="Review decisions">{v.state_changes} ✓</span>
                  <span className="vel-stat" title="Comments">{v.comments} 💬</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
