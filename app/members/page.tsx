"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Btn, Pill, Seg, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { hueFor } from "../components/studio";

interface Member {
  id: number;
  email: string;
  name: string;
  handle: string;
  role: "creative" | "producer" | "finance" | "admin";
  avatar_url: string | null;
  active: boolean;
  last_login_at: string | null;
}

const ROLES = [
  { value: "creative", label: "Creative" },
  { value: "producer", label: "Producer" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
];

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function Avatar({ m }: { m: Member }) {
  return (
    <span
      className="member-av"
      style={{ ["--hue" as string]: hueFor(m.handle || m.email), opacity: m.active ? 1 : 0.45 }}
      title={m.name}
    >
      {m.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.avatar_url} alt={m.name} />
        : initials(m.name)}
    </span>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "creative", password: "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const isAdmin = readCookie("studio_role") === "admin";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/users");
      const d = await r.json();
      setMembers(Array.isArray(d.users) ? d.users : []);
    } catch {
      toast({ title: "Couldn't load the team directory", kind: "bad" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.active).length,
    admins: members.filter((m) => m.role === "admin").length,
  }), [members]);

  async function patch(id: number, body: Record<string, unknown>, ok: string) {
    const r = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast({ title: d.error ?? "Update failed", kind: "bad" }); return; }
    toast({ title: ok, kind: "ok" });
    load();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: d.error ?? "Couldn't add member", kind: "bad" }); return; }
      toast({ title: `Added ${d.user?.name ?? "member"} — share the temp password`, kind: "ok" });
      setForm({ name: "", email: "", role: "creative", password: "" });
      setInviteOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  function resetPassword(m: Member) {
    const pw = prompt(`New temporary password for ${m.name} (6+ chars):`);
    if (pw && pw.length >= 6) patch(m.id, { password: pw }, "Password reset");
    else if (pw !== null) toast({ title: "Password must be at least 6 characters", kind: "bad" });
  }

  return (
    <div className="page">
      <header className="page-hd">
        <div className="row gap3" style={{ alignItems: "center" }}>
          <span className="glyph"><Icon name="shield" size={20} /></span>
          <div>
            <h1 className="t-h2" style={{ margin: 0 }}>Team</h1>
            <p className="t-sm muted" style={{ margin: 0 }}>
              {counts.total} member{counts.total === 1 ? "" : "s"} · {counts.active} active · {counts.admins} admin
            </p>
          </div>
        </div>
        {isAdmin && (
          <Btn variant="primary" onClick={() => setInviteOpen((v) => !v)}>
            <Icon name="plus" size={15} /> Add member
          </Btn>
        )}
      </header>

      {!isAdmin && (
        <Card className="t-sm muted" style={{ padding: "12px 14px" }}>
          You can view the directory. Only admins can add members or change roles.
        </Card>
      )}

      {isAdmin && inviteOpen && (
        <Card style={{ padding: 16 }}>
          <form onSubmit={invite} className="col gap3">
            <div className="row gap3 wrap">
              <input className="input" placeholder="Full name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className="input" type="email" placeholder="Work email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="row gap3 wrap" style={{ alignItems: "center" }}>
              <Seg options={ROLES} value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
              <input className="input" type="text" placeholder="Temp password (6+)" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              <Btn variant="primary" type="submit" disabled={busy}>
                {busy ? "Adding…" : "Create account"}
              </Btn>
            </div>
            <p className="t-xs muted" style={{ margin: 0 }}>
              They sign in with this email + temp password, then you (or they) can reset it.
            </p>
          </form>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="t-sm muted" style={{ padding: 16 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div className="t-sm muted" style={{ padding: 16 }}>No members yet.</div>
        ) : (
          <table className="member-table">
            <thead>
              <tr><th>Member</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.55 }}>
                  <td>
                    <div className="row gap2" style={{ alignItems: "center" }}>
                      <Avatar m={m} />
                      <div className="col">
                        <span className="t-sm" style={{ fontWeight: 600 }}>{m.name}</span>
                        <span className="t-xs muted">@{m.handle}</span>
                      </div>
                    </div>
                  </td>
                  <td className="t-sm muted">{m.email}</td>
                  <td>
                    {isAdmin ? (
                      <Seg options={ROLES} value={m.role}
                        onChange={(v) => patch(m.id, { role: v }, `${m.name} is now ${v}`)} />
                    ) : (
                      <span className="member-role">{m.role}</span>
                    )}
                  </td>
                  <td>
                    <Pill state={m.active ? "approved" : "canceled"} label={m.active ? "Active" : "Inactive"} />
                  </td>
                  <td>
                    {isAdmin && (
                      <div className="row gap2">
                        <Btn size="sm" onClick={() => resetPassword(m)} title="Reset password">
                          <Icon name="lock" size={13} />
                        </Btn>
                        <Btn size="sm"
                          onClick={() => patch(m.id, { active: !m.active }, m.active ? "Deactivated" : "Reactivated")}
                          title={m.active ? "Deactivate" : "Reactivate"}>
                          <Icon name={m.active ? "eyeoff" : "eye"} size={13} />
                        </Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
