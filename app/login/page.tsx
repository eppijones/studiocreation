"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Seg } from "../components/ui";
import { Icon } from "../components/Icon";
import { hueFor } from "../components/studio";

const OPERATORS = ["Eppi", "Teammate 1", "Teammate 2", "Guest"];
const ROLES: { value: string; label: string }[] = [
  { value: "creative", label: "Creative" },
  { value: "producer", label: "Producer" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
];
const ROLE_DESC: Record<string, string> = {
  creative: "Generate & review on the studio floor.",
  producer: "Generate, review & ship deliverables.",
  finance: "Govern the budget — caps & pools.",
  admin: "Full control — IT & governance.",
};

const REMEMBER_KEY = "studio_login";
const SHOWCASE_COLS = 3;

interface ShowcaseItem {
  id: number;
  blob_url: string | null;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  label: string;
  project: string;
}

function isVideo(ct: string | null | undefined): boolean {
  return !!ct && ct.startsWith("video");
}

function aspectFor(it: ShowcaseItem): string {
  if (it.width && it.height) return `${it.width} / ${it.height}`;
  // pleasant varied fallback heights for the masonry rhythm
  const seq = ["3 / 4", "4 / 5", "1 / 1", "9 / 16", "4 / 5"];
  return seq[it.id % seq.length];
}

/** Round-robin items into N columns, repeating the pool so short libraries
 *  still fill a tall wall. Returns [] when there's nothing to show. */
function toColumns(items: ShowcaseItem[], cols: number, minTiles: number): ShowcaseItem[][] {
  if (items.length === 0) return [];
  let pool = items;
  while (pool.length < minTiles) pool = pool.concat(items);
  const out: ShowcaseItem[][] = Array.from({ length: cols }, () => []);
  pool.forEach((it, i) => out[i % cols].push(it));
  return out;
}

/** Synthetic mesh tiles for an empty/curated-yet library — self-documents the
 *  `showcaser` tag so the wall is always alive, never a blank slate. */
const PLACEHOLDERS: ShowcaseItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: 9000 + i,
  blob_url: null,
  content_type: i % 4 === 0 ? "video/mp4" : "image/png",
  width: null,
  height: null,
  duration_s: null,
  score: null,
  label: "showcaser",
  project: "studio",
}));

function ShowcaseTile({ it }: { it: ShowcaseItem }) {
  const vid = isVideo(it.content_type);
  return (
    <div
      className="sc-item"
      style={{ aspectRatio: aspectFor(it), ["--hue" as string]: hueFor(it.blob_url ? it.id : it.id + 7) }}
    >
      <div className="mesh" />
      {it.blob_url ? (
        vid ? (
          <video src={it.blob_url} muted loop autoPlay playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.blob_url} alt={it.label} loading="lazy" />
        )
      ) : (
        <div className="sc-glyph">
          <Icon name={vid ? "video" : "image"} size={22} />
        </div>
      )}
      <div className="sc-grain" />
      {it.blob_url && (
        <div className="sc-cap">
          <span className="sc-cap-title">{it.project}/{it.label}</span>
          {it.score != null && <span className="sc-cap-score">{it.score}/10</span>}
        </div>
      )}
    </div>
  );
}

function ShowcaseWall({ items }: { items: ShowcaseItem[] }) {
  const source = items.length > 0 ? items : PLACEHOLDERS;
  const columns = useMemo(() => toColumns(source, SHOWCASE_COLS, 15), [source]);
  // staggered drift speeds (s) so the columns never lock into a grid
  const durations = [62, 78, 54];
  return (
    <div className="sc-wall" aria-hidden>
      {columns.map((col, ci) => (
        <div className="sc-col" key={ci}>
          <div className="sc-track" style={{ ["--dur" as string]: `${durations[ci % durations.length]}s` }}>
            {col.map((it, i) => (
              <ShowcaseTile key={`a-${ci}-${i}-${it.id}`} it={it} />
            ))}
            {/* duplicate copy for a seamless loop */}
            {col.map((it, i) => (
              <ShowcaseTile key={`b-${ci}-${i}-${it.id}`} it={it} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [operator, setOperator] = useState(OPERATORS[0]);
  const [customOperator, setCustomOperator] = useState("");
  const [role, setRole] = useState("creative");
  const [remember, setRemember] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);
  const router = useRouter();

  // Pull the curated showcaser wall — public, best-effort, never blocks login.
  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => setShowcase(Array.isArray(d.showcase) ? d.showcase : []))
      .catch(() => {});
  }, []);

  // Remember-me: restore the last operator + role on this device.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { operator?: string; role?: string; remember?: boolean };
      if (!saved.remember) return;
      setRemember(true);
      if (saved.operator) {
        if (OPERATORS.includes(saved.operator)) setOperator(saved.operator);
        else {
          setOperator("custom");
          setCustomOperator(saved.operator);
        }
        setReturning(saved.operator);
      }
      if (saved.role) setRole(saved.role);
    } catch {
      /* corrupt/blocked storage — ignore */
    }
  }, []);

  const featuredCount = showcase.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const name = (operator === "custom" ? customOperator : operator).trim() || "unknown";
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, operator: name, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Login failed");
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ operator: name, role, remember: true }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage blocked — session cookie still persists for a year */
      }
      router.push("/create");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      {/* SHOWCASE — a living wall of the studio's curated top picks */}
      <section className="auth-showcase">
        <ShowcaseWall items={showcase} />
        <div className="auth-showcase-scrim" />
        <div className="auth-showcase-copy">
          <div className="auth-mark">
            <span className="glyph">
              <Icon name="bolt" size={18} />
            </span>
            <span className="auth-mark-name">StudioCreation</span>
          </div>
          <h2 className="auth-headline">Where the studio&apos;s best work lives.</h2>
          <p className="auth-sub">
            A living wall of our top picks — generated, reviewed, and shipped in-house on fal.
          </p>
        </div>
        <div className="auth-showcase-foot">
          {featuredCount > 0 ? (
            <span>
              <Icon name="spark" size={13} /> {featuredCount} featured render{featuredCount === 1 ? "" : "s"} ·
              curated from the library
            </span>
          ) : (
            <span>
              <Icon name="spark" size={13} /> Tag renders <code>showcaser</code> in the gallery to feature them here
            </span>
          )}
        </div>
      </section>

      {/* SIGN-IN */}
      <section className="auth-pane">
        <div className="auth-bg" aria-hidden />
        <div className="auth-card glass">
          <form onSubmit={submit} className="col gap5">
            <div className="auth-card-hd">
              <span className="glyph auth-card-glyph">
                <Icon name="bolt" size={20} />
              </span>
              <div>
                <h1 className="t-h2" style={{ margin: 0 }}>
                  {returning ? `Welcome back, ${returning.split(" ")[0]}` : "Enter the studio"}
                </h1>
                <p className="t-sm muted" style={{ margin: 0 }}>
                  {returning ? "Confirm your role & password to continue." : "Sign in to the studio floor."}
                </p>
              </div>
            </div>

            {/* operator */}
            <div className="col gap2">
              <span className="field-label">Who&apos;s at the desk?</span>
              <div className="row gap2 wrap">
                {OPERATORS.map((name) => (
                  <Chip key={name} on={operator === name} onClick={() => setOperator(name)}>
                    {name}
                  </Chip>
                ))}
                <Chip on={operator === "custom"} onClick={() => setOperator("custom")}>
                  Other…
                </Chip>
              </div>
              {operator === "custom" && (
                <input
                  className="input"
                  placeholder="Your name"
                  value={customOperator}
                  onChange={(e) => setCustomOperator(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {/* role */}
            <div className="col gap2">
              <span className="field-label">Role for this session</span>
              <Seg options={ROLES} value={role} onChange={setRole} />
              <p className="t-xs muted" style={{ margin: 0 }}>{ROLE_DESC[role]}</p>
            </div>

            {/* password */}
            <div className="col gap2">
              <span className="field-label">
                <Icon name="lock" size={12} /> Studio password
              </span>
              <div className="auth-pw">
                <input
                  className="input"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={operator !== "custom"}
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  title={showPw ? "Hide password" : "Show password"}
                >
                  <Icon name={showPw ? "eyeoff" : "eye"} size={16} />
                </button>
              </div>
            </div>

            {/* remember */}
            <button
              type="button"
              className={`auth-remember ${remember ? "on" : ""}`}
              onClick={() => setRemember((v) => !v)}
              aria-pressed={remember}
            >
              <span className={`sw ${remember ? "on" : ""}`} aria-hidden />
              <span>Remember me on this device</span>
            </button>

            <Btn
              variant="primary"
              size="lg"
              type="submit"
              style={{ width: "100%" }}
              disabled={busy || !password}
            >
              {busy ? "Checking…" : "Enter the studio"}
            </Btn>

            <p className="t-xs muted" style={{ margin: 0, textAlign: "center" }}>
              Every job is logged under your operator name.
            </p>

            {error && <p className="err" style={{ margin: 0, textAlign: "center" }}>⚠️ {error}</p>}
          </form>
        </div>
      </section>
    </div>
  );
}
