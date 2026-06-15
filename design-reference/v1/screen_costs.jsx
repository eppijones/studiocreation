/* ============================================================
   StudioCreation — Costs (ledger + calculator)
   ============================================================ */

function MiniCalc() {
  const s = window.useStudio();
  const D = s.D;
  const [model, setModel] = React.useState("kling-3-pro");
  const [count, setCount] = React.useState(1);
  const [dur, setDur] = React.useState(6);
  const [audio, setAudio] = React.useState(false);
  const m = D.MODEL[model];
  const isVideo = m.type === "video";
  const est = window.estimate({ model, count, dur: isVideo ? dur : 0, audio });
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-hd row gap2"><window.UIIcon name="gauge" size={15} style={{ color: "var(--gold)" }} /><span className="t-h3">What-if calculator</span></div>
      <div className="col gap3" style={{ padding: 16 }}>
        <div className="col gap2">
          <span className="t-label">Model</span>
          <select className="input" value={model} onChange={e => setModel(e.target.value)} style={{ cursor: "pointer" }}>
            {D.MODELS.map(mm => <option key={mm.id} value={mm.id}>{mm.name} — ${mm.type === "video" ? mm.price.toFixed(2) + "/s" : mm.price.toFixed(3) + "/img"}</option>)}
          </select>
        </div>
        {isVideo ? (
          <div className="col gap2">
            <div className="between"><span className="t-sm">Duration</span><span className="mono t-sm" style={{ color: "var(--gold-hi)" }}>{dur}s</span></div>
            <input type="range" min="2" max="12" value={dur} onChange={e => setDur(+e.target.value)} className="rng" />
            <label className="row gap2 t-sm" style={{ cursor: "pointer", marginTop: 2 }}>
              <input type="checkbox" checked={audio} onChange={e => setAudio(e.target.checked)} className="sw" />Native audio</label>
          </div>
        ) : (
          <div className="col gap2">
            <div className="between"><span className="t-sm">Count</span><span className="mono t-sm" style={{ color: "var(--gold-hi)" }}>{count}</span></div>
            <input type="range" min="1" max="20" value={count} onChange={e => setCount(+e.target.value)} className="rng" />
          </div>
        )}
        <div className="hr" />
        <div className="between" style={{ alignItems: "baseline" }}>
          <span className="t-sm" style={{ color: "var(--tx-3)" }}>Estimate</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 700, color: est.total > s.budget.spendCardThreshold ? "var(--gold-hi)" : "var(--tx-1)" }}>${est.total.toFixed(2)}</span>
        </div>
        <span className="t-xs" style={{ color: "var(--tx-3)" }}>
          {est.total > s.budget.spendCardThreshold ? "Would need a spend-card confirm." : "Under auto-approve limit."}
          {" "}≈ {Math.floor(s.budget.remaining / est.total) || 0} more like this today.
        </span>
      </div>
    </div>
  );
}

function CostsScreen() {
  const s = window.useStudio();
  const D = s.D;
  const ledger = s.ledger;
  // spend by provider
  const byProv = { fal: 0, higgs: 0 };
  const byModel = {};
  ledger.forEach(l => {
    byProv[l.provider] = (byProv[l.provider] || 0) + l.cost;
    byModel[l.model] = (byModel[l.model] || 0) + l.cost;
  });
  const modelRows = Object.entries(byModel).map(([id, v]) => ({ id, name: D.MODEL[id]?.name || id, v })).sort((a, b) => b.v - a.v);
  const maxModel = Math.max(...modelRows.map(r => r.v), 0.01);
  const total = s.budget.usedToday;

  return (
    <div className="screen-pad" style={{ maxWidth: 1200 }}>
      <div className="screen-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="t-label" style={{ color: "var(--gold)" }}>Costs · Ledger</span>
          <h1 className="t-h1">${total.toFixed(2)} spent today</h1>
          <span className="t-body">${s.budget.remaining.toFixed(2)} of ${s.budget.dailyCap.toFixed(2)} cap left · {ledger.length} jobs logged</span>
        </div>
        <window.Seg value="today" onChange={() => {}} options={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
        {/* LEFT */}
        <div className="col gap5">
          {/* summary cards */}
          <div className="row gap4">
            <div className="card card-pad grow gap3">
              <span className="t-label">Daily budget</span>
              <window.Gauge used={total} cap={s.budget.dailyCap} height={10} />
              <div className="between">
                <span className="mono t-sm" style={{ color: "var(--gold-hi)" }}>${total.toFixed(2)} used</span>
                <span className="mono t-sm" style={{ color: "var(--tx-2)" }}>${s.budget.remaining.toFixed(2)} left</span>
              </div>
            </div>
            <div className="card card-pad grow gap3">
              <span className="t-label">By provider</span>
              {[["fal", "var(--fal)"], ["higgs", "var(--higgs)"]].map(([p, c]) => (
                <div key={p} className="col gap1">
                  <div className="between"><span className="t-xs row gap2"><span style={{ width: 7, height: 7, borderRadius: 2, background: c }} />{p === "fal" ? "fal.ai" : "Higgsfield"}</span><span className="mono t-sm">${byProv[p].toFixed(2)}</span></div>
                  <div className="bar" style={{ height: 5 }}><i style={{ width: (byProv[p] / (total || 1) * 100) + "%", background: c }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* by model */}
          <div className="card card-pad gap4">
            <span className="t-h3">Spend by model</span>
            <div className="col gap3">
              {modelRows.map(r => (
                <div key={r.id} className="col gap1">
                  <div className="between">
                    <span className="row gap2 t-sm"><window.Prov id={D.MODEL[r.id]?.provider} />{r.name}</span>
                    <span className="mono t-sm" style={{ color: "var(--tx-1)" }}>${r.v.toFixed(3)}</span>
                  </div>
                  <div className="bar" style={{ height: 6 }}><i style={{ width: (r.v / maxModel * 100) + "%" }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* ledger */}
          <div className="card">
            <div className="card-hd between">
              <span className="t-h3">Ledger</span>
              <window.Btn size="sm" variant="ghost" icon="download">Export CSV</window.Btn>
            </div>
            <div className="ledger">
              <div className="lrow lhead">
                <span>Time</span><span>Job</span><span>Op</span><span>Score</span><span style={{ textAlign: "right" }}>Cost</span>
              </div>
              {ledger.map(l => (
                <div key={l.id} className="lrow">
                  <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>{l.t}</span>
                  <span className="col" style={{ gap: 2, minWidth: 0, overflow: "hidden" }}>
                    <span className="t-sm" style={{ color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.desc}</span>
                    <span className="row gap2" style={{ minWidth: 0, overflow: "hidden" }}>
                      <window.Prov id={l.provider} />
                      <span className="t-xs" style={{ color: "var(--tx-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>{D.MODEL[l.model]?.name} · {l.qty}</span>
                    </span>
                  </span>
                  <span><window.Avatar glyph={l.op} size={20} /></span>
                  <span>{l.score != null ? <span className="mono t-xs" style={{ color: l.score >= 8 ? "var(--ok)" : "var(--tx-3)", fontWeight: 600 }}>{l.score}</span> : <span className="t-xs" style={{ color: "var(--tx-4)" }}>—</span>}</span>
                  <span className="mono t-sm" style={{ textAlign: "right", color: l.cost >= s.budget.spendCardThreshold ? "var(--gold-hi)" : "var(--tx-1)" }}>${l.cost.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col gap5" style={{ position: "sticky", top: 0 }}>
          <MiniCalc />
          <div className="card card-pad gap3">
            <span className="t-h3">Price sheet</span>
            <div className="col gap2">
              {D.MODELS.map(m => (
                <div key={m.id} className="between" style={{ padding: "5px 0" }}>
                  <span className="row gap2 t-sm"><window.Prov id={m.provider} />{m.name}</span>
                  <span className="mono t-xs" style={{ color: "var(--gold-hi)" }}>${m.type === "video" ? m.price.toFixed(2) + "/s" : m.price.toFixed(3)}</span>
                </div>
              ))}
            </div>
            <span className="t-xs" style={{ color: "var(--tx-4)" }}>Video bills per second · audio adds $0.01–0.02/s · 4K tier ×1.6</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CostsScreen = CostsScreen;
if (!document.getElementById("__cost_kf")) {
  const st = document.createElement("style"); st.id = "__cost_kf";
  st.textContent = `
    .ledger{padding:6px 8px}
    .lrow{display:grid;grid-template-columns:44px minmax(0,1fr) 28px 34px 66px;gap:10px;align-items:center;padding:9px 10px;border-radius:9px}
    .lrow:not(.lhead):hover{background:var(--bg-2)}
    .lhead{font-size:10.5px;font-weight:640;letter-spacing:0.08em;text-transform:uppercase;color:var(--tx-4);border-bottom:1px solid var(--line-1);border-radius:0}
  `;
  document.head.appendChild(st);
}
