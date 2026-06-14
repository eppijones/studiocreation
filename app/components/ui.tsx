"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

/* ---------- Card ---------- */
export function Card({
  className = "",
  pad,
  glass,
  sel,
  children,
  ...rest
}: {
  className?: string;
  pad?: boolean;
  glass?: boolean;
  sel?: boolean;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`card ${pad ? "card-pad" : ""} ${glass ? "glass" : ""} ${sel ? "sel" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
type BtnVariant = "default" | "primary" | "ghost" | "quiet" | "danger";
export function Btn({
  variant = "default",
  size,
  icon,
  children,
  className = "",
  ...rest
}: {
  variant?: BtnVariant;
  size?: "sm" | "lg";
  icon?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = variant === "default" ? "" : `btn-${variant}`;
  const s = size ? `btn-${size}` : "";
  return (
    <button className={`btn ${v} ${s} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "lg" ? 16 : 15} />}
      {children}
    </button>
  );
}

/* ---------- Chip ---------- */
export function Chip({
  on,
  dot,
  onRemove,
  children,
  className = "",
  ...rest
}: {
  on?: boolean;
  dot?: string;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""} ${className}`} {...rest}>
      {dot && <span className="dot" style={{ background: dot }} />}
      {children}
      {onRemove && (
        <span
          className="x"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Icon name="x" size={11} />
        </span>
      )}
    </button>
  );
}

/* ---------- Status pill ---------- */
const PILL_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Generating",
  done: "Ready",
  ready: "Ready",
  error: "Failed",
  new: "New",
  flagged: "Flagged",
  hidden: "Hidden",
  approved: "Approved",
  delivered: "Delivered",
  canceled: "Canceled",
};
export function Pill({ state, label }: { state: string; label?: string }) {
  const cls =
    state === "done" || state === "ready" || state === "approved" || state === "delivered"
      ? "ready"
      : state === "running"
        ? "running"
        : state === "error" || state === "flagged"
          ? "error"
          : state === "canceled"
            ? "canceled"
            : state === "new"
              ? "accent"
              : "queued";
  return (
    <span className={`pill ${cls}`}>
      <span className="led" />
      {label ?? PILL_LABEL[state] ?? state}
    </span>
  );
}

/* ---------- Cost / provider badges ---------- */
export function Cost({ usd, variant }: { usd: number; variant?: "accent" | "over" }) {
  const txt = usd < 1 && usd > 0 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`;
  return <span className={`cost ${variant ?? ""}`}>{txt}</span>;
}
export function ProviderBadge({ provider: _provider }: { provider?: string }) {
  // fal.ai is the single generation adapter; the badge is kept for layout parity.
  return (
    <span className="prov fal">
      <span className="sq" />
      fal
    </span>
  );
}

/* ---------- Fuel gauge ---------- */
export function FuelGauge({
  spent,
  cap,
  projected = 0,
  warnPct = 0.75,
  showMark = true,
}: {
  spent: number;
  cap: number;
  projected?: number;
  warnPct?: number;
  showMark?: boolean;
}) {
  const used = cap > 0 ? Math.min(spent / cap, 1) : 0;
  const projEnd = cap > 0 ? Math.min((spent + projected) / cap, 1) : 0;
  const ratio = cap > 0 ? (spent + projected) / cap : 0;
  const cls = ratio >= 1 ? "over" : ratio >= warnPct ? "warn" : "";
  return (
    <div className={`gauge ${cls}`}>
      <div className="used" style={{ width: `${used * 100}%` }} />
      {projected > 0 && (
        <div className="proj" style={{ left: `${used * 100}%`, width: `${Math.max(projEnd - used, 0) * 100}%` }} />
      )}
      {showMark && cap > 0 && <div className="mark" style={{ left: `${warnPct * 100}%` }} />}
    </div>
  );
}

/* ---------- Score strip (0–10) ---------- */
export function ScoreStrip({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="score-strip">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          className={`score-tick ${n >= 8 ? "hi" : ""} ${value === n ? "sel" : ""}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  unit,
  desc,
  tone,
  onClick,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  desc?: ReactNode;
  tone?: "accent" | "ok" | "warn" | "bad";
  onClick?: () => void;
  children?: ReactNode;
}) {
  const color = tone ? `var(--${tone === "bad" ? "bad" : tone}-tx)` : undefined;
  return (
    <Card pad className={`stat ${onClick ? "linerow click" : ""}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <span className="t-label">{label}</span>
      <span className="v" style={{ color }}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {desc && <span className="d">{desc}</span>}
      {children}
    </Card>
  );
}

/* ---------- Segmented control ---------- */
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Toggle switch ---------- */
export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <span className={`sw ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)} />;
}

/* ---------- Overlay / Sheet ---------- */
export function Overlay({ onClose, children, className = "" }: { onClose?: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className={`overlay ${className}`} onClick={() => onClose?.()}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- CountUp (eased number tween on change) ---------- */
export function CountUp({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  duration = 700,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(from + (to - from) * eased);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, duration]);
  return (
    <span className="tnum">
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ---------- Sparkline (SVG line + soft area fill) ---------- */
export function Sparkline({
  data,
  width = 96,
  height = 30,
  color = "var(--accent-hi)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...data, 0.0001);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const gid = `sparkfill-${data.length}-${Math.round(max * 1000)}`;
  return (
    <svg width={width} height={height} aria-hidden style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={color} />
    </svg>
  );
}

/* ---------- Toasts ---------- */
export interface ToastMsg {
  id: number;
  kind?: "ok" | "bad" | "info";
  title: string;
  sub?: string;
}
const ToastCtx = createContext<(t: Omit<ToastMsg, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const idRef = useRef(1);
  const push = useCallback((t: Omit<ToastMsg, "id">) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className={`ic ${t.kind ?? "info"}`}>
              <Icon name={t.kind === "bad" ? "alert" : t.kind === "ok" ? "check" : "spark"} size={16} />
            </span>
            <div className="grow">
              <div className="tt">{t.title}</div>
              {t.sub && <div className="ts mono">{t.sub}</div>}
            </div>
            <button className="icon-btn ghost" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
