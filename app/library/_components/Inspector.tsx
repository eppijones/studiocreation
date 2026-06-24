"use client";

import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import styles from "../library.module.css";
import {
  type AssetDetail, type ReviewState, KIND_ICON,
  fmtDur, fmtSize, resLabel, hueFor,
} from "./lib";

function fmtDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function humanizeEvent(type: string): string {
  const map: Record<string, string> = {
    "review.state": "changed review state", "state_changed": "changed review state",
    "asset.state_changed": "changed review state", "review.rating": "set a rating",
    "rating": "set a rating", "tag.add": "added a tag", "tag.remove": "removed a tag",
    "comment": "left a comment", "annotation": "left a comment", "proxy.ready": "built a proxy",
    "ingest": "ingested the file", "upload": "uploaded the file",
  };
  return map[type] ?? type.replace(/[._]/g, " ");
}

/* Pane 4 — the Inspector. Shows the actively-inspected asset: preview, favorite +
   rating, review-state stepper with Approve/Reject, real metadata, storage chips,
   real tags (+ add), and the real activity feed. Empty when nothing is selected. */
export function Inspector({
  detail, loading, reviewStates, approveState, rejectState, volumeName,
  onSetState, onRate, onAddTag, onOpen, onClose, onShare,
}: {
  detail: AssetDetail | null;
  loading: boolean;
  reviewStates: ReviewState[];
  approveState?: ReviewState;
  rejectState?: ReviewState;
  volumeName?: string;
  onSetState: (key: string) => void;
  onRate: (rating: number) => void;
  onAddTag: (label: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onShare: () => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const [approvePulse, setApprovePulse] = useState(0);
  // Reset the Approve "juice" whenever the inspected asset changes, so the keyed
  // inspBody remount can't replay a phantom burst on an asset you never approved.
  useEffect(() => { setApprovePulse(0); }, [detail?.asset.id]);

  if (!detail) {
    return (
      <aside className={styles.inspector}>
        {loading ? (
          <>
            <div className={styles.inspHd}><span className={styles.inspHdLabel}>Inspector</span></div>
            <div className={styles.inspBody}>
              <div className={`${styles.skel} ${styles.skelThumb}`} />
              <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "62%", height: 15 }} />
              <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: "40%" }} />
              <div className={styles.skel} style={{ height: 78, borderRadius: 9 }} />
              <div className={styles.skel} style={{ height: 120, borderRadius: 9 }} />
            </div>
          </>
        ) : (
          <div className={styles.inspEmpty}>
            <Icon name="eye" size={26} />
            <p>Select an asset to inspect</p>
            <span>Single-click a card · double-click opens the full review tool</span>
          </div>
        )}
      </aside>
    );
  }

  const a = detail.asset;
  const stateKey = a.review_state ?? null;
  const cur = stateKey ? reviewStates.find((s) => s.key === stateKey) ?? null : null;
  const rating = a.rating ?? 0;
  const poster = a.kind === "video" ? "poster" : a.kind === "image" ? "thumb"
    : a.kind === "audio" ? "waveform" : a.kind === "doc" ? "page_preview" : null;
  const proxyReady = detail.proxies.some((p) => p.status === "ready" && p.kind !== "thumb");

  // stepper: ordered states, the current one lit, prior ones filled.
  const ordered = [...reviewStates].sort((x, y) => x.ord - y.ord)
    .filter((s) => !rejectState || s.key !== rejectState.key);
  const curIdx = ordered.findIndex((s) => s.key === stateKey);

  const meta: { k: string; v: string }[] = [];
  const push = (k: string, v: string | number | null | undefined) => {
    if (v != null && v !== "") meta.push({ k, v: String(v) });
  };
  push("Resolution", a.width && a.height ? `${a.width}×${a.height}` : resLabel(a.height));
  push("Codec", a.codec);
  push("Container", a.container);
  push("Frame rate", a.fps ? `${a.fps} fps` : null);
  push("Duration", fmtDur(a.duration_s));
  push("Audio", a.audio_codec);
  push("File size", fmtSize(a.size_bytes));
  push("Proxy", proxyReady ? "Ready" : "Original");
  push("Volume", volumeName);
  push("Added", fmtDate(a.mtime ?? a.discovered_at));

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspHd}>
        <span className={styles.inspHdLabel}>Inspector</span>
        <div className={styles.inspHdActions}>
          <button className={styles.iconBtn} onClick={onShare} title="Share"><Icon name="share" size={14} /></button>
          <button className={styles.iconBtn} onClick={onOpen} title="Open full review tool"><Icon name="expand" size={14} /></button>
          <button className={styles.iconBtn} onClick={onClose} title="Close"><Icon name="x" size={14} /></button>
        </div>
      </div>

      <div className={styles.inspBody} key={a.id}>
        <div className={styles.inspPreview} style={{ ["--hue" as string]: hueFor(a.filename) }} onClick={onOpen} title="Open full review tool">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/library/media/${a.id}/${poster}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <span className={styles.thumbIcon}><Icon name={KIND_ICON[a.kind] ?? "copy"} size={40} /></span>
          )}
          {a.kind === "video" && <span className={styles.inspPlay}><Icon name="play" size={20} /></span>}
          {/* Approve "juice": one-shot green ring + checkmark pop */}
          {approvePulse > 0 && (
            <span key={approvePulse} className={styles.approveBurst}>
              <span className={styles.approveRing} />
              <span className={styles.approveCheck}><Icon name="check" size={30} /></span>
            </span>
          )}
        </div>

        <div className={styles.inspTitleRow}>
          <span className={styles.inspName} title={a.filename}>{a.filename}</span>
          <button
            className={`${styles.favBtn} ${rating >= 5 ? styles.favOn : ""}`}
            onClick={() => onRate(rating >= 5 ? 0 : 5)}
            title={rating >= 5 ? "Unfavorite" : "Mark favorite (5★)"}
          >★</button>
        </div>
        <div className={styles.inspPath}>{a.rel_path}</div>

        {/* review state */}
        <div className={styles.inspBlock}>
          <div className={styles.inspBlockHd}>
            <span>Review state</span>
            {cur && (
              <span className={styles.inspStateLabel} style={{ color: cur.color }}>
                <span className={styles.dot} style={{ background: cur.color, boxShadow: `0 0 8px ${cur.color}` }} />
                {cur.label}
              </span>
            )}
          </div>
          <div className={styles.stepper} role="group" aria-label="Set review state">
            {ordered.map((s, i) => {
              const filled = curIdx >= 0 && i <= curIdx;
              return (
                <button
                  type="button"
                  key={s.key}
                  className={styles.step}
                  title={s.label}
                  aria-label={s.label}
                  aria-current={i === curIdx ? "true" : undefined}
                  onClick={() => onSetState(s.key)}
                  style={{
                    background: filled ? s.color : "var(--bg-4)",
                    boxShadow: i === curIdx ? `0 0 10px -1px ${s.color}` : "none",
                  }}
                />
              );
            })}
          </div>
          <div className={styles.inspBtnRow}>
            {approveState && (
              <button className={`${styles.inspBtn} ${styles.inspBtnOk}`} onClick={() => { setApprovePulse((p) => p + 1); onSetState(approveState.key); }}>
                <Icon name="check" size={13} /> Approve
              </button>
            )}
            {rejectState && (
              <button className={`${styles.inspBtn} ${styles.inspBtnBad}`} onClick={() => onSetState(rejectState.key)}>
                <Icon name="x" size={13} /> Reject
              </button>
            )}
          </div>
          {/* rating */}
          <div className={styles.inspRating} role="group" aria-label={`Rating: ${rating} of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                type="button"
                key={i}
                className={i <= rating ? styles.starOn : styles.starOff}
                onClick={() => onRate(i === rating ? 0 : i)}
                aria-pressed={i <= rating}
                aria-label={`${i} star${i > 1 ? "s" : ""}`}
                title={`${i}★`}
              >★</button>
            ))}
          </div>
        </div>

        {/* metadata */}
        <div className={styles.inspBlock}>
          <div className={styles.inspBlockHd}><span>Metadata</span></div>
          <div className={styles.metaGrid}>
            {meta.map((m) => (
              <div className={styles.metaRow} key={m.k}>
                <span className={styles.metaK}>{m.k}</span>
                <span className={styles.metaV}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* storage */}
        <div className={styles.inspBlock}>
          <div className={styles.inspBlockHd}><span>Storage</span></div>
          <div className={styles.storageRow}>
            <div className={`${styles.storeChip} ${styles.storeOk}`}><Icon name="drive" size={15} /> Local</div>
            <div className={`${styles.storeChip} ${proxyReady ? styles.storeAccent : styles.storeOff}`}><Icon name="layers" size={15} /> Proxied</div>
            <div className={`${styles.storeChip} ${styles.storeOff}`}><Icon name="cloud" size={15} /> Cloud</div>
          </div>
        </div>

        {/* tags */}
        <div className={styles.inspBlock}>
          <div className={styles.inspBlockHd}><span>Tags</span></div>
          <div className={styles.tagWrap}>
            {detail.tags.map((t) => (
              <span key={`${t.source}:${t.label}`} className={styles.tag}>{t.label}</span>
            ))}
            <input
              className={styles.tagInput}
              placeholder="+ Add tag"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagDraft.trim()) { onAddTag(tagDraft.trim()); setTagDraft(""); }
              }}
            />
          </div>
        </div>

        {/* activity */}
        {detail.events.length > 0 && (
          <div className={styles.inspBlock}>
            <div className={styles.inspBlockHd}><span>Activity</span></div>
            <div className={styles.activity}>
              {detail.events.slice(0, 8).map((ev) => {
                const who = ev.actor || "Someone";
                return (
                  <div className={styles.actRow} key={ev.id}>
                    <span className={styles.actAv}>{who.slice(0, 1).toUpperCase()}</span>
                    <div className={styles.actBody}>
                      <span className={styles.actText}><strong>{who}</strong> {humanizeEvent(ev.type)}</span>
                      <span className={styles.actTime}>{fmtDate(ev.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
