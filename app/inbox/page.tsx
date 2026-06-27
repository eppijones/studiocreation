"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn } from "../components/ui";
import { Icon } from "../components/Icon";
import { relTime } from "../components/studio";

interface Notif {
  id: number;
  type: string;
  actor_name: string | null;
  asset_id: number | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  mention: "spark", assignment: "check", review_state: "checkcircle",
  comment: "captions", share_comment: "share", job_done: "checkcircle", job_error: "alert",
};
const TYPE_LABEL: Record<string, string> = {
  mention: "Mention", assignment: "Assigned", review_state: "Review", comment: "Comment",
  share_comment: "External", job_done: "Render", job_error: "Failed",
};

export default function InboxPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); } catch { /* best effort */ }
  }

  async function open(n: Notif) {
    if (!n.read_at) {
      try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }); } catch { /* best effort */ }
    }
    if (n.asset_id) router.push(`/library/${n.asset_id}`);
  }

  const shown = filter === "unread" ? items.filter((n) => !n.read_at) : items;
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="page">
      <header className="page-hd">
        <div className="row gap3" style={{ alignItems: "center" }}>
          <span className="glyph"><Icon name="bell" size={20} /></span>
          <div>
            <h1 className="t-h2" style={{ margin: 0 }}>Inbox</h1>
            <p className="t-sm muted" style={{ margin: 0 }}>
              {unread} unread · {items.length} total
            </p>
          </div>
        </div>
        <div className="row gap2">
          <Btn variant={filter === "all" ? "primary" : "default"} size="sm" onClick={() => setFilter("all")}>All</Btn>
          <Btn variant={filter === "unread" ? "primary" : "default"} size="sm" onClick={() => setFilter("unread")}>Unread</Btn>
          {unread > 0 && <Btn size="sm" onClick={markAll}><Icon name="check" size={14} /> Mark all read</Btn>}
        </div>
      </header>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="t-sm muted" style={{ padding: 16 }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div className="notif-empty" style={{ padding: 40 }}>
            <Icon name="bell" size={26} />
            <span>{filter === "unread" ? "No unread notifications." : "Nothing here yet — mentions, assignments and review updates land here."}</span>
          </div>
        ) : (
          shown.map((n) => (
            <button key={n.id} className={`inbox-row ${n.read_at ? "" : "unread"}`} onClick={() => open(n)}>
              <span className="notif-ic"><Icon name={TYPE_ICON[n.type] ?? "dot"} size={15} /></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="inbox-title">{n.title}</span>
                {n.body && <span className="inbox-body">{n.body}</span>}
              </span>
              <span className="inbox-meta">
                <span className="inbox-tag">{TYPE_LABEL[n.type] ?? n.type}</span>
                <span className="notif-time">{relTime(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="notif-unread-dot" aria-hidden />}
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
