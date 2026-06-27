"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { relTime } from "./studio";
import { chime, osNotify } from "./notify";

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

export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const maxSeenRef = useRef(0);
  const readyRef = useRef(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d = await r.json();
      const list: Notif[] = Array.isArray(d.items) ? d.items : [];
      setItems(list);
      setCount(Number(d.count) || 0);
      // Ping on genuinely new notifications (not on first load).
      const maxId = list.reduce((m, n) => Math.max(m, n.id), 0);
      if (readyRef.current && maxId > maxSeenRef.current) {
        const fresh = list.find((n) => n.id === maxId);
        if (fresh && !fresh.read_at) { chime("done"); osNotify(fresh.title, fresh.body ?? ""); }
      }
      maxSeenRef.current = Math.max(maxSeenRef.current, maxId);
      readyRef.current = true;
    } catch {
      /* offline / shared-mode — bell stays quiet */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function markAllRead() {
    setCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); } catch { /* best effort */ }
  }

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.read_at) {
      try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }); } catch { /* best effort */ }
    }
    if (n.asset_id) router.push(`/library/${n.asset_id}`);
  }

  return (
    <div className="notif-wrap">
      <button
        className="theme-toggle notif-bell"
        title="Notifications"
        aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
      >
        <Icon name="bell" size={16} />
        {count > 0 && <span className="notif-dot">{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <>
          <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-hd">
              <span className="t-label">Notifications</span>
              {count > 0 && (
                <button className="notif-mark" onClick={markAllRead}>Mark all read</button>
              )}
            </div>
            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">
                  <Icon name="bell" size={20} />
                  <span>You&apos;re all caught up.</span>
                </div>
              ) : (
                items.map((n) => (
                  <button key={n.id} className={`notif-item ${n.read_at ? "" : "unread"}`} onClick={() => openItem(n)}>
                    <span className="notif-ic"><Icon name={TYPE_ICON[n.type] ?? "dot"} size={14} /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="notif-title">{n.title}</span>
                      {n.body && <span className="notif-body">{n.body}</span>}
                      <span className="notif-time">{relTime(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="notif-unread-dot" aria-hidden />}
                  </button>
                ))
              )}
            </div>
            <button className="notif-foot" onClick={() => { setOpen(false); router.push("/inbox"); }}>
              See all in inbox <Icon name="arrowRight" size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
