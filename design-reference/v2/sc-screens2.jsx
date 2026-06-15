// StudioCreation — Costs, Briefs (batch runner), Handoff (Higgsfield packages)
(function(){
const { useState } = React;
const D = window.SC_DATA;

/* ================= COSTS ================= */
function CostsScreen({ S }){
  const [logOpen, setLogOpen] = useState(false);
  const left = Math.max(0, D.BUDGET.cap - S.spentToday);
  const byModel = {};
  S.ledger.forEach(l => { byModel[l.model] = (byModel[l.model] || 0) + l.cost; });
  const rows = Object.entries(byModel).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;

  return (
    <div className="screen visible" data-screen-label="Costs">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="hero-h">Costs</h1>
        <button className="btn" onClick={() => setLogOpen(true)}>+ Log Higgsfield work</button>
      </div>
      <div className="costs-top">
        <div className="stat-card glass" style={{ gridColumn: 'auto' }}>
          <span className="panel-label" style={{ margin: 0 }}>Spent today</span>
          <span className="v"><RollingNumber value={S.spentToday}></RollingNumber></span>
          <FuelGauge spent={S.spentToday} cap={D.BUDGET.cap} height={10}></FuelGauge>
          <span className="d mono">{Math.round(S.spentToday / D.BUDGET.cap * 100)}% of {money(D.BUDGET.cap)} shared cap · warn at 75%</span>
        </div>
        <div className="stat-card glass" style={{ gridColumn: 'auto' }}>
          <span className="panel-label" style={{ margin: 0 }}>Left today</span>
          <span className="v" style={{ color: left / D.BUDGET.cap <= (1 - D.BUDGET.warnAt) ? 'var(--warn)' : 'var(--ink)' }}><RollingNumber value={left}></RollingNumber></span>
          <span className="d">Shared across the whole team</span>
        </div>
        <div className="stat-card glass" style={{ gridColumn: 'auto' }}>
          <span className="panel-label" style={{ margin: 0 }}>fal balance</span>
          <span className="v"><RollingNumber value={S.balance}></RollingNumber></span>
          <span className="d">Higgsfield spend logged manually, same ledger</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
        <section className="glass panel">
          <h2 className="panel-label">Today by model</h2>
          <div className="bars">
            {rows.map(([mid, sum]) => (
              <div key={mid} className="bar-row">
                <span style={{ fontWeight: 700 }}>{modelName(mid)}</span>
                <span className="bar"><i style={{ width: Math.max(4, sum / max * 100) + '%' }}></i></span>
                <span className="mono" style={{ textAlign: 'right' }}>{money(sum)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="glass panel">
          <h2 className="panel-label">One ledger — both providers</h2>
          <div className="ledger">
            <div className="ledger-row ledger-head">
              <span>Time</span><span>Item</span><span>Model</span><span>Provider</span><span style={{ textAlign: 'right' }}>Cost</span>
            </div>
            {S.ledger.map(l => (
              <div key={l.id} className="ledger-row">
                <span className="t mono">{l.time}</span>
                <span style={{ fontWeight: 600 }}>{l.title}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{modelName(l.model)}</span>
                <span><ProviderBadge provider={l.provider}></ProviderBadge></span>
                <span className="cost mono">{money(l.cost)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {logOpen && <LogHiggsfield S={S} onClose={() => setLogOpen(false)}></LogHiggsfield>}
    </div>
  );
}

function LogHiggsfield({ S, onClose }){
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('0.90');
  const [kind, setKind] = useState('video');
  const [brand, setBrand] = useState('starxi');
  const ok = title.trim().length > 2 && parseFloat(cost) > 0;
  const submit = () => {
    if (!ok) return;
    S.logExternal({
      title: title.trim(), cost: parseFloat(cost), kind,
      brand, duration: kind === 'video' ? 6 : undefined,
      aspect: kind === 'video' ? '16:9' : '4:5',
      palette: D.BRANDS[brand].palette, seed: Math.floor(Math.random() * 500) + 1,
    });
    onClose();
  };
  return (
    <div className="spend-overlay">
      <div className="spend-dim" onClick={onClose}></div>
      <div className="spend-card glass">
        <span className="spend-label" style={{ color: 'var(--ink-dim)' }}>Log Higgsfield work · joins the shared ledger</span>
        <input className="neg-input" placeholder="What did you make?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={true}></input>
        <div className="knob-row">
          <div className="knob">
            <label>Cost</label>
            <input className="cost-input" value={cost} onChange={(e) => setCost(e.target.value)}></input>
          </div>
          <div className="knob">
            <label>Kind</label>
            <div className="brandlock">
              <button className={kind === 'video' ? 'on' : ''} onClick={() => setKind('video')}>Video</button>
              <button className={kind === 'image' ? 'on' : ''} onClick={() => setKind('image')}>Still</button>
            </div>
          </div>
          <div className="knob">
            <label>Brand</label>
            <div className="brandlock">
              <button className={brand === 'starxi' ? 'on' : ''} onClick={() => setBrand('starxi')}>StarXI</button>
              <button className={brand === 'strikelab' ? 'on' : ''} onClick={() => setBrand('strikelab')}>StrikeLab</button>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok} onClick={submit}>Log to ledger · counts against the cap</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ alignSelf: 'center' }}>Cancel</button>
      </div>
    </div>
  );
}

/* ================= BRIEFS ================= */
function briefEstimate(brief){
  return brief.items.reduce((sum, it) => {
    const e = empById(it.employee);
    return sum + estimateFor({ model: e.model, count: it.count || e.count || 1, duration: it.duration || e.duration || 6, audio: false, fourK: false });
  }, 0);
}

function BriefsScreen({ S }){
  const [pending, setPending] = useState(null);
  const run = (brief) => {
    const est = briefEstimate(brief);
    if (est > D.BUDGET.spendCardThreshold) setPending(brief);
    else S.enqueueBrief(brief);
  };
  return (
    <div className="screen visible" data-screen-label="Briefs">
      <h1 className="hero-h" style={{ marginBottom: 6 }}>Briefs</h1>
      <p style={{ color: 'var(--ink-dim)', marginBottom: 20, fontSize: 13.5 }}>Batch runner — one brief, many jobs, one preflight.</p>
      <div className="brief-grid">
        {D.BRIEFS.map(b => {
          const est = briefEstimate(b);
          const brand = D.BRANDS[b.brand];
          const briefJobs = S.jobs.filter(j => j.briefId === b.id);
          const done = briefJobs.filter(j => j.status === 'ready').length;
          const running = briefJobs.length > 0;
          const left = Math.max(0, D.BUDGET.cap - S.spentToday);
          const blocked = est > left;
          return (
            <div key={b.id} className="brief-card glass" style={{ '--p0': brand.palette[0] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sub-h">{b.title}</span>
                <span className="chip">{brand.name}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', lineHeight: 1.55 }}>{b.desc}</p>
              <div className="brief-items">
                {b.items.map((it, i) => {
                  const e = empById(it.employee);
                  const itEst = estimateFor({ model: e.model, count: it.count || e.count || 1, duration: it.duration || e.duration || 6 });
                  return (
                    <div key={i} className="brief-item">
                      <span>{it.title}</span>
                      <span className="mono">{modelName(e.model)} · {money(itEst)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="hud-divider"></div>
              <div className="hud-row em" style={{ fontFamily: 'var(--mono)' }}>
                <span className="k">Batch estimate</span><span className="mono" style={{ fontSize: 16 }}>{money(est)}</span>
              </div>
              {running ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FuelGauge spent={done} cap={b.items.length} showMark={false}></FuelGauge>
                  <span className="mono" style={{ fontSize: 11, color: done === b.items.length ? 'var(--pass)' : 'var(--ink-dim)' }}>
                    {done === b.items.length ? '✓ DELIVERED — ' + done + '/' + b.items.length : 'RUNNING · ' + done + '/' + b.items.length + ' delivered'}
                  </span>
                </div>
              ) : (
                <button className="btn btn-primary" disabled={blocked} onClick={() => run(b)}>
                  {blocked ? 'EXCEEDS REMAINING BUDGET' : 'Run brief · ' + money(est)}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {pending && (
        <SpendCard
          job={{ title: pending.title, cost: briefEstimate(pending), model: null, type: 'batch', count: pending.items.length, palette: D.BRANDS[pending.brand].palette }}
          S={S} onCancel={() => setPending(null)}
          onCommit={() => { S.enqueueBrief(pending); setPending(null); }}></SpendCard>
      )}
    </div>
  );
}

/* ================= HANDOFF ================= */
function HandoffScreen({ S }){
  const [copied, setCopied] = useState(null);
  const [costs, setCosts] = useState({});
  const copy = (p) => {
    const text = [p.prompt, D.BRANDS[p.brand].lockStyle].join(' — ') + `\n[${p.aspect} · ${p.duration}s]`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(p.id); setTimeout(() => setCopied(null), 1600);
  };
  return (
    <div className="screen visible" data-screen-label="Handoff">
      <h1 className="hero-h" style={{ marginBottom: 6 }}>Handoff</h1>
      <p style={{ color: 'var(--ink-dim)', marginBottom: 20, fontSize: 13.5 }}>Higgsfield paste packages — copy, run on the web, log the result back into the one ledger.</p>
      <div className="handoff-grid">
        {S.packages.map(p => {
          const brand = D.BRANDS[p.brand];
          const logged = p.status === 'logged';
          return (
            <div key={p.id} className="pkg-card glass" style={{ '--p0': p.palette[0], opacity: logged ? 0.65 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sub-h">{p.title}</span>
                {logged ? <span className="chip pass">LOGGED</span> : <span className="chip">{brand.name}</span>}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <RenderArt palette={p.palette} seed={p.seed} style={{ width: 120, borderRadius: 10, aspectRatio: asp(p.aspect), flex: 'none', boxShadow: `0 10px 34px -6px color-mix(in srgb, ${p.palette[0]} calc(var(--glow) * 45%), transparent)` }}></RenderArt>
                <div className="pkg-prompt" style={{ flex: 1 }}>{p.prompt} — {brand.lockStyle}{'\n'}[{p.aspect} · {p.duration}s]</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-sm" onClick={() => copy(p)}>{copied === p.id ? '✓ Copied' : 'Copy package'}</button>
                <span style={{ flex: 1 }}></span>
                {!logged && (
                  <React.Fragment>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>actual cost</span>
                    <input className="cost-input" value={costs[p.id] != null ? costs[p.id] : p.estCost.toFixed(2)}
                      onChange={(e) => setCosts({ ...costs, [p.id]: e.target.value })}></input>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      const c = parseFloat(costs[p.id] != null ? costs[p.id] : p.estCost) || p.estCost;
                      S.logExternal({ title: p.title, cost: c, kind: 'video', brand: p.brand, duration: p.duration, aspect: p.aspect, palette: p.palette, seed: p.seed });
                      S.markPackageLogged(p.id);
                    }}>Log result</button>
                  </React.Fragment>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { CostsScreen, BriefsScreen, HandoffScreen });
})();
