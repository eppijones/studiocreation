"use client";

/* PUBLIC external review viewer — opened via a share link (token = credential).
   Renders WITHOUT the studio rail. A reviewer watches the proxy and leaves
   timecode-anchored comments that sync back into the team's thread. */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import styles from "./share.module.css";

interface ShareAsset {
  id: number; kind: string; filename: string; rel_path: string;
  duration_s: number | null; fps: number | null; width: number | null; height: number | null;
  proxyKinds: string[]; sprite: Record<string, unknown> | null;
}
interface Comment { id: number; author: string | null; body: string | null; tc_in: number | null; created_at: string }
interface ShareData {
  link: { token: string; target_type: string; embed: string; allow_comments: boolean; allow_download: boolean; expires_at: string | null };
  assets: ShareAsset[];
  comments: Record<number, Comment[]>;
  error?: string;
}

function fmtTc(s: number | null): string {
  if (s == null) return "";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}
function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ShareData | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const media = useCallback(
    (assetId: number, kind: string) => `/api/library/share-view/${token}/media/${assetId}/${kind}`,
    [token]
  );

  const load = useCallback(() => {
    fetch(`/api/library/share-view/${token}`)
      .then((r) => r.json())
      .then((d: ShareData) => {
        if (d.error) { setFatal(d.error); return; }
        setData(d);
        setFocusId((cur) => cur ?? d.assets[0]?.id ?? null);
      })
      .catch(() => setFatal("Could not load this review link."));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const focus = useMemo(() => data?.assets.find((a) => a.id === focusId) ?? null, [data, focusId]);
  const comments = (focusId != null && data?.comments[focusId]) || [];

  const submit = async () => {
    if (!body.trim() || !focus) return;
    setBusy(true);
    const tcIn = pin && videoRef.current ? videoRef.current.currentTime : null;
    await fetch(`/api/library/share-view/${token}/comment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: focus.id, name, body: body.trim(), tcIn }),
    });
    setBody("");
    setBusy(false);
    load();
  };

  if (fatal) {
    return (
      <div className={styles.page}>
        <div className={styles.fatal}>
          <Icon name="x" size={28} />
          <p style={{ marginTop: 10 }}>{fatal}</p>
        </div>
      </div>
    );
  }
  if (!data || !focus) {
    return <div className={styles.page}><div className={styles.fatal}>Loading review…</div></div>;
  }

  const has = (k: string) => focus.proxyKinds.includes(k);

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.glyph}><Icon name="film" size={16} /></span>
          <span className={styles.brandName}>Portal One<small>Review link</small></span>
        </div>
        {data.link.expires_at && (
          <span className={styles.expiry}>Expires {new Date(data.link.expires_at).toLocaleDateString()}</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.stageCol}>
          <div>
            <div className={styles.title}>{focus.filename}</div>
            <div className={styles.sub}>{focus.kind}{focus.width ? ` · ${focus.width}×${focus.height}` : ""}</div>
          </div>

          <div className={styles.stage}>
            {focus.kind === "video" && has("video_proxy") ? (
              <video ref={videoRef} src={media(focus.id, "video_proxy")}
                poster={has("poster") ? media(focus.id, "poster") : undefined} controls preload="metadata" />
            ) : focus.kind === "image" && has("thumb") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media(focus.id, "thumb")} alt={focus.filename} />
            ) : focus.kind === "doc" && has("page_preview") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media(focus.id, "page_preview")} alt={focus.filename} />
            ) : has("waveform") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media(focus.id, "waveform")} alt="waveform" />
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "var(--tx-4)" }}>Preview unavailable</div>
            )}
          </div>

          {data.link.allow_download && (
            <a className={styles.downloadBtn}
              href={media(focus.id, focus.kind === "video" ? "video_proxy" : has("thumb") ? "thumb" : "poster")}
              download>
              <Icon name="download" size={14} /> Download proxy
            </a>
          )}

          {data.assets.length > 1 && (
            <div className={styles.filmstrip}>
              {data.assets.map((a) => (
                <button key={a.id} className={`${styles.thumb} ${a.id === focusId ? styles.thumbOn : ""}`}
                  onClick={() => setFocusId(a.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media(a.id, a.kind === "audio" ? "waveform" : a.kind === "video" ? "poster" : "thumb")} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className={styles.side}>
          <div className={styles.sideHd}>Comments{comments.length ? ` · ${comments.length}` : ""}</div>

          {data.link.allow_comments && (
            <div className={styles.composer}>
              <input className={styles.input} placeholder="Your name" value={name}
                onChange={(e) => setName(e.target.value)} maxLength={40} />
              <textarea className={styles.ta} placeholder="Leave a note…" value={body}
                onChange={(e) => setBody(e.target.value)} />
              <div className={styles.row}>
                {focus.kind === "video" && (
                  <button className={`${styles.pin} ${pin ? styles.pinOn : ""}`} onClick={() => setPin((p) => !p)}>
                    <Icon name="clock" size={12} /> Pin to current time
                  </button>
                )}
                <button className={styles.send} disabled={busy || !body.trim()} onClick={submit}>Comment</button>
              </div>
            </div>
          )}

          <div className={styles.thread}>
            {comments.length === 0 && <div className={styles.empty}>No comments yet.</div>}
            {comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <div className={styles.cHd}>
                  <span className={styles.author}>{c.author ?? "—"}</span>
                  {c.tc_in != null && (
                    <button className={styles.tcChip}
                      onClick={() => { if (videoRef.current) videoRef.current.currentTime = c.tc_in!; }}>
                      <Icon name="play" size={10} /> {fmtTc(c.tc_in)}
                    </button>
                  )}
                </div>
                <div className={styles.cBody}>{c.body}</div>
                <div className={styles.cTime}>{ago(c.created_at)}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
