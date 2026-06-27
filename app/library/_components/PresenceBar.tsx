"use client";

import { useEffect, useState } from "react";
import { hueFor } from "../../components/studio";

interface Viewer { user_id: number; user_name: string }

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

/** "Who else is viewing this asset" — soft presence via heartbeat polling. */
export default function PresenceBar({ assetId }: { assetId: number }) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const me = readCookie("studio_operator");

  useEffect(() => {
    if (!Number.isInteger(assetId)) return;
    let alive = true;
    const beat = () => fetch("/api/library/presence", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId }),
    }).catch(() => {});
    const poll = () => fetch(`/api/library/presence?assetId=${assetId}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setViewers(Array.isArray(d.viewers) ? d.viewers : []); })
      .catch(() => {});

    beat(); poll();
    const t = setInterval(() => { beat(); poll(); }, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
      fetch("/api/library/presence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, leaving: true }), keepalive: true,
      }).catch(() => {});
    };
  }, [assetId]);

  const others = viewers.filter((v) => v.user_name !== me);
  if (others.length === 0) return null;

  return (
    <div className="presence-bar" title={`${others.map((v) => v.user_name).join(", ")} also viewing`}>
      <div className="presence-pips">
        {others.slice(0, 4).map((v) => (
          <span key={v.user_id} className="presence-pip" style={{ ["--hue" as string]: hueFor(v.user_name) }}>
            {initials(v.user_name)}
          </span>
        ))}
      </div>
      <span className="presence-label">
        {others.length === 1 ? `${others[0].user_name} is also here` : `${others.length} others viewing`}
      </span>
    </div>
  );
}
