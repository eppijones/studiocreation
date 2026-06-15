/* ============================================================
   StudioCreation v2 — UI patch
   Loaded AFTER ui.jsx: overrides Media (living mesh-gradient
   tiles) + Spark (gradient area chart), adds CountUp.
   Screens resolve window.* at render time, so overrides apply.
   ============================================================ */

const IV2 = (props) => React.createElement(window.Icon, props);

/* Media v2 — Frame.io-style vivid drifting gradient tile.
   Same prop contract as v1 Media. */
function MediaV2({ ratio = "1:1", label, type = "image", hue = 220, loading = false, fresh = false,
                   radius = 12, className = "", style, children, scrub = false, score }) {
  const [rw, rh] = ratio.split(":").map(Number);
  const pad = (rh / rw) * 100;
  const mesh =
    `radial-gradient(95% 120% at 12% 8%, oklch(0.58 0.20 ${hue}) 0%, transparent 58%),` +
    `radial-gradient(85% 110% at 88% 18%, oklch(0.50 0.22 ${hue + 75}) 0%, transparent 52%),` +
    `radial-gradient(120% 100% at 55% 108%, oklch(0.36 0.17 ${hue - 55}) 0%, transparent 62%),` +
    `var(--m2-base)`;
  return (
    <div className={`${className} ${fresh ? "air" : ""}`} style={{ position: "relative", width: "100%", ...style }}>
      <div style={{ paddingTop: pad + "%" }}></div>
      {loading ? (
        <div className="skel" style={{ position: "absolute", inset: 0, borderRadius: radius }}>{children}</div>
      ) : (
        <div className="m2" style={{ borderRadius: radius }}>
          <div className="m2grad" style={{ background: mesh }}></div>
          <div className="m2grain"></div>
          <div className="m2icon">
            <IV2 name={type === "video" ? "play" : "image"} size={ratio === "9:16" ? 20 : 24} fill={type === "video"} />
          </div>
          {label && <span className="ph-label" style={{ position: "absolute", left: 8, top: 8 }}>{label}</span>}
          {scrub && <div className="m2scrub"><div className="scrubline"></div></div>}
          {children}
        </div>
      )}
    </div>
  );
}

/* Spark v2 — line + soft gradient area fill */
function SparkV2({ data, w = 90, h = 26, color = "var(--gold)" }) {
  const id = React.useId().replace(/:/g, "");
  const max = Math.max(...data, 0.001), min = Math.min(...data, 0);
  const xy = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / (max - min || 1)) * (h - 4) - 2,
  ]);
  const pts = xy.map(p => p.join(",")).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }}></stop>
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }}></stop>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg${id})`}></polygon>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"></polyline>
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color}></circle>
    </svg>
  );
}

/* CountUp — eased number animation whenever `value` changes */
function CountUp({ value, decimals = 0, prefix = "", suffix = "", duration = 700, className = "", style }) {
  const [v, setV] = React.useState(value);
  const prev = React.useRef(value);
  React.useEffect(() => {
    const from = prev.current, to = value;
    prev.current = value;
    if (from === to) return;
    let raf; const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className} style={style}>{prefix}{Number(v).toFixed(decimals)}{suffix}</span>;
}

Object.assign(window, { Media: MediaV2, Spark: SparkV2, CountUp });
