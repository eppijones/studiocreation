"use client";

/* Asset detail — now a full REVIEW TOOL.
   Left column: the media Stage (proxy player + sprite scrub, image/audio/doc/
   project renderers) plus a player toolbar (timecode readout, transport,
   speed) and keyboard shortcuts (space / J-K-L / arrows / I-O).
   Right column: the review sidebar — state pills, star rating, manual tags,
   custom fields, timecode-anchored comments (the centerpiece), markers,
   subclips, activity history — plus the technical / proxies / transcript
   panels. Serves PROXIES ONLY. */

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../components/Icon";
import PresenceBar from "../_components/PresenceBar";
import styles from "./detail.module.css";

/* ── data shapes (mirror studiolibrary/lib server types) ──────────────── */
interface Proxy {
  kind: string; status: string; path: string | null; codec: string | null;
  bitrate: string | null; source: string; meta: Record<string, unknown>;
}
interface Annotation {
  id: number; asset_id: number; kind: "comment" | "marker"; author: string | null;
  body: string | null; tc_in: number | null; tc_out: number | null; color: string | null;
  resolved: boolean; assigned_to: string | null; parent_id: number | null; created_at: string;
}
interface AssetEvent {
  id: number; asset_id: number; actor: string | null; type: string;
  payload: Record<string, unknown>; created_at: string;
}
interface Subclip {
  id: number; asset_id: number; name: string | null; tc_in: number; tc_out: number;
  created_by: string | null; created_at: string;
}
interface Detail {
  asset: {
    id: number; kind: string; filename: string; rel_path: string; abs_path: string;
    codec: string | null; audio_codec: string | null; container: string | null;
    width: number | null; height: number | null; duration_s: number | null; fps: number | null;
    size_bytes: string | null; mtime: string | null; status: string; signature: string | null;
    review_state?: string | null; rating?: number | null; custom?: Record<string, unknown> | null;
  };
  proxies: Proxy[];
  transcript: {
    language: string | null;
    full_text: string | null;
    segments: { start: number; end: number; text: string }[];
  } | null;
  tags: { label: string; source: string; confidence: number | null }[];
  annotations: Annotation[];
  events: AssetEvent[];
  subclips: Subclip[];
  error?: string;
}

interface Cue { start: number; end: number; text: string }

interface ReviewState { key: string; label: string; color: string | null; ord: number; kind: string }
interface CustomField { key: string; label: string; type: string; options: string[]; ord: number; help: string | null }
interface Status { reviewStates: ReviewState[]; customFields: CustomField[] }

interface SpriteMeta { cols: number; rows: number; count: number; tileW: number; tileH: number; intervalS: number; }

function media(id: number, kind: string) { return `/api/library/media/${id}/${kind}`; }
function fmtSize(b: string | null): string {
  if (!b) return "—";
  const n = Number(b);
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
function fmtDur(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
/* mm:ss.s — used on comment/marker/subclip timecode chips */
function fmtTc(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}
/* mm:ss:ff — the broadcast readout near the player */
function fmtSmpte(s: number, fps: number): string {
  const f = Math.max(1, Math.round(fps || 25));
  const total = Math.floor(s);
  const m = Math.floor(total / 60), sec = total % 60;
  const frame = Math.floor((s - total) * f);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(frame).padStart(2, "0")}`;
}
/* relative "time ago" for comments + activity */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const assetId = Number(id);
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [notFound, setNotFound] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  /* in/out points for subclip authoring (player current-time captures) */
  const [inPt, setInPt] = useState<number | null>(null);
  const [outPt, setOutPt] = useState<number | null>(null);

  const reload = useCallback(() => {
    return fetch(`/api/library/assets/${id}`)
      .then((r) => (r.ok ? (r.json() as Promise<Detail>) : Promise.reject()))
      .then(setD)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    fetch(`/api/library/status`)
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : Promise.reject()))
      .then((s) => setStatus({ reviewStates: s.reviewStates ?? [], customFields: s.customFields ?? [] }))
      .catch(() => setStatus({ reviewStates: [], customFields: [] }));
  }, []);

  if (notFound) return <div className={styles.wrap}><p style={{ color: "var(--tx-3)" }}>Asset not found.</p></div>;
  if (!d) return <div className={styles.wrap}><p style={{ color: "var(--tx-3)" }}>Loading…</p></div>;

  const a = d.asset;
  const proxyKinds = new Set(d.proxies.filter((p) => p.status === "ready").map((p) => p.kind));
  const isTimeline = a.kind === "video" || a.kind === "audio";
  const fps = a.fps ?? 25;

  return (
    <div className={styles.wrap}>
      <button className={styles.back} onClick={() => router.push("/library")}>
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} /> Media Library
      </button>

      <div className={styles.titleRow}>
        <div>
          <div className={styles.title}>{a.filename}</div>
          <div className={styles.path}>{a.rel_path}</div>
        </div>
        <PresenceBar assetId={assetId} />
      </div>

      <div className={styles.layout}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Stage asset={a} proxyKinds={proxyKinds} sprite={d.proxies.find((p) => p.kind === "sprite")} videoRef={videoRef} />
          {a.kind === "video" && proxyKinds.has("video_proxy") && (
            <PlayerBar videoRef={videoRef} fps={fps} setInPt={setInPt} setOutPt={setOutPt} inPt={inPt} outPt={outPt} />
          )}
          <ShareCard assetId={assetId} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* ── REVIEW SIDEBAR ───────────────────────────────────── */}
          <ReviewControls assetId={assetId} asset={a} states={status?.reviewStates ?? []} onChange={reload} />

          <Comments
            assetId={assetId} annotations={d.annotations} videoRef={videoRef}
            isTimeline={isTimeline} fps={fps} onChange={reload}
          />

          <Markers assetId={assetId} annotations={d.annotations} videoRef={videoRef} onChange={reload} />

          {isTimeline && (
            <Subclips
              assetId={assetId} subclips={d.subclips} videoRef={videoRef}
              inPt={inPt} outPt={outPt} setInPt={setInPt} setOutPt={setOutPt} onChange={reload}
            />
          )}

          <ManualTags assetId={assetId} tags={d.tags} onChange={reload} />

          {!!(status?.customFields.length) && (
            <CustomFields assetId={assetId} fields={status.customFields} custom={a.custom ?? {}} onChange={reload} />
          )}

          <Activity events={d.events} />

          {/* ── existing reference panels (kept intact) ───────────── */}
          <div className={styles.panel}>
            <div className={styles.panelHd}>Technical</div>
            <Row k="Kind" v={a.kind} />
            {a.width && a.height && <Row k="Resolution" v={`${a.width} × ${a.height}`} />}
            {a.codec && <Row k="Video codec" v={a.codec} />}
            {a.audio_codec && <Row k="Audio codec" v={a.audio_codec} />}
            {a.fps != null && <Row k="Frame rate" v={`${a.fps} fps`} />}
            {a.duration_s != null && <Row k="Duration" v={fmtDur(a.duration_s)} />}
            {a.container && <Row k="Container" v={a.container} />}
            <Row k="Size" v={fmtSize(a.size_bytes)} />
            {a.mtime && <Row k="Modified" v={new Date(a.mtime).toLocaleString()} />}
            <Row k="Status" v={a.status} />
            {a.signature && <Row k="Signature" v={a.signature.slice(0, 12) + "…"} />}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHd}>Proxies</div>
            <div className={styles.chips}>
              {d.proxies.length === 0 && <span style={{ color: "var(--tx-4)", fontSize: 13 }}>none yet</span>}
              {d.proxies.map((p) => (
                <span key={p.kind} className={`${styles.proxyTag} ${p.status === "ready" ? styles.proxyOk : p.status === "error" ? styles.proxyErr : ""}`}>
                  <Icon name={p.status === "ready" ? "play" : "clock"} size={11} />
                  {p.kind.replace("_", " ")}
                  {p.source === "reused_external" ? " ·reused" : ""}
                </span>
              ))}
            </div>
          </div>

          {(d.transcript || isTimeline) && (
            <Subtitles
              assetId={assetId}
              language={d.transcript?.language ?? null}
              segments={d.transcript?.segments ?? []}
              videoRef={videoRef}
              onChange={reload}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className={styles.row}><span className="k">{k}</span><span className="v">{v}</span></div>;
}

/* ── review state pills + star rating ─────────────────────────────── */
function ReviewControls({
  assetId, asset, states, onChange,
}: {
  assetId: number; asset: Detail["asset"]; states: ReviewState[]; onChange: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const post = async (body: Record<string, unknown>) => {
    setErr(null);
    const r = await fetch("/api/library/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, ...body }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? "Action failed");
      return;
    }
    onChange();
  };
  const rating = asset.rating ?? 0;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Review</div>
      <div className={styles.reviewBody}>
        {err && (
          <div className={styles.gateErr}>
            <Icon name="alert" size={13} /> {err}
          </div>
        )}
        <div className={styles.statePills}>
          {states.map((s) => {
            const on = asset.review_state === s.key;
            const tint = s.color ?? "var(--accent)";
            return (
              <button
                key={s.key}
                className={`${styles.pill} ${on ? styles.pillOn : ""}`}
                style={on ? { background: tint, borderColor: tint, color: "#0c0c0f" } : { borderColor: tint, color: tint }}
                onClick={() => post({ action: "state", state: s.key })}
              >
                {s.label}
              </button>
            );
          })}
          {states.length === 0 && <span style={{ color: "var(--tx-4)", fontSize: 13 }}>no states configured</span>}
        </div>

        <div className={styles.stars} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`${styles.star} ${n <= rating ? styles.starOn : ""}`}
              title={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => post({ action: "rating", rating: n === rating ? null : n })}
            >
              <Icon name="spark" size={18} />
            </button>
          ))}
          {rating > 0 && <span className={styles.starClear}>{rating}/5</span>}
        </div>

        <AssignControl assetId={assetId} onChange={onChange} />
      </div>
    </div>
  );
}

/* ── assign this asset to a teammate (creates an assignment task) ───── */
interface Member { id: number; name: string; handle: string; role: string }
function AssignControl({ assetId, onChange }: { assetId: number; onChange: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users").then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setMembers(Array.isArray(d.users) ? d.users : [])).catch(() => {});
  }, []);

  async function assign() {
    const m = members.find((x) => String(x.id) === pick);
    if (!m) return;
    setBusy(true);
    try {
      await fetch("/api/library/annotations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, kind: "comment", body: `Review requested → @${m.handle}`, assignedTo: m.name, assignedToId: m.id }),
      });
      setDone(m.name); setPick("");
      onChange();
    } finally { setBusy(false); }
  }

  if (members.length === 0) return null;
  return (
    <div className={styles.assignRow}>
      <Icon name="wand" size={13} />
      <select className={styles.assignSelect} value={pick} onChange={(e) => { setPick(e.target.value); setDone(null); }}>
        <option value="">Assign to…</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button className={styles.assignBtn} disabled={!pick || busy} onClick={assign}>
        {busy ? "…" : "Assign"}
      </button>
      {done && <span className={styles.assignDone}>Assigned to {done}</span>}
    </div>
  );
}

/* ── timecode-anchored comments (centerpiece) ─────────────────────── */
function Comments({
  assetId, annotations, videoRef, isTimeline, fps, onChange,
}: {
  assetId: number; annotations: Annotation[]; videoRef: React.RefObject<HTMLVideoElement | null>;
  isTimeline: boolean; fps: number; onChange: () => void;
}) {
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(false);
  const [tcIn, setTcIn] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const comments = annotations.filter((x) => x.kind === "comment" && x.parent_id == null);
  const repliesOf = (pid: number) => annotations.filter((x) => x.kind === "comment" && x.parent_id === pid);

  const seek = (t: number | null) => {
    const v = videoRef.current; if (!v || t == null) return;
    v.currentTime = t; v.play().catch(() => {});
  };
  const capture = () => videoRef.current?.currentTime ?? 0;

  const togglePin = () => {
    if (!pin) setTcIn(isTimeline ? capture() : null);
    else setTcIn(null);
    setPin(!pin);
  };

  const submit = async () => {
    const text = body.trim(); if (!text) return;
    await fetch("/api/library/annotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, kind: "comment", body: text, tcIn: pin ? tcIn : null }),
    });
    setBody(""); setPin(false); setTcIn(null); onChange();
  };
  const reply = async (pid: number) => {
    const text = replyBody.trim(); if (!text) return;
    await fetch("/api/library/annotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, kind: "comment", body: text, parentId: pid }),
    });
    setReplyBody(""); setReplyTo(null); onChange();
  };
  const resolve = async (c: Annotation) => {
    await fetch("/api/library/annotations", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, resolved: !c.resolved }),
    });
    onChange();
  };
  const del = async (cid: number) => {
    await fetch(`/api/library/annotations?id=${cid}`, { method: "DELETE" });
    onChange();
  };

  const TcChip = ({ t }: { t: number }) => (
    <button className={styles.tcChip} onClick={() => seek(t)} title="Seek to timecode">
      <Icon name="clock" size={11} /> {fmtTc(t)}
    </button>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Comments · {comments.length}</div>

      {/* composer */}
      <div className={styles.composer}>
        <textarea
          className={styles.ta}
          placeholder="Leave a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className={styles.composerRow}>
          {isTimeline && (
            <button className={`${styles.miniBtn} ${pin ? styles.miniBtnOn : ""}`} onClick={togglePin}>
              📌 pin to current time{pin && tcIn != null ? ` · ${fmtSmpte(tcIn, fps)}` : ""}
            </button>
          )}
          <button className={styles.primaryBtn} onClick={submit} disabled={!body.trim()}>
            <Icon name="plus" size={13} /> Comment
          </button>
        </div>
      </div>

      {/* thread */}
      <div className={styles.commentList}>
        {comments.length === 0 && <div className={styles.empty}>No comments yet.</div>}
        {comments.map((c) => (
          <div key={c.id} className={`${styles.comment} ${c.resolved ? styles.resolved : ""}`}>
            <div className={styles.commentHd}>
              <span className={styles.author}>{c.author ?? "anon"}</span>
              <span className={styles.metaTime}>{ago(c.created_at)}</span>
              {c.tc_in != null && <TcChip t={c.tc_in} />}
            </div>
            <div className={styles.commentBody}>{c.body}</div>
            <div className={styles.commentActions}>
              <button className={styles.linkBtn} onClick={() => resolve(c)}>
                <Icon name="check" size={12} /> {c.resolved ? "Reopen" : "Resolve"}
              </button>
              <button className={styles.linkBtn} onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                <Icon name="arrowRight" size={12} /> Reply
              </button>
              <button className={`${styles.linkBtn} ${styles.danger}`} onClick={() => del(c.id)}>
                <Icon name="x" size={12} /> Delete
              </button>
            </div>

            {repliesOf(c.id).map((r) => (
              <div key={r.id} className={`${styles.reply} ${r.resolved ? styles.resolved : ""}`}>
                <div className={styles.commentHd}>
                  <span className={styles.author}>{r.author ?? "anon"}</span>
                  <span className={styles.metaTime}>{ago(r.created_at)}</span>
                </div>
                <div className={styles.commentBody}>{r.body}</div>
                <div className={styles.commentActions}>
                  <button className={`${styles.linkBtn} ${styles.danger}`} onClick={() => del(r.id)}>
                    <Icon name="x" size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}

            {replyTo === c.id && (
              <div className={styles.replyComposer}>
                <textarea
                  className={styles.ta}
                  placeholder="Reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <button className={styles.primaryBtn} onClick={() => reply(c.id)} disabled={!replyBody.trim()}>
                  Send
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── markers ──────────────────────────────────────────────────────── */
function Markers({
  assetId, annotations, videoRef, onChange,
}: {
  assetId: number; annotations: Annotation[]; videoRef: React.RefObject<HTMLVideoElement | null>; onChange: () => void;
}) {
  const markers = annotations.filter((x) => x.kind === "marker");
  const seek = (t: number | null) => { const v = videoRef.current; if (v && t != null) { v.currentTime = t; } };
  const add = async () => {
    const label = window.prompt("Marker label", "Marker");
    if (label == null) return;
    await fetch("/api/library/annotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, kind: "marker", body: label || "Marker", tcIn: videoRef.current?.currentTime ?? 0 }),
    });
    onChange();
  };
  const del = async (id: number) => {
    await fetch(`/api/library/annotations?id=${id}`, { method: "DELETE" });
    onChange();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Markers · {markers.length}</div>
      <div className={styles.markerBody}>
        <button className={styles.miniBtn} onClick={add}>
          <Icon name="plus" size={12} /> Add marker at current time
        </button>
        <div className={styles.markerList}>
          {markers.length === 0 && <div className={styles.empty}>No markers.</div>}
          {markers.map((m) => (
            <div key={m.id} className={styles.markerRow}>
              {m.tc_in != null && (
                <button className={styles.tcChip} onClick={() => seek(m.tc_in)} title="Seek to marker">
                  <Icon name="clock" size={11} /> {fmtTc(m.tc_in)}
                </button>
              )}
              <span className={styles.markerLabel}>{m.body ?? "Marker"}</span>
              <button className={`${styles.linkBtn} ${styles.danger}`} onClick={() => del(m.id)}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── subclips (video / audio) ─────────────────────────────────────── */
function Subclips({
  assetId, subclips, videoRef, inPt, outPt, setInPt, setOutPt, onChange,
}: {
  assetId: number; subclips: Subclip[]; videoRef: React.RefObject<HTMLVideoElement | null>;
  inPt: number | null; outPt: number | null;
  setInPt: (n: number | null) => void; setOutPt: (n: number | null) => void; onChange: () => void;
}) {
  const seek = (t: number) => { const v = videoRef.current; if (v) v.currentTime = t; };
  const now = () => videoRef.current?.currentTime ?? 0;

  const save = async () => {
    if (inPt == null || outPt == null) { window.alert("Set IN and OUT first."); return; }
    if (outPt <= inPt) { window.alert("OUT must be after IN."); return; }
    const name = window.prompt("Subclip name", "Selection");
    if (name == null) return;
    await fetch("/api/library/subclips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, name: name || null, tcIn: inPt, tcOut: outPt }),
    });
    setInPt(null); setOutPt(null); onChange();
  };
  const del = async (id: number) => {
    await fetch(`/api/library/subclips?id=${id}`, { method: "DELETE" });
    onChange();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Subclips · {subclips.length}</div>
      <div className={styles.subclipBody}>
        <div className={styles.ioRow}>
          <button className={styles.miniBtn} onClick={() => setInPt(now())}>Set IN</button>
          <span className={styles.ioVal}>{inPt != null ? fmtTc(inPt) : "—"}</span>
          <span className={styles.ioArrow}>→</span>
          <button className={styles.miniBtn} onClick={() => setOutPt(now())}>Set OUT</button>
          <span className={styles.ioVal}>{outPt != null ? fmtTc(outPt) : "—"}</span>
          <button className={styles.primaryBtn} onClick={save} disabled={inPt == null || outPt == null}>
            <Icon name="plus" size={12} /> Save
          </button>
        </div>
        <div className={styles.markerList}>
          {subclips.length === 0 && <div className={styles.empty}>No subclips.</div>}
          {subclips.map((s) => (
            <div key={s.id} className={styles.markerRow}>
              <button className={styles.tcChip} onClick={() => seek(s.tc_in)} title="Seek to in-point">
                <Icon name="clock" size={11} /> {fmtTc(s.tc_in)} → {fmtTc(s.tc_out)}
              </button>
              <span className={styles.markerLabel}>{s.name ?? "Selection"}</span>
              <button className={`${styles.linkBtn} ${styles.danger}`} onClick={() => del(s.id)}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── manual tags + autocomplete ───────────────────────────────────── */
function ManualTags({
  assetId, tags, onChange,
}: {
  assetId: number; tags: Detail["tags"]; onChange: () => void;
}) {
  const manual = tags.filter((t) => t.source === "manual");
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState<string[]>([]);

  useEffect(() => {
    if (!q.trim()) { setSugg([]); return; }
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/library/review?tagq=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ suggestions: string[] }>) : Promise.reject()))
        .then((r) => { if (live) setSugg(r.suggestions ?? []); })
        .catch(() => { if (live) setSugg([]); });
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const add = async (label: string) => {
    const clean = label.trim(); if (!clean) return;
    await fetch("/api/library/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, action: "tag", label: clean }),
    });
    setQ(""); setSugg([]); onChange();
  };
  const remove = async (label: string) => {
    await fetch("/api/library/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, action: "untag", label }),
    });
    onChange();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Tags</div>
      <div className={styles.tagBody}>
        <div className={styles.chipsInline}>
          {manual.length === 0 && <span className={styles.empty}>No tags.</span>}
          {manual.map((t, i) => (
            <span key={i} className={styles.removableChip}>
              {t.label}
              <button className={styles.chipX} onClick={() => remove(t.label)} aria-label={`Remove ${t.label}`}>
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className={styles.tagInputWrap}>
          <input
            className={styles.input}
            placeholder="Add a tag…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q); } }}
          />
          {sugg.length > 0 && (
            <div className={styles.autocomplete}>
              {sugg.map((s) => (
                <button key={s} className={styles.autoItem} onClick={() => add(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── custom fields ────────────────────────────────────────────────── */
function CustomFields({
  assetId, fields, custom, onChange,
}: {
  assetId: number; fields: CustomField[]; custom: Record<string, unknown>; onChange: () => void;
}) {
  const save = async (key: string, value: unknown) => {
    await fetch("/api/library/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, action: "customField", key, value }),
    });
    onChange();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Custom Fields</div>
      <div className={styles.cfBody}>
        {fields.map((f) => (
          <CustomFieldEditor key={f.key} field={f} value={custom[f.key]} onSave={(v) => save(f.key, v)} />
        ))}
      </div>
    </div>
  );
}

function CustomFieldEditor({
  field, value, onSave,
}: {
  field: CustomField; value: unknown; onSave: (v: unknown) => void;
}) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  useEffect(() => { setLocal(value == null ? "" : String(value)); }, [value]);

  const label = (
    <label className={styles.cfLabel}>
      {field.label}
      {field.help && <span className={styles.cfHelp}>{field.help}</span>}
    </label>
  );

  if (field.type === "checkbox") {
    const on = value === true || value === "true";
    return (
      <div className={styles.cfRow}>
        {label}
        <button
          className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
          role="switch" aria-checked={on}
          onClick={() => onSave(!on)}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={styles.cfRow}>
        {label}
        <select
          className={styles.input}
          value={local}
          onChange={(e) => { setLocal(e.target.value); onSave(e.target.value || null); }}
        >
          <option value="">—</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className={styles.cfRow}>
        {label}
        <textarea
          className={styles.ta}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local || null)}
        />
      </div>
    );
  }

  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return (
    <div className={styles.cfRow}>
      {label}
      <input
        className={styles.input}
        type={inputType}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onSave(field.type === "number" ? (local === "" ? null : Number(local)) : (local || null))}
      />
    </div>
  );
}

/* ── activity history ─────────────────────────────────────────────── */
function eventGlyph(type: string): string {
  switch (type) {
    case "comment": return "captions";
    case "rating": return "spark";
    case "state_change": return "check";
    case "tag": return "tools";
    case "custom_field": return "settings";
    case "file_op": return "tools";
    case "subclip": return "film";
    case "notify": return "bell";
    case "proxy": return "play";
    case "transcribe": return "captions";
    case "marker": return "clock";
    default: return "dot";
  }
}
function eventSummary(e: AssetEvent): string {
  const p = e.payload ?? {};
  switch (e.type) {
    case "state_change": return `State → ${p.to ?? "?"}`;
    case "rating": return p.rating == null ? "Cleared rating" : `Rated ${p.rating}/5`;
    case "tag": return p.add ? `Tagged “${p.add}”` : p.remove ? `Removed tag “${p.remove}”` : "Tag change";
    case "custom_field": return `Set ${p.key} = ${JSON.stringify(p.value)}`;
    case "comment": return p.tc_in != null ? `Comment @ ${fmtTc(Number(p.tc_in))}` : "Comment";
    case "marker": return `Marker @ ${p.tc_in != null ? fmtTc(Number(p.tc_in)) : "—"}`;
    case "subclip": return `Subclip “${p.name ?? "Selection"}”`;
    case "file_op": return `File op${p.op ? ` · ${p.op}` : ""}`;
    case "notify": return "Notification sent";
    case "proxy": return "Proxy built";
    case "transcribe": return "Transcribed";
    default: return e.type.replace(/_/g, " ");
  }
}
function Activity({ events }: { events: AssetEvent[] }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHd}>Activity</div>
      <div className={styles.activity}>
        {events.length === 0 && <div className={styles.empty}>No activity yet.</div>}
        {events.map((e) => (
          <div key={e.id} className={styles.actRow}>
            <span className={styles.actIcon}><Icon name={eventGlyph(e.type)} size={13} /></span>
            <div className={styles.actText}>
              <span className={styles.actSummary}>{eventSummary(e)}</span>
              <span className={styles.metaTime}>{e.actor ?? "system"} · {ago(e.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── subtitles: editable cue editor (Whisper transcript → SRT/VTT) ──── */
function Subtitles({
  assetId, language, segments, videoRef, onChange,
}: {
  assetId: number; language: string | null; segments: Cue[];
  videoRef: React.RefObject<HTMLVideoElement | null>; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Cue[]>(segments);
  const [saving, setSaving] = useState(false);

  /* re-seed the editable draft whenever the source cues change (e.g. reload) */
  useEffect(() => { setDraft(segments); }, [segments]);

  const seek = (t: number) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = t; v.play().catch(() => {});
  };
  const now = () => videoRef.current?.currentTime ?? 0;

  const startEdit = () => { setDraft(segments); setEditing(true); };
  const cancelEdit = () => { setDraft(segments); setEditing(false); };

  const patch = (i: number, key: keyof Cue, value: string) => {
    setDraft((rows) => rows.map((c, idx) =>
      idx === i
        ? { ...c, [key]: key === "text" ? value : (value === "" ? 0 : Number(value)) }
        : c,
    ));
  };
  const removeCue = (i: number) => setDraft((rows) => rows.filter((_, idx) => idx !== i));
  const addCue = () => {
    const start = now();
    setDraft((rows) => [...rows, { start, end: start + 2, text: "" }]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const clean = draft
        .map((c) => ({ start: Number(c.start) || 0, end: Number(c.end) || 0, text: c.text.trim() }))
        .filter((c) => c.text.length > 0)
        .sort((a, b) => a.start - b.start);
      const r = await fetch("/api/library/subtitles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, language, segments: clean }),
      });
      if (r.ok) { setEditing(false); onChange(); }
    } finally {
      setSaving(false);
    }
  };

  const cueCount = editing ? draft.length : segments.length;
  const dl = (format: "srt" | "vtt") => `/api/library/subtitles?assetId=${assetId}&format=${format}`;

  return (
    <div className={styles.panel}>
      <div className={styles.subHd}>
        <span className={styles.subHdTitle}>
          Subtitles{language ? ` · ${language}` : ""} · {cueCount}
        </span>
        <div className={styles.subHdActions}>
          {!editing && segments.length > 0 && (
            <>
              <a className={styles.miniBtn} href={dl("srt")} download>
                <Icon name="download" size={12} /> SRT
              </a>
              <a className={styles.miniBtn} href={dl("vtt")} download>
                <Icon name="download" size={12} /> VTT
              </a>
            </>
          )}
          <button className={styles.miniBtn} onClick={() => (editing ? cancelEdit() : startEdit())}>
            <Icon name={editing ? "x" : "settings"} size={12} /> {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {!editing ? (
        <div className={styles.cueList}>
          {segments.length === 0 && <div className={styles.empty}>No subtitle cues.</div>}
          {segments.map((c, i) => (
            <div key={i} className={styles.cueRow}>
              <button className={styles.tcChip} onClick={() => seek(c.start)} title="Seek to cue">
                <Icon name="clock" size={11} /> {fmtTc(c.start)}
              </button>
              <span className={styles.cueText}>{c.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.cueEdit}>
          {draft.map((c, i) => (
            <div key={i} className={styles.cueEditRow}>
              <textarea
                className={styles.cueTa}
                placeholder="Cue text…"
                value={c.text}
                onChange={(e) => patch(i, "text", e.target.value)}
              />
              <div className={styles.cueTimes}>
                <input
                  className={styles.cueNum}
                  type="number" step={0.1} min={0}
                  value={c.start}
                  onChange={(e) => patch(i, "start", e.target.value)}
                  aria-label="Start (s)"
                />
                <span className={styles.ioArrow}>→</span>
                <input
                  className={styles.cueNum}
                  type="number" step={0.1} min={0}
                  value={c.end}
                  onChange={(e) => patch(i, "end", e.target.value)}
                  aria-label="End (s)"
                />
                <button
                  className={`${styles.linkBtn} ${styles.danger}`}
                  onClick={() => removeCue(i)}
                  aria-label="Delete cue"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            </div>
          ))}
          <div className={styles.cueEditActions}>
            <button className={styles.miniBtn} onClick={addCue}>
              <Icon name="plus" size={12} /> Add cue
            </button>
            <button className={styles.primaryBtn} onClick={save} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── share for review ─────────────────────────────────────────────── */
function ShareCard({ assetId }: { assetId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/library/share", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "asset", targetId: assetId,
          allowComments: true, allowDownload: false, expiresInDays: 30,
        }),
      });
      const j = (await r.json()) as { link?: { token: string } };
      if (j.link?.token) setUrl(`${window.location.origin}/library/share/${j.link.token}`);
    } finally {
      setBusy(false);
    }
  };
  const copy = () => {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  return (
    <div className={styles.shareCard}>
      {!url ? (
        <button className={styles.shareBtn} onClick={share} disabled={busy}>
          <Icon name="arrowRight" size={14} /> {busy ? "Creating…" : "Share for review"}
        </button>
      ) : (
        <div className={styles.shareResult}>
          <code className={styles.shareUrl}>{url}</code>
          <button className={styles.miniBtn} onClick={copy}>
            <Icon name="copy" size={12} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── player toolbar + keyboard shortcuts (video) ──────────────────── */
function PlayerBar({
  videoRef, fps, inPt, outPt, setInPt, setOutPt,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>; fps: number;
  inPt: number | null; outPt: number | null;
  setInPt: (n: number | null) => void; setOutPt: (n: number | null) => void;
}) {
  const [tc, setTc] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [copied, setCopied] = useState(false);

  /* keep the readout ticking with playback */
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const tick = () => setTc(v.currentTime);
    v.addEventListener("timeupdate", tick);
    return () => v.removeEventListener("timeupdate", tick);
  }, [videoRef]);

  /* keyboard transport — disabled while typing in a field */
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      const tag = t?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable === true;
    };
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current; if (!v || isTyping(e.target)) return;
      const step = 1 / Math.max(1, fps);
      switch (e.key) {
        case " ": e.preventDefault(); if (v.paused) { v.play().catch(() => {}); } else { v.pause(); } break;
        case "ArrowLeft": e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - step); break;
        case "ArrowRight": e.preventDefault(); v.currentTime = v.currentTime + step; break;
        case "j": case "J": v.currentTime = Math.max(0, v.currentTime - 1); break;
        case "k": case "K": v.pause(); break;
        case "l": case "L": v.play().catch(() => {}); break;
        case "i": case "I": setInPt(v.currentTime); break;
        case "o": case "O": setOutPt(v.currentTime); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoRef, fps, setInPt, setOutPt]);

  const setRate = (r: number) => { setSpeed(r); if (videoRef.current) videoRef.current.playbackRate = r; };
  const copyTc = () => {
    navigator.clipboard?.writeText(fmtSmpte(tc, fps)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  return (
    <div className={styles.playerBar}>
      <button className={styles.tcReadout} onClick={copyTc} title="Click to copy timecode">
        {fmtSmpte(tc, fps)}{copied ? " ✓" : ""}
      </button>
      <div className={styles.transport}>
        <button className={styles.miniBtn} onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 1); }} title="Back (J)">J</button>
        <button className={styles.miniBtn} onClick={() => videoRef.current?.pause()} title="Pause (K)">K</button>
        <button className={styles.miniBtn} onClick={() => videoRef.current?.play().catch(() => {})} title="Forward (L)">L</button>
        <button className={styles.miniBtn} onClick={() => setInPt(videoRef.current?.currentTime ?? 0)} title="Set IN (I)">
          IN{inPt != null ? ` ${fmtTc(inPt)}` : ""}
        </button>
        <button className={styles.miniBtn} onClick={() => setOutPt(videoRef.current?.currentTime ?? 0)} title="Set OUT (O)">
          OUT{outPt != null ? ` ${fmtTc(outPt)}` : ""}
        </button>
      </div>
      <div className={styles.speedGroup}>
        {[0.5, 1, 1.5, 2].map((r) => (
          <button key={r} className={`${styles.speedBtn} ${speed === r ? styles.speedOn : ""}`} onClick={() => setRate(r)}>
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── the media stage, per kind (unchanged) ────────────────────────── */
function Stage({
  asset, proxyKinds, sprite, videoRef,
}: {
  asset: Detail["asset"]; proxyKinds: Set<string>; sprite?: Proxy;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const id = asset.id;

  if (asset.kind === "video" && proxyKinds.has("video_proxy")) {
    return (
      <div className={styles.stage}>
        <video
          ref={videoRef}
          src={media(id, "video_proxy")}
          poster={proxyKinds.has("poster") ? media(id, "poster") : undefined}
          controls
          preload="metadata"
        />
        {sprite?.status === "ready" && (
          <SpriteScrub id={id} meta={sprite.meta as unknown as SpriteMeta} videoRef={videoRef} duration={asset.duration_s ?? 0} />
        )}
      </div>
    );
  }
  if (asset.kind === "image" && proxyKinds.has("thumb")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div className={styles.stage}><img src={media(id, "thumb")} alt={asset.filename} /></div>;
  }
  if (asset.kind === "doc" && proxyKinds.has("page_preview")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div className={styles.stage}><img src={media(id, "page_preview")} alt={asset.filename} /></div>;
  }
  if (asset.kind === "audio") {
    return (
      <div className={`${styles.stage} ${styles.audioStage}`}>
        {proxyKinds.has("waveform") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media(id, "waveform")} alt="waveform" />
        ) : <Icon name="audio" size={48} />}
        <span style={{ color: "var(--tx-3)", fontSize: 13 }}>
          Audio · {asset.audio_codec ?? asset.codec ?? "pcm"} · {fmtDur(asset.duration_s)}
        </span>
      </div>
    );
  }
  // project files (+ any un-proxied asset): metadata + icon only
  return (
    <div className={`${styles.stage} ${styles.projStage}`}>
      <Icon name="tools" size={56} />
      <span>{asset.kind} file — preview not rendered; metadata indexed.</span>
    </div>
  );
}

/* sprite-strip scrubber: hover to preview a frame, click to seek the proxy */
function SpriteScrub({
  id, meta, videoRef, duration,
}: {
  id: number; meta: SpriteMeta; videoRef: React.RefObject<HTMLVideoElement | null>; duration: number;
}) {
  const [hover, setHover] = useState<{ x: number; frame: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = barRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const frame = Math.min(meta.count - 1, Math.floor(ratio * meta.count));
    setHover({ x: ratio * rect.width, frame });
  };
  const onClick = (e: React.MouseEvent) => {
    const el = barRef.current, v = videoRef.current; if (!el || !v) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    v.play().catch(() => {});
  };

  const tile = hover ? { col: hover.frame % meta.cols, row: Math.floor(hover.frame / meta.cols) } : null;
  const ratioPct = hover && barRef.current ? (hover.x / barRef.current.getBoundingClientRect().width) * 100 : 0;

  return (
    <div
      ref={barRef}
      className={styles.scrub}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onClick={onClick}
      title="Hover to preview · click to seek"
    >
      {hover && <span className={styles.scrubFill} style={{ width: `${ratioPct}%` }} />}
      {hover && <span className={styles.scrubLine} style={{ left: hover.x }} />}
      {hover && tile && (
        <span
          className={styles.spritePrev}
          style={{
            left: hover.x,
            width: meta.tileW, height: meta.tileH,
            backgroundImage: `url(${media(id, "sprite")})`,
            backgroundSize: `${meta.cols * meta.tileW}px ${meta.rows * meta.tileH}px`,
            backgroundPosition: `-${tile.col * meta.tileW}px -${tile.row * meta.tileH}px`,
          }}
        />
      )}
    </div>
  );
}
