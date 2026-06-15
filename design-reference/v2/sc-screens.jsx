// StudioCreation — Dashboard, Queue, Gallery + Review overlay
(function(){
const { useState, useEffect } = React;
const D = window.SC_DATA;

/* ================= DASHBOARD ================= */
function Dashboard({ S }){
  const madeToday = S.renders.filter(r => r.day === 'today').length;
  const needsScore = S.renders.filter(r => r.score == null);
  const live = S.jobs.filter(j => j.status === 'generating' || j.status === 'queued');
  const left = Math.max(0, D.BUDGET.cap - S.spentToday);
  const recent = S.renders.filter(r => r.day === 'today').slice(0, 5);
  const capRatio = S.spentToday / D.BUDGET.cap;

  const nexts = [];
  if (needsScore.length) nexts.push({ t: `Score ${needsScore.length} render${needsScore.length > 1 ? 's' : ''}`, s: 'The quality gate is holding them', go: () => { S.setScreen('gallery'); S.setGalFilter('needs'); } });
  nexts.push({ t: 'Run “Matchday teasers”', s: '4 social verticals · est $1.98', go: () => S.setScreen('briefs') });
  nexts.push({ t: `${D.HANDOFF_PACKAGES.filter(p => p.status === 'ready').length} Higgsfield packages ready`, s: 'Paste, run, log the result back', go: () => S.setScreen('handoff') });
  if (capRatio >= D.BUDGET.warnAt) nexts.push({ t: 'Daily budget past 75%', s: 'Route remaining jobs to schnell', go: () => S.setScreen('costs') });

  return (
    <div className="screen visible" data-screen-label="Dashboard">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="hero-h">The floor is live.</h1>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.1em', whiteSpace: 'nowrap' }}>THU JUN 12 · SHIFT 2</span>
      </div>
      <div className="dash-grid">
        <div className="stat-card glass">
          <span className="panel-label" style={{ margin: 0 }}>Made today</span>
          <span className="v mono">{madeToday}<span className="unit"> renders</span></span>
          <span className="d">{S.renders.filter(r => r.day === 'today' && r.hero).length} hero-eligible</span>
        </div>
        <div className="stat-card glass">
          <span className="panel-label" style={{ margin: 0 }}>Spent today</span>
          <span className="v"><RollingNumber value={S.spentToday}></RollingNumber></span>
          <FuelGauge spent={S.spentToday} cap={D.BUDGET.cap}></FuelGauge>
        </div>
        <div className="stat-card glass">
          <span className="panel-label" style={{ margin: 0 }}>Budget left</span>
          <span className="v" style={{ color: capRatio >= 1 ? 'var(--danger)' : capRatio >= D.BUDGET.warnAt ? 'var(--warn)' : 'var(--ink)' }}>
            <RollingNumber value={left}></RollingNumber>
          </span>
          <span className="d mono">of {money(D.BUDGET.cap)} shared daily cap</span>
        </div>
        <div className="stat-card glass" style={{ cursor: 'pointer' }} onClick={() => { S.setScreen('gallery'); S.setGalFilter('needs'); }}>
          <span className="panel-label" style={{ margin: 0 }}>Needs scoring</span>
          <span className="v mono" style={{ color: needsScore.length ? 'var(--warn)' : 'var(--ink)' }}>{needsScore.length}</span>
          <span className="d">{needsScore.length ? 'Tap to open the gate' : 'Gate is clear'}</span>
        </div>

        <div className="dash-line glass panel">
          <h2 className="panel-label">On the line — {live.length} job{live.length === 1 ? '' : 's'}</h2>
          <div className="line-jobs">
            {live.length === 0 && <div className="empty-note">Line is idle. Send something from Create.</div>}
            {live.map(j => <JobRow key={j.id} job={j} S={S}></JobRow>)}
          </div>
        </div>

        <div className="dash-next glass panel">
          <h2 className="panel-label">What next</h2>
          {nexts.map((n, i) => (
            <div key={i} className="next-item" onClick={n.go}>
              <div>
                <div className="t">{n.t}</div>
                <div className="s">{n.s}</div>
              </div>
              <span className="arrow">→</span>
            </div>
          ))}
        </div>

        <div className="dash-wide glass panel">
          <h2 className="panel-label">Fresh from the queue</h2>
          <div className="strip">
            {recent.map(r => (
              <RenderTile key={r.id} render={r} fresh={S.freshIds.has(r.id)} style={{ aspectRatio: 'auto', height: 200 }} onClick={() => S.openReview(r.id)}></RenderTile>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= JOB ROW ================= */
function JobRow({ job: j, S }){
  const emp = empById(j.employee);
  const brand = D.BRANDS[j.brand];
  const gen = j.status === 'generating';
  return (
    <div className="job-row" style={{ '--p0': j.palette[0], '--p1': j.palette[1] }}>
      <div className="job-art">
        <RenderArt palette={j.palette} seed={j.seed} style={{ position: 'absolute', inset: 0 }}></RenderArt>
        <div className="veil" style={{ opacity: gen ? Math.max(0, 1 - j.progress / 100) : 0.8 }}></div>
      </div>
      <div className="job-main">
        <div className="job-title">{j.title}</div>
        <div className="job-sub mono">
          {emp.persona} · {modelName(j.model)} · {j.aspect}{j.type === 'video' ? ` · ${j.duration}s` : j.count > 1 ? ` · ×${j.count}` : ''}{j.audio ? ' · audio' : ''} · {brand.name}
        </div>
        {gen && <div className="job-progress"><div className="fill" style={{ width: j.progress + '%' }}></div></div>}
      </div>
      <div className="job-right">
        <span className={'job-state mono' + (gen ? ' gen' : '')}>{gen ? Math.floor(j.progress) + '%' : 'QUEUED'}</span>
        <span className="job-cost mono">{money(j.cost)}</span>
        {gen
          ? <span className="job-state">banks on completion</span>          : <button className="btn btn-ghost btn-sm" onClick={() => S.cancelJob(j.id)}>Cancel</button>}
      </div>
    </div>
  );
}

/* ================= QUEUE ================= */
function QueueScreen({ S }){
  const gen = S.jobs.filter(j => j.status === 'generating');
  const queued = S.jobs.filter(j => j.status === 'queued');
  const doneJobs = S.jobs.filter(j => j.status === 'ready').slice(-6).reverse();
  return (
    <div className="screen visible" data-screen-label="Queue">
      <h1 className="hero-h" style={{ marginBottom: 20 }}>Queue</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section className="glass panel">
          <h2 className="panel-label">Generating — {gen.length} of 2 slots</h2>
          <div className="line-jobs">
            {gen.length === 0 && <div className="empty-note">Both slots open.</div>}
            {gen.map(j => <JobRow key={j.id} job={j} S={S}></JobRow>)}
          </div>
        </section>
        <section className="glass panel">
          <h2 className="panel-label">Waiting — {queued.length}</h2>
          <div className="line-jobs">
            {queued.length === 0 && <div className="empty-note">Nothing waiting.</div>}
            {queued.map((j, i) => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="mono" style={{ width: 26, color: 'var(--ink-faint)', fontSize: 11, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1 }}><JobRow job={j} S={S}></JobRow></div>
              </div>
            ))}
          </div>
        </section>
        <section className="glass panel">
          <h2 className="panel-label">Recently delivered</h2>
          {doneJobs.length === 0
            ? <div className="empty-note">Completed jobs land in the Gallery.</div>
            : (
              <div className="line-jobs">
                {doneJobs.map(j => (
                  <div key={j.id} className="job-row" style={{ '--p0': j.palette[0] }}>
                    <div className="job-art"><RenderArt palette={j.palette} seed={j.seed} style={{ position: 'absolute', inset: 0 }}></RenderArt></div>
                    <div className="job-main">
                      <div className="job-title">{j.title}</div>
                      <div className="job-sub mono">{modelName(j.model)} · banked {money(j.cost)}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const r = S.renders.find(x => x.jobId === j.id); if (r) S.openReview(r.id); }}>In gallery →</button>
                  </div>
                ))}
              </div>
            )}
        </section>
      </div>
    </div>
  );
}

/* ================= GALLERY ================= */
const GAL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'needs', label: 'Needs scoring' },
  { id: 'hero', label: 'Heroes' },
  { id: 'starxi', label: 'StarXI' },
  { id: 'strikelab', label: 'StrikeLab' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Stills' },
];

function GalleryScreen({ S }){
  const f = S.galFilter;
  const list = S.renders.filter(r => {
    if (f === 'needs') return r.score == null;
    if (f === 'hero') return r.hero;
    if (f === 'starxi' || f === 'strikelab') return r.brand === f;
    if (f === 'video' || f === 'image') return r.type === f;
    return true;
  });
  const needsCount = S.renders.filter(r => r.score == null).length;
  return (
    <div className="screen visible" data-screen-label="Gallery">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="hero-h">Gallery</h1>
        {needsCount > 0 && <span className="chip needs">{needsCount} AWAITING THE GATE</span>}
      </div>
      <div className="gal-filters">
        {GAL_FILTERS.map(x => (
          <button key={x.id} className={'gal-filter' + (f === x.id ? ' on' : '')} onClick={() => S.setGalFilter(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="gal-grid">
        {list.map(r => (
          <RenderTile key={r.id} render={r} fresh={S.freshIds.has(r.id)}
            onClick={() => S.openReview(r.id)}></RenderTile>
        ))}
        {list.length === 0 && <div className="empty-note" style={{ gridColumn: '1 / -1' }}>Nothing here under this filter.</div>}
      </div>
      {S.reviewId && <ReviewOverlay S={S}></ReviewOverlay>}
    </div>
  );
}

/* ================= REVIEW OVERLAY ================= */
function ReviewOverlay({ S }){
  const list = S.renders;
  const idx = list.findIndex(r => r.id === S.reviewId);
  const r = list[idx];
  const [bloom, setBloom] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') S.closeReview();
      else if (e.key === 'ArrowRight' && idx < list.length - 1) S.openReview(list[idx + 1].id);
      else if (e.key === 'ArrowLeft' && idx > 0) S.openReview(list[idx - 1].id);
      else if (/^[0-9]$/.test(e.key)) score(parseInt(e.key, 10));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!r) return null;
  const emp = empById(r.employee);
  const brand = D.BRANDS[r.brand];

  const score = (n) => {
    const wasHero = r.hero;
    S.scoreRender(r.id, n);
    if (n >= 8 && !wasHero) { setBloom(true); setTimeout(() => setBloom(false), 1100); }
  };

  return (
    <div className="overlay">
      <div className="overlay-dim" onClick={S.closeReview}></div>
      <div className="review-card glass" style={{ '--p0': r.palette[0] }}>
        <div className={'review-art' + (bloom ? ' bloom' : '')}>
          <RenderArt palette={r.palette} seed={r.seed} style={{ position: 'absolute', inset: 0 }}></RenderArt>
          {r.type === 'video' && <span className="tile-dur mono" style={{ top: 14, right: 14 }}>{r.duration}s</span>}
          {r.hero && <span className="tile-herobadge" style={{ top: 14, left: 14 }}>HERO</span>}
          {idx > 0 && <button className="review-nav" style={{ left: 14 }} onClick={() => S.openReview(list[idx - 1].id)}>←</button>}
          {idx < list.length - 1 && <button className="review-nav" style={{ right: 14 }} onClick={() => S.openReview(list[idx + 1].id)}>→</button>}
        </div>
        <div className="review-side">
          <div>
            <div className="sub-h" style={{ marginBottom: 4 }}>{r.title}</div>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)', letterSpacing: '.08em' }}>{r.id.toUpperCase()} · {r.time} {r.day === 'yesterday' ? '· YESTERDAY' : ''}</span>
          </div>
          <div className="review-prompt">{r.prompt}</div>
          <div className="meta-rows">
            <div className="meta-row"><span className="k">Employee</span><span className="v2"><Avatar employee={emp} size={18}></Avatar>{emp.persona} · {emp.role}</span></div>
            <div className="meta-row"><span className="k">Model</span><span className="v2 mono">{modelName(r.model)}</span></div>
            <div className="meta-row"><span className="k">Brand</span><span className="v2">{brand.name}</span></div>
            <div className="meta-row"><span className="k">Provider</span><span className="v2"><ProviderBadge provider={r.provider}></ProviderBadge></span></div>
            <div className="meta-row"><span className="k">Cost</span><span className="v2 mono">{money(r.cost)}</span></div>
            <div className="meta-row"><span className="k">Frame</span><span className="v2 mono">{r.aspect}{r.type === 'video' ? ' · ' + r.duration + 's' : r.count > 1 ? ' · ×' + r.count : ''}</span></div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r.hero && <div className="hero-banner">★ HERO — scored {r.score} · shines in the gallery</div>}
            <div>
              <div className="panel-label" style={{ marginBottom: 8 }}>Quality gate — one tap, 8+ passes</div>
              <ScoreStrip value={r.score} onScore={score}></ScoreStrip>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={S.closeReview} style={{ alignSelf: 'flex-end' }}>Close · esc</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, QueueScreen, GalleryScreen, JobRow });
})();
