// StudioCreation — core UI primitives shared by all screens
(function(){
const { useState, useEffect, useRef } = React;
const D = window.SC_DATA;

/* ---------- helpers ---------- */
const money = (v) => '$' + (Math.round(v*100)/100).toFixed(2);
const money3 = (v) => '$' + v.toFixed(3).replace(/0$/,'').replace(/\.$/,'.00');
const asp = (a) => a ? a.replace(':',' / ') : '16 / 9';
const modelName = (id) => (D.MODELS[id] || {name:id}).name;
const empById = (id) => D.EMPLOYEES.find(e => e.id === id);
const uid = () => 'x' + Math.random().toString(36).slice(2,9);
const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };
function mixHex(h1, h2, t){
  const p = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const a = p(h1), b = p(h2);
  return '#' + a.map((v,i) => Math.round(v + (b[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
function useInterval(cb, ms){
  const ref = useRef(cb); ref.current = cb;
  useEffect(() => { const t = setInterval(() => ref.current(), ms); return () => clearInterval(t); }, [ms]);
}

/* ---------- generative render art (vivid cinematic gradients) ---------- */
function artBackground(palette, seed){
  seed = seed || 1;
  const [a,b,c] = palette;
  const r = (n) => Math.sin(seed*99.7 + n*37.3) * 0.5 + 0.5;
  const px = (n,lo,hi) => Math.round(lo + r(n)*(hi-lo));
  return [
    `radial-gradient(42% 30% at ${px(7,52,82)}% ${px(8,8,30)}%, rgba(255,255,255,.42) 0%, transparent 70%)`,
    `radial-gradient(95% 75% at ${px(1,8,42)}% ${px(2,5,35)}%, ${a} 0%, transparent 62%)`,
    `radial-gradient(115% 85% at ${px(3,58,92)}% ${px(4,12,48)}%, ${b} 0%, transparent 64%)`,
    `radial-gradient(150% 115% at ${px(5,28,72)}% ${px(6,78,112)}%, ${c} 0%, transparent 75%)`,
    `linear-gradient(180deg, ${c}, #05060a)`
  ].join(',');
}

function RenderArt({ palette, seed, style, className }){
  return <div className={className || ''} style={{ background: artBackground(palette, seed), ...style }}></div>;
}

/* ---------- tile ---------- */
function RenderTile({ render: r, onClick, showMeta = true, fresh = false, style }){
  const [scrub, setScrub] = useState(null);
  const isVideo = r.type === 'video';
  return (
    <figure
      className={'tile' + (r.hero ? ' hero' : '') + (fresh ? ' premiere' : '')}
      data-comment-anchor={'tile-' + r.id}
      style={{ '--p0': r.palette[0], '--p1': r.palette[1], aspectRatio: asp(r.aspect), ...style }}
      onClick={onClick}
      onMouseMove={isVideo ? (e) => { const b = e.currentTarget.getBoundingClientRect(); setScrub(Math.min(1, Math.max(0, (e.clientX - b.left)/b.width))); } : undefined}
      onMouseLeave={isVideo ? () => setScrub(null) : undefined}
    >
      <RenderArt className="tile-art" palette={r.palette} seed={r.seed}></RenderArt>
      {isVideo && <div className="tile-shimmer" style={{ opacity: scrub != null ? 1 : 0, left: ((scrub||0)*100) + '%' }}></div>}
      {isVideo && scrub != null && <div className="tile-scrubline"><i style={{ left: 'calc(' + (scrub*100) + '% - 3px)' }}></i></div>}
      {isVideo && <span className="tile-dur mono">{r.duration}s</span>}
      {r.hero && <span className="tile-herobadge">HERO</span>}
      {showMeta && (
        <figcaption className="tile-meta">
          <span className="tile-title">{r.title}</span>
          <span className="tile-sub mono">{modelName(r.model)} · {money(r.cost)}</span>
          <span className="spacer"></span>
          <ProviderBadge provider={r.provider}></ProviderBadge>
          {r.score == null
            ? <span className="chip needs">SCORE</span>
            : <span className={'score-pill' + (r.score >= 8 ? ' hi' : '')}>{r.score}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function ProviderBadge({ provider }){
  return <span className={'provider-badge ' + provider}>{provider === 'fal' ? 'fal' : 'higgsfield'}</span>;
}

function Avatar({ employee, size = 26 }){
  const p = employee.palette;
  return (
    <span className="avatar" style={{
      width: size, height: size, fontSize: size * 0.42,
      background: `radial-gradient(120% 120% at 25% 20%, ${p[0]}, ${p[1]} 70%)`,
      boxShadow: `0 2px 10px color-mix(in srgb, ${p[0]} calc(var(--glow) * 45%), transparent)`
    }}>{employee.persona[0]}</span>
  );
}

/* ---------- rolling number ---------- */
function RollingNumber({ value, format = money, className = '', style }){
  const [disp, setDisp] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current, to = value;
    if (from === to) return;
    const t0 = performance.now(), dur = 650;
    cancelAnimationFrame(rafRef.current);
    const step = (now) => {
      const k = Math.min(1, (now - t0)/dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = from + (to - from) * e;
      fromRef.current = v; setDisp(v);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span className={'mono ' + className} style={style}>{format(disp)}</span>;
}

/* ---------- fuel gauge ---------- */
function FuelGauge({ spent, cap, projected = 0, height = 8, showMark = true }){
  const pct = Math.min(100, spent/cap*100);
  const ppct = Math.max(0, Math.min(100 - pct, projected/cap*100));
  const ratio = (spent + projected)/cap;
  const cls = ratio > 1 ? ' over' : (ratio >= D.BUDGET.warnAt ? ' warn' : '');
  return (
    <div className={'gauge' + cls} style={{ height }}>
      <div className="gauge-fill" style={{ width: pct + '%' }}></div>
      {projected > 0 && <div className="gauge-proj" style={{ left: pct + '%', width: ppct + '%' }}></div>}
      {showMark && <div className="gauge-mark" style={{ left: (D.BUDGET.warnAt*100) + '%' }}></div>}
    </div>
  );
}

/* ---------- score strip ---------- */
function ScoreStrip({ value, onScore }){
  return (
    <div className="score-strip">
      {Array.from({ length: 11 }, (_, i) => (
        <button key={i}
          className={'score-tick' + (i >= 8 ? ' hi' : '') + (value === i ? ' sel' : '')}
          onClick={(e) => { e.stopPropagation(); onScore(i); }}>{i}</button>
      ))}
    </div>
  );
}

/* ---------- toasts ---------- */
function ToastStack({ toasts, onDismiss, onAction }){
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className="toast glass premiere" style={t.render ? { '--p0': t.render.palette[0] } : null}>
          {t.render && <RenderArt className="toast-art" palette={t.render.palette} seed={t.render.seed}></RenderArt>}
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            <div className="toast-sub mono">{t.sub}</div>
          </div>
          {t.action && <button className="btn btn-ghost btn-sm" onClick={() => onAction(t)}>{t.action}</button>}
          <button className="toast-x" onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  money, money3, asp, modelName, empById, uid, nowTime, mixHex, useInterval,
  artBackground, RenderArt, RenderTile, ProviderBadge, Avatar,
  RollingNumber, FuelGauge, ScoreStrip, ToastStack
});
})();
