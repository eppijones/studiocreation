// StudioCreation — app shell: global ticker, state store, topbar, tweaks
(function(){
const { useState, useEffect, useRef } = React;
const D = window.SC_DATA;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "glowIntensity": 100,
  "glassOpacity": 72,
  "motionAmplitude": 100,
  "canvasWarmth": 25
}/*EDITMODE-END*/;

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'create',    label: 'Create' },
  { id: 'queue',     label: 'Queue' },
  { id: 'gallery',   label: 'Gallery' },
  { id: 'costs',     label: 'Costs' },
  { id: 'briefs',    label: 'Briefs' },
  { id: 'handoff',   label: 'Handoff' },
];

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('dashboard');
  const [jobs, setJobs] = useState(D.seedJobs);
  const [renders, setRenders] = useState(D.seedRenders);
  const [ledger, setLedger] = useState(D.seedLedger);
  const [spentToday, setSpentToday] = useState(3.00);
  const [balance, setBalance] = useState(23.84);
  const [brandLock, setBrandLock] = useState('starxi');
  const [toasts, setToasts] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  const [galFilter, setGalFilter] = useState('all');
  const [history, setHistory] = useState([]);
  const [freshIds, setFreshIds] = useState(new Set());
  const [packages, setPackages] = useState(D.HANDOFF_PACKAGES);

  const jobsRef = useRef(jobs); jobsRef.current = jobs;
  const spentRef = useRef(spentToday); spentRef.current = spentToday;

  /* ---- tweaks → CSS vars ---- */
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--glow', t.glowIntensity / 100);
    r.setProperty('--glass-a', t.glassOpacity / 100);
    r.setProperty('--motion', t.motionAmplitude / 100);
    r.setProperty('--canvas', mixHex('#06080d', '#0e0b07', t.canvasWarmth / 100));
  }, [t]);

  /* ---- toasts ---- */
  const pushToast = (toast) => {
    const id = uid();
    setToasts(ts => [...ts.slice(-2), { ...toast, id }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 6500);
  };

  /* ---- job completion ---- */
  const handleComplete = (job) => {
    const render = {
      id: uid(), jobId: job.id,
      title: job.title, prompt: job.prompt,
      employee: job.employee, brand: job.brand, model: job.model,
      provider: 'fal', type: job.type, aspect: job.aspect,
      duration: job.duration, count: job.count,
      palette: job.palette, seed: job.seed, cost: job.cost,
      score: null, hero: false, time: nowTime(), day: 'today',
    };
    setRenders(rs => [render, ...rs]);
    setLedger(ls => [{ id: uid(), time: render.time, title: job.title, model: job.model, provider: 'fal', kind: job.type, cost: job.cost }, ...ls]);
    const prevSpent = spentRef.current;
    setSpentToday(s => s + job.cost);
    setBalance(b => b - job.cost);
    setFreshIds(f => new Set([...f, render.id]));
    setTimeout(() => setFreshIds(f => { const n = new Set(f); n.delete(render.id); return n; }), 4500);
    pushToast({ title: 'Render delivered', sub: job.title + ' · banked ' + money(job.cost), render, action: 'Score', renderId: render.id });
    const ratio = (prevSpent + job.cost) / D.BUDGET.cap;
    if (prevSpent / D.BUDGET.cap < D.BUDGET.warnAt && ratio >= D.BUDGET.warnAt) {
      pushToast({ title: '75% of the daily cap', sub: money(D.BUDGET.cap - prevSpent - job.cost) + ' left — spend deliberately' });
    }
  };

  /* ---- global ticker ---- */
  useInterval(() => {
    const prev = jobsRef.current;
    const completed = [];
    let next = prev.map(j => {
      if (j.status !== 'generating') return j;
      const p = j.progress + 3.5 + Math.random() * 8.5;
      if (p >= 100) { completed.push(j); return { ...j, status: 'ready', progress: 100 }; }
      return { ...j, progress: p };
    });
    let genCount = next.filter(j => j.status === 'generating').length;
    next = next.map(j => {
      if (j.status === 'queued' && genCount < 2) { genCount++; return { ...j, status: 'generating', progress: 1 + Math.random() * 4 }; }
      return j;
    });
    const changed = completed.length > 0 || next.some((j, i) => j !== prev[i]);
    if (changed) setJobs(next);
    completed.forEach(handleComplete);
  }, 900);

  /* ---- actions ---- */
  const S = {
    screen, setScreen, jobs, renders, ledger, spentToday, balance,
    brandLock, setBrandLock, reviewId, galFilter, setGalFilter, history, freshIds, packages,
    submitJob: (job) => {
      setJobs(js => [...js, job]);
      pushToast({ title: 'On the line', sub: job.title + ' · est ' + money(job.cost), render: { palette: job.palette, seed: job.seed } });
    },
    cancelJob: (id) => setJobs(js => js.filter(j => j.id !== id)),
    enqueueBrief: (brief) => {
      const brand = D.BRANDS[brief.brand];
      const newJobs = brief.items.map((it, i) => {
        const e = empById(it.employee);
        const cost = estimateFor({ model: e.model, count: it.count || e.count || 1, duration: it.duration || e.duration || 6 });
        return {
          id: uid(), briefId: brief.id, title: it.title,
          prompt: [it.title, e.style, brand.lockStyle].join(' — '),
          employee: e.id, brand: brief.brand, model: e.model,
          type: e.kind, aspect: e.aspect, duration: it.duration || e.duration,
          count: it.count || e.count || 1, cost,
          palette: brand.palette, seed: Math.floor(Math.random() * 500) + 1 + i * 13,
          status: 'queued', progress: 0,
        };
      });
      setJobs(js => [...js, ...newJobs]);
      pushToast({ title: 'Brief on the line', sub: brief.title + ' · ' + newJobs.length + ' jobs queued' });
    },
    scoreRender: (id, score) => {
      setRenders(rs => rs.map(r => r.id === id ? { ...r, score, hero: score >= 8 } : r));
      if (score >= 8) pushToast({ title: 'Hero unlocked', sub: 'Scored ' + score + ' — it shines in the gallery now' });
    },
    logExternal: (e) => {
      const time = nowTime();
      setLedger(ls => [{ id: uid(), time, title: e.title, model: 'higgsfield-web', provider: 'higgsfield', kind: e.kind, cost: e.cost }, ...ls]);
      setRenders(rs => [{
        id: uid(), title: e.title, prompt: 'Logged from Higgsfield web — ' + e.title,
        employee: 'premium-motion-designer', brand: e.brand, model: 'kling-3-pro',
        provider: 'higgsfield', type: e.kind, aspect: e.aspect, duration: e.duration,
        palette: e.palette, seed: e.seed, cost: e.cost, score: null, hero: false, time, day: 'today',
      }, ...rs]);
      setSpentToday(s => s + e.cost);
      pushToast({ title: 'Higgsfield work logged', sub: e.title + ' · ' + money(e.cost) + ' against the shared cap' });
    },
    markPackageLogged: (id) => setPackages(ps => ps.map(p => p.id === id ? { ...p, status: 'logged' } : p)),
    openReview: (id) => { setScreen('gallery'); setReviewId(id); },
    closeReview: () => setReviewId(null),
    pushHistory: (p) => setHistory(h => [p, ...h.filter(x => x !== p)].slice(0, 8)),
    pushToast,
  };

  const liveCount = jobs.filter(j => j.status === 'generating' || j.status === 'queued').length;
  const needsCount = renders.filter(r => r.score == null).length;
  const capRatio = spentToday / D.BUDGET.cap;

  return (
    <React.Fragment>
      <header className="topbar glass" data-screen-label="Topbar">
        <span className="wordmark">STUDIO<em>CREATION</em></span>
        <nav className="nav">
          {NAV.map(n => (
            <button key={n.id} className={'nav-tab' + (screen === n.id ? ' active' : '')} onClick={() => { setScreen(n.id); if (n.id !== 'gallery') setReviewId(null); }}>
              {n.label}
              {n.id === 'queue' && liveCount > 0 && <span className="nav-badge live">{liveCount}</span>}
              {n.id === 'gallery' && needsCount > 0 && <span className="nav-badge">{needsCount}</span>}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <div className="brandlock">
            {Object.values(D.BRANDS).map(b => (
              <button key={b.id} className={brandLock === b.id ? 'on' : ''} onClick={() => setBrandLock(brandLock === b.id ? null : b.id)}>{b.name}</button>
            ))}
          </div>
          <div className="topbar-budget">
            <div className="row mono"><span>today</span><span style={{ color: capRatio >= D.BUDGET.warnAt ? 'var(--warn)' : 'var(--ink-dim)' }}>{money(spentToday)} / {money(D.BUDGET.cap)}</span></div>
            <FuelGauge spent={spentToday} cap={D.BUDGET.cap} height={5}></FuelGauge>
          </div>
          <div className="topbar-balance mono">
            <small>BALANCE</small>
            <RollingNumber value={balance}></RollingNumber>
          </div>
        </div>
      </header>

      <main className="main">
        <div style={{ display: screen === 'dashboard' ? 'block' : 'none' }}>{screen === 'dashboard' && <Dashboard S={S}></Dashboard>}</div>
        <div style={{ display: screen === 'create' ? 'block' : 'none' }}><CreateScreen S={S}></CreateScreen></div>
        <div style={{ display: screen === 'queue' ? 'block' : 'none' }}>{screen === 'queue' && <QueueScreen S={S}></QueueScreen>}</div>
        <div style={{ display: screen === 'gallery' ? 'block' : 'none' }}>{screen === 'gallery' && <GalleryScreen S={S}></GalleryScreen>}</div>
        <div style={{ display: screen === 'costs' ? 'block' : 'none' }}>{screen === 'costs' && <CostsScreen S={S}></CostsScreen>}</div>
        <div style={{ display: screen === 'briefs' ? 'block' : 'none' }}>{screen === 'briefs' && <BriefsScreen S={S}></BriefsScreen>}</div>
        <div style={{ display: screen === 'handoff' ? 'block' : 'none' }}>{screen === 'handoff' && <HandoffScreen S={S}></HandoffScreen>}</div>
      </main>

      <ToastStack toasts={toasts}
        onDismiss={(id) => setToasts(ts => ts.filter(x => x.id !== id))}
        onAction={(toast) => { setToasts(ts => ts.filter(x => x.id !== toast.id)); if (toast.renderId) S.openReview(toast.renderId); }}></ToastStack>

      <TweaksPanel>
        <TweakSection label="Atmosphere"></TweakSection>
        <TweakSlider label="Glow intensity" value={t.glowIntensity} min={0} max={200} step={5} unit="%" onChange={(v) => setTweak('glowIntensity', v)}></TweakSlider>
        <TweakSlider label="Glass opacity" value={t.glassOpacity} min={35} max={95} step={1} unit="%" onChange={(v) => setTweak('glassOpacity', v)}></TweakSlider>
        <TweakSlider label="Canvas warmth" value={t.canvasWarmth} min={0} max={100} step={5} unit="" onChange={(v) => setTweak('canvasWarmth', v)}></TweakSlider>
        <TweakSection label="Motion"></TweakSection>
        <TweakSlider label="Motion amplitude" value={t.motionAmplitude} min={0} max={200} step={10} unit="%" onChange={(v) => setTweak('motionAmplitude', v)}></TweakSlider>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App></App>);
})();
