/* ============================================================
   StudioCreation — UI Primitives
   Exposes: Btn, IconBtn, Chip, Pill, Cost, Prov, Bar, Gauge,
   Score, Avatar, Media, Sheet, Seg, Stat, EmpAvatar, BrandDot
   ============================================================ */

const I = (props) => React.createElement(window.Icon, props);

function Btn({ variant = "", size = "", icon, iconRight, children, className = "", ...rest }) {
  const cls = ["btn", variant && "btn-" + variant, size && "btn-" + size, className].filter(Boolean).join(" ");
  return (
    <button className={cls} {...rest}>
      {icon && <I name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
      {iconRight && <I name={iconRight} size={size === "sm" ? 13 : 15} />}
    </button>
  );
}

function IconBtn({ icon, size = 16, className = "", ghost, ...rest }) {
  return (
    <button className={`icon-btn ${ghost ? "ghost" : ""} ${className}`} {...rest}>
      <I name={icon} size={size} />
    </button>
  );
}

function Chip({ on, dot, icon, onX, children, className = "", ...rest }) {
  return (
    <span className={`chip ${on ? "on" : ""} ${className}`} {...rest}>
      {dot && <span className="dot" style={{ background: dot }} />}
      {icon && <I name={icon} size={13} />}
      {children}
      {onX && <span className="x" onClick={(e) => { e.stopPropagation(); onX(); }}><I name="x" size={11} /></span>}
    </span>
  );
}

function Pill({ state = "queued", children, label }) {
  const txt = label || ({ queued: "Queued", running: "Generating", ready: "Ready", done: "Done", fail: "Failed" }[state] || state);
  return <span className={`pill ${state}`}><span className="led" />{children || txt}</span>;
}

function Cost({ value, variant = "", prefix = "$", children }) {
  return <span className={`cost ${variant}`}>{prefix}{value != null ? Number(value).toFixed(value < 1 ? 3 : 2) : ""}{children}</span>;
}

function Prov({ id }) {
  const map = { fal: "fal", higgs: "higgsfield" };
  return <span className={`prov ${id}`}><span className="sq" />{map[id]}</span>;
}

function Bar({ value = 0, variant = "", shimmer = false, height = 6 }) {
  return (
    <div className={`bar ${variant} ${shimmer ? "shimmer" : ""}`} style={{ height }}>
      <i style={{ width: Math.min(100, value * 100) + "%" }} />
    </div>
  );
}

/* Fuel gauge: used segment + projected ("after this job") ghost segment */
function Gauge({ used, cap, projected = 0, height = 8 }) {
  const u = Math.min(1, used / cap);
  const p = Math.min(1, (used + projected) / cap);
  const variant = u >= 1 ? "over" : u >= 0.75 ? "warn" : "";
  return (
    <div className={`gauge ${variant}`} style={{ height }}>
      <div className="used" style={{ width: u * 100 + "%" }} />
      {projected > 0 && <div className="proj" style={{ left: u * 100 + "%", width: (p - u) * 100 + "%" }} />}
    </div>
  );
}

/* 0-10 score control. Pass gate >= 8 turns green. */
function Score({ value, onChange, size = 9, readOnly = false }) {
  const [hover, setHover] = React.useState(null);
  const shown = hover != null ? hover : value;
  return (
    <div className="scoredots" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: 10 }).map((_, i) => {
        const n = i + 1;
        const active = shown != null && n <= shown;
        const pass = shown != null && shown >= 8 && active;
        return (
          <i key={n} className={active ? (pass ? "pass" : "fill") : ""}
            style={{ width: size, height: size }}
            onMouseEnter={() => !readOnly && setHover(n)}
            onClick={() => !readOnly && onChange && onChange(n)} />
        );
      })}
    </div>
  );
}

function Avatar({ glyph, size = 28, sq = false, hue, style }) {
  const bg = hue != null
    ? `linear-gradient(150deg, oklch(0.78 0.13 ${hue}), oklch(0.5 0.12 ${hue}))`
    : undefined;
  return (
    <span className={`av ${sq ? "sq" : ""}`} style={{
      width: size, height: size, fontSize: size * 0.36,
      borderRadius: sq ? size * 0.32 : "50%", background: bg, ...style }}>
      {glyph}
    </span>
  );
}
const EmpAvatar = ({ id, size = 28, sq = true }) => {
  const e = window.DATA.EMP[id]; if (!e) return null;
  return <Avatar glyph={e.glyph} size={size} sq={sq} hue={e.hue} />;
};
const BrandDot = ({ id, size = 8 }) => {
  const b = window.DATA.BRANDS[id]; if (!b) return null;
  return <span style={{ width: size, height: size, borderRadius: 3, background: b.swatch[0], display: "inline-block", flex: "none" }} />;
};

/* Media placeholder — striped tile sized to ratio, with a type label.
   `loading` shows the shimmer skeleton; `fresh` plays an AirDrop arrival. */
function Media({ ratio = "1:1", label, type = "image", hue = 220, loading = false, fresh = false,
                radius = 12, className = "", style, children, scrub = false, score }) {
  const [rw, rh] = ratio.split(":").map(Number);
  const pad = (rh / rw) * 100;
  return (
    <div className={`${className} ${fresh ? "air" : ""}`} style={{ position: "relative", width: "100%", ...style }}>
      <div style={{ paddingTop: pad + "%" }} />
      <div className={loading ? "skel" : "ph"} style={{
        position: "absolute", inset: 0, borderRadius: radius,
        background: loading ? undefined :
          `repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 11px),
           radial-gradient(120% 120% at 30% 0%, oklch(0.32 0.06 ${hue}), var(--bg-2))`,
        overflow: "hidden",
      }}>
        {!loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name={type === "video" ? "play" : "image"} size={ratio === "9:16" ? 20 : 24}
               style={{ color: "rgba(255,255,255,0.13)" }} fill={type === "video"} />
          </div>
        )}
        {!loading && label && (
          <span className="ph-label" style={{ position: "absolute", left: 8, top: 8 }}>{label}</span>
        )}
        {!loading && scrub && (
          <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, height: 3, borderRadius: 2,
            background: "rgba(255,255,255,0.14)" }}>
            <div className="scrubline" style={{ position: "absolute", top: -2, width: 2, height: 7, borderRadius: 2, background: "var(--gold-hi)" }} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Sheet({ onClose, children, width = 560, style }) {
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="sheet" style={{ width, ...style }} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.icon && <I name={o.icon} size={14} />}{o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, accent, icon, trend }) {
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row gap2" style={{ color: "var(--tx-3)" }}>
        {icon && <I name={icon} size={13} />}
        <span className="t-label">{label}</span>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <span className="tnum" style={{ fontSize: 26, fontWeight: 660, letterSpacing: "-0.03em", color: accent || "var(--tx-1)" }}>{value}</span>
        {trend && <span className="t-xs" style={{ color: trend.up ? "var(--ok)" : "var(--tx-3)" }}>{trend.txt}</span>}
      </div>
      {sub && <span className="t-xs">{sub}</span>}
    </div>
  );
}

/* tiny inline sparkline from an array of numbers */
function Spark({ data, w = 90, h = 26, color = "var(--gold)" }) {
  const max = Math.max(...data, 0.001), min = Math.min(...data, 0);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / (max - min || 1)) * (h - 4) - 2} r="2.4" fill={color} />
    </svg>
  );
}

Object.assign(window, { Btn, IconBtn, Chip, Pill, Cost, Prov, Bar, Gauge, Score, Avatar, EmpAvatar, BrandDot, Media, Sheet, Seg, Stat, Spark, UIIcon: I });

/* scrubline keyframe (injected once) */
if (!document.getElementById("__ui_kf")) {
  const s = document.createElement("style"); s.id = "__ui_kf";
  s.textContent = "@keyframes scrubmove{0%{left:0}100%{left:100%}} .scrubline{animation:scrubmove 2.4s var(--ease-out) infinite alternate}";
  document.head.appendChild(s);
}
