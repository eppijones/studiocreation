// StudioCreation — Create screen (composer + preflight HUD + spend card)
(function(){
const { useState, useMemo, useEffect, useRef } = React;
const D = window.SC_DATA;

function estimateFor({ model, count, duration, audio, fourK }){
  const m = D.MODELS[model];
  if (!m) return 0;
  let per = m.kind === 'video' ? m.unit * duration : m.unit;
  if (m.kind === 'video' && audio && m.audioUnit) per += m.audioUnit * duration;
  let est = per * count;
  if (fourK) est *= 2;
  return Math.round(est * 1000) / 1000;
}

function CreateScreen({ S }){
  const [ct, setCt] = useState('social-vertical');
  const [empId, setEmpId] = useState('social-cutdowns');
  const [model, setModel] = useState('seedance-1');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(1);
  const [duration, setDuration] = useState(8);
  const [audio, setAudio] = useState(false);
  const [fourK, setFourK] = useState(false);
  const [negative, setNegative] = useState('');
  const [more, setMore] = useState(false);
  const [improve, setImprove] = useState(null);   // null | string[]
  const [histOpen, setHistOpen] = useState(false);
  const [pending, setPending] = useState(null);   // jobspec awaiting spend card

  const emp = empById(empId);
  const m = D.MODELS[model];
  const brand = S.brandLock ? D.BRANDS[S.brandLock] : null;
  const isVideo = m.kind === 'video';

  const pickType = (t) => {
    setCt(t.id);
    const e = empById(t.employee);
    setEmpId(e.id); setModel(e.model);
    setCount(e.count || 1); setDuration(e.duration || 6);
    setAudio(false); setFourK(false); setImprove(null);
  };
  const pickEmp = (e) => {
    setEmpId(e.id); setModel(e.model);
    setCount(e.count || 1); if (e.duration) setDuration(e.duration);
    setAudio(false);
  };

  const est = estimateFor({ model, count, duration, audio, fourK });
  const left = Math.max(0, D.BUDGET.cap - S.spentToday);
  const after = left - est;
  const overCap = est > left;
  const ratioAfter = (S.spentToday + est) / D.BUDGET.cap;
  const canSubmit = prompt.trim().length > 2 && !overCap;

  const finalParts = {
    base: prompt.trim() || '…your prompt…',
    emp: emp.style,
    brand: brand ? brand.lockStyle : null,
    neg: negative.trim() || null,
  };

  const buildJob = () => ({
    id: uid(), title: prompt.trim().slice(0, 52) || 'Untitled',
    prompt: [finalParts.base, finalParts.emp, finalParts.brand].filter(Boolean).join(' — '),
    employee: empId, brand: S.brandLock || 'starxi', model,
    type: m.kind, aspect: emp.aspect, duration: isVideo ? duration : undefined,
    count, audio: audio && !!m.audioUnit, fourK,
    cost: est, palette: brand ? brand.palette : emp.palette,
    seed: Math.floor(Math.random() * 500) + 1, status: 'queued', progress: 0,
  });

  const submit = () => {
    if (!canSubmit) return;
    const job = buildJob();
    if (est > D.BUDGET.spendCardThreshold) { setPending(job); return; }
    S.submitJob(job);
    S.pushHistory(prompt.trim());
    setPrompt(''); setImprove(null);
  };
  const commitPending = () => {
    S.submitJob(pending);
    S.pushHistory(prompt.trim());
    setPending(null); setPrompt(''); setImprove(null);
  };

  return (
    <div className="screen visible" data-screen-label="Create">
      <h1 className="hero-h" style={{ marginBottom: 20 }}>What are we making?</h1>
      <div className="create-grid">
        <div className="create-main">
          <section className="glass panel">
            <div className="ct-grid">
              {D.CONTENT_TYPES.map(t => {
                const e = empById(t.employee);
                return (
                  <button key={t.id} className={'ct-card' + (ct === t.id ? ' on' : '')} onClick={() => pickType(t)}>
                    <span className="ct-glyph" style={{ background: artBackground(e.palette, t.id.length * 7) }}></span>
                    <span className="ct-name">{t.name}</span>
                    <span className="ct-sub">{t.sub}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass panel">
            <h2 className="panel-label">Who's on it</h2>
            <div className="emp-row">
              {D.EMPLOYEES.map(e => (
                <button key={e.id} className={'emp-chip' + (empId === e.id ? ' on' : '')} onClick={() => pickEmp(e)} title={e.style}>
                  <Avatar employee={e} size={24}></Avatar>{e.persona}
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)' }}>{e.id}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <span className="panel-label" style={{ margin: 0 }}>Brand lock</span>
              <div className="brandlock">
                {Object.values(D.BRANDS).map(b => (
                  <button key={b.id} className={S.brandLock === b.id ? 'on' : ''} onClick={() => S.setBrandLock(b.id)}>{b.name}</button>
                ))}
                <button className={!S.brandLock ? 'on' : ''} onClick={() => S.setBrandLock(null)}>None</button>
              </div>
              {brand && <span className="chip">{brand.name} style appended</span>}
            </div>
          </section>

          <section className="glass panel">
            <textarea className="prompt-box" placeholder="Describe the shot. The employee and brand styles get appended automatically."
              value={prompt} onChange={(e) => setPrompt(e.target.value)}></textarea>
            <div className="composer-tools">
              <button className="btn btn-sm" onClick={() => setImprove(improve ? null : D.improvePrompt(prompt.trim() || 'untitled shot'))} disabled={!prompt.trim()}
                style={{ opacity: prompt.trim() ? 1 : 0.4 }}>✦ Improve</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setHistOpen(!histOpen)}>History ({S.history.length})</button>
              <span style={{ flex: 1 }}></span>
              <button className="btn btn-ghost btn-sm" onClick={() => setMore(!more)}>{more ? 'Less' : 'More'}</button>
            </div>
            {improve && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {improve.map((rw, i) => (
                  <button key={i} className="rewrite" onClick={() => { setPrompt(rw); setImprove(null); }}>
                    <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)', letterSpacing: '.12em' }}>REWRITE {i + 1} · </span>{rw}
                  </button>
                ))}
              </div>
            )}
            {histOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {S.history.length === 0 && <div className="empty-note" style={{ padding: 14 }}>No prompts sent yet this shift.</div>}
                {S.history.slice(0, 5).map((h, i) => (
                  <button key={i} className="rewrite" onClick={() => { setPrompt(h); setHistOpen(false); }}>{h}</button>
                ))}
              </div>
            )}
            {more && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <div className="knob-row">
                  {isVideo && m.audioUnit && (
                    <button className={'toggle' + (audio ? ' on' : '')} onClick={() => setAudio(!audio)}>
                      <span className="tk"></span>Native audio <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>+$0.02/s</span>
                    </button>
                  )}
                  <button className={'toggle' + (fourK ? ' on' : '')} onClick={() => setFourK(!fourK)}>
                    <span className="tk"></span>4K master <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>×2.0</span>
                  </button>
                </div>
                <input className="neg-input" placeholder="Negative prompt — what to keep out of frame"
                  value={negative} onChange={(e) => setNegative(e.target.value)}></input>
              </div>
            )}
          </section>

          <section className="glass panel">
            <h2 className="panel-label">Model router — every selection shows unit price</h2>
            <div className="model-row">
              {Object.values(D.MODELS).filter(x => x.kind === m.kind).map(x => (
                <button key={x.id} className={'model-chip' + (model === x.id ? ' on' : '')} onClick={() => setModel(x.id)}>
                  <span className="n">{x.name}</span>
                  <span className="p">{x.unitLabel}{x.audioUnit ? ' +$0.02/s audio' : ''}</span>
                </button>
              ))}
            </div>
            <div className="knob-row" style={{ marginTop: 16 }}>
              <div className="knob">
                <label>Count</label>
                <div className="stepper">
                  <button onClick={() => setCount(Math.max(1, count - 1))}>−</button>
                  <span className="val">{count}</span>
                  <button onClick={() => setCount(Math.min(12, count + 1))}>+</button>
                </div>
              </div>
              {isVideo && (
                <div className="knob">
                  <label>Duration — bills per second</label>
                  <div className="dur-slider">
                    <input type="range" min="2" max="12" step="1" value={duration} onChange={(e) => setDuration(+e.target.value)}></input>
                    <span className="mono" style={{ fontSize: 13 }}>{duration}s</span>
                  </div>
                </div>
              )}
              <div className="knob">
                <label>Frame</label>
                <span className="mono" style={{ fontSize: 13, padding: '7px 0' }}>{emp.aspect}</span>
              </div>
            </div>
          </section>

          <section className="glass panel" style={{ '--p0': emp.palette[0] }}>
            <h2 className="panel-label">Final prompt — exactly what gets sent</h2>
            <div className="final-prompt">
              <span className="fp-base">{finalParts.base}</span>
              <span className="fp-emp"> — {finalParts.emp}</span>
              {finalParts.brand && <span className="fp-brand"> — {finalParts.brand}</span>}
              {finalParts.neg && <span style={{ color: 'var(--danger)' }}> — avoid: {finalParts.neg}</span>}
            </div>
          </section>
        </div>

        <aside className="preflight glass" data-comment-anchor="preflight-hud">
          <h2 className="panel-label" style={{ margin: 0 }}>Pre-flight</h2>
          <div className="hud-rows">
            <div className="hud-row"><span className="k">Unit</span><span>{m.unitLabel}</span></div>
            <div className="hud-row"><span className="k">Count</span><span>×{count}</span></div>
            {isVideo && <div className="hud-row"><span className="k">Duration</span><span>{duration}s</span></div>}
            {isVideo && audio && m.audioUnit && <div className="hud-row"><span className="k">Audio</span><span>+$0.02/s</span></div>}
            {fourK && <div className="hud-row"><span className="k">4K master</span><span>×2.0</span></div>}
            <div className="hud-divider"></div>
            <div className="hud-estimate">
              <span className="panel-label" style={{ margin: 0 }}>Estimate</span>
              <RollingNumber className="v" value={est}></RollingNumber>
            </div>
          </div>
          <FuelGauge spent={S.spentToday} cap={D.BUDGET.cap} projected={est} height={10}></FuelGauge>
          <div className="hud-rows">
            <div className="hud-row"><span className="k">Spent today</span><RollingNumber value={S.spentToday}></RollingNumber></div>
            <div className="hud-row em"><span className="k">After this job</span><span style={{ color: overCap ? 'var(--danger)' : ratioAfter >= D.BUDGET.warnAt ? 'var(--warn)' : 'var(--ink)' }}>{money(after)}</span></div>
            <div className="hud-row"><span className="k">Daily cap</span><span>{money(D.BUDGET.cap)}</span></div>
            <div className="hud-row"><span className="k">Account balance</span><RollingNumber value={S.balance}></RollingNumber></div>
          </div>
          {overCap && <div className="hud-warning danger">▲ Exceeds today's remaining budget</div>}
          {!overCap && ratioAfter >= D.BUDGET.warnAt && <div className="hud-warning warn">▲ This job takes you past 75% of the daily cap</div>}
          {!overCap && est > D.BUDGET.spendCardThreshold && <div className="hud-warning warn">$ Over $1.25 — explicit confirm required</div>}
          <button className="btn btn-primary" style={{ width: '100%', padding: 14 }} disabled={!canSubmit} onClick={submit}>
            {overCap ? 'CAP REACHED' : 'Send to the line · ' + money(est)}
          </button>
        </aside>
      </div>
      {pending && <SpendCard job={pending} S={S} onCancel={() => setPending(null)} onCommit={commitPending}></SpendCard>}
    </div>
  );
}

/* ================= SPEND CARD ================= */
function SpendCard({ job, S, onCancel, onCommit }){
  const [fill, setFill] = useState(0);
  const raf = useRef(0); const start = useRef(0);
  const HOLD_MS = 900;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf.current); };
  }, []);

  const begin = () => {
    start.current = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start.current) / HOLD_MS);
      setFill(k);
      if (k >= 1) { onCommit(); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const end = () => { cancelAnimationFrame(raf.current); setFill(0); };

  const after = D.BUDGET.cap - S.spentToday - job.cost;
  return (
    <div className="spend-overlay" data-screen-label="Spend card">
      <div className="spend-dim" onClick={onCancel}></div>
      <div className="spend-card glass" style={{ '--p0': job.palette[0] }}>
        <span className="spend-label">Spend confirmation · over $1.25</span>
        <div className="spend-amount mono">{money(job.cost)}</div>
        <div className="hud-rows">
          <div className="hud-row"><span className="k">Job</span><span>{job.title}</span></div>
          {job.model && <div className="hud-row"><span className="k">Model</span><span>{modelName(job.model)}</span></div>}
          {job.type === 'video' && <div className="hud-row"><span className="k">Duration</span><span>{job.duration}s{job.audio ? ' + audio' : ''}</span></div>}
          {job.count > 1 && <div className="hud-row"><span className="k">{job.type === 'batch' ? 'Jobs' : 'Count'}</span><span>×{job.count}</span></div>}
          <div className="hud-divider"></div>
          <div className="hud-row"><span className="k">Budget after</span><span style={{ color: after < 0 ? 'var(--danger)' : (S.spentToday + job.cost) / D.BUDGET.cap >= D.BUDGET.warnAt ? 'var(--warn)' : 'var(--ink)' }}>{money(after)}</span></div>
          <div className="hud-row"><span className="k">Balance after</span><span>{money(S.balance - job.cost)}</span></div>
        </div>
        <FuelGauge spent={S.spentToday} cap={D.BUDGET.cap} projected={job.cost} height={10}></FuelGauge>
        <button className="hold-btn" onPointerDown={begin} onPointerUp={end} onPointerLeave={end}>
          <span className="hold-fill" style={{ width: (fill * 100) + '%' }}></span>
          <span className="hold-label">{fill > 0 ? 'KEEP HOLDING…' : 'HOLD TO COMMIT ' + money(job.cost)}</span>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ alignSelf: 'center' }}>Back off · esc</button>
      </div>
    </div>
  );
}

Object.assign(window, { CreateScreen, SpendCard, estimateFor });
})();
