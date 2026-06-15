/* ============================================================
   StudioCreation — Dashboard (home)
   ============================================================ */

function MiniJob({ job }) {
  const s = window.useStudio();
  const m = s.D.MODEL[job.model];
  const remain = Math.max(0, Math.round(job.eta - job.elapsed));
  return (
    <div className="row gap3" style={{ padding: "11px 12px", borderRadius: 12, background: "var(--bg-2)",
      border: "1px solid var(--line-1)" }}>
      <window.Media ratio={job.ratio} type={job.type} hue={s.D.EMP[job.employee]?.hue || 220}
        loading={job.state === "running"} style={{ width: 64, flex: "none" }} radius={9} />
      <div className="col grow" style={{ gap: 6, minWidth: 0 }}>
        <div className="between">
          <div className="row gap2" style={{ minWidth: 0 }}>
            <window.EmpAvatar id={job.employee} size={18} />
            <span style={{ fontSize: 12.5, fontWeight: 560, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.D.EMP[job.employee]?.name}</span>
          </div>
          <window.Pill state={job.state} />
        </div>
        <span className="t-xs" style={{ color: "var(--tx-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.prompt}</span>
        {job.state === "running" ? (
          <>
            <window.Bar value={job.progress} variant="run" shimmer />
            <div className="between">
              <span className="mono t-xs" style={{ color: "var(--run)" }}>{m.name} · {Math.round(job.progress * 100)}%</span>
              <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>~{remain}s left · {job.elapsed}s</span>
            </div>
          </>
        ) : (
          <div className="between">
            <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>{m.name} · waiting</span>
            <window.Cost value={job.cost} />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardScreen() {
  const s = window.useStudio();
  const { budget } = s;
  const running = s.jobs.filter(j => j.state === "running");
  const queued = s.jobs.filter(j => j.state === "queued");
  const recent = s.assets.slice(0, 8);
  const toScore = s.assets.filter(a => a.score == null).slice(0, 5);
  const madeToday = 47 + (s.assets.length - 24);
  const passRate = Math.round(s.assets.filter(a => a.score != null && a.score >= 8).length / Math.max(1, s.assets.filter(a => a.score != null).length) * 100);
  const spendSpark = [0.42, 0.8, 0.31, 1.2, 0.6, 0.9, 0.24, 0.84];

  const KPI = ({ icon, label, value, sub, accent, children }) => (
    <div className="card card-pad rise" style={{ flex: 1, gap: 12, minWidth: 0 }}>
      <div className="between">
        <span className="t-label">{label}</span>
        <window.UIIcon name={icon} size={15} style={{ color: "var(--tx-4)" }} />
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <span className="tnum" style={{ fontSize: 28, fontWeight: 660, letterSpacing: "-0.03em", color: accent || "var(--tx-1)" }}>{value}</span>
        {sub && <span className="t-xs">{sub}</span>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="t-label" style={{ color: "var(--gold)" }}>Wednesday · June 11</span>
          <h1 className="t-display">Good afternoon, Alex.</h1>
          <span className="t-body">{running.length} generating · {s.needsScoring} to review · ${budget.remaining.toFixed(2)} of today's budget left</span>
        </div>
        <div className="row gap2">
          <window.IconBtn icon={s.soundOn ? "bell" : "bell"} ghost onClick={() => s.setSoundOn(!s.soundOn)}
            style={{ opacity: s.soundOn ? 1 : 0.5 }} title="Completion sound" />
          <window.Btn variant="primary" icon="create" onClick={() => s.setScreen("create")}>New generation</window.Btn>
        </div>
      </div>

      {/* KPIs */}
      <div className="row gap4" style={{ marginBottom: 18 }}>
        <KPI icon="zap" label="Generating now" value={running.length} accent="var(--run)"
          sub={queued.length ? `+${queued.length} queued` : "queue clear"}>
          <window.Bar value={running.length ? running[0].progress : 0} variant="run" shimmer={!!running.length} />
        </KPI>
        <KPI icon="gallery" label="Made today" value={madeToday} sub="renders">
          <span className="t-xs" style={{ color: "var(--ok)" }}>{passRate}% passed the gate</span>
        </KPI>
        <KPI icon="costs" label="Spent today" value={`$${budget.usedToday.toFixed(2)}`} accent="var(--gold-hi)"
          sub={`/ $${budget.dailyCap.toFixed(2)}`}>
          <window.Gauge used={budget.usedToday} cap={budget.dailyCap} />
        </KPI>
        <KPI icon="shield" label="Needs scoring" value={s.needsScoring} accent={s.needsScoring ? "var(--gold-hi)" : "var(--tx-1)"}
          sub="in review">
          <button onClick={() => s.setScreen("gallery")} className="t-xs" style={{ color: "var(--gold-hi)", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
            Open review →</button>
        </KPI>
      </div>

      {/* main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
        {/* LEFT */}
        <div className="col gap5">
          {/* live now */}
          <div className="card">
            <div className="card-hd between">
              <div className="row gap2">
                <span className="t-h3">Generating now</span>
                {running.length > 0 && <span className="pill running"><span className="led" />{running.length} live</span>}
              </div>
              <window.Btn variant="ghost" size="sm" iconRight="arrowright" onClick={() => s.setScreen("queue")}>Queue</window.Btn>
            </div>
            <div className="col gap3" style={{ padding: 14 }}>
              {running.length === 0 && queued.length === 0 ? (
                <div className="col" style={{ alignItems: "center", gap: 10, padding: "26px 0", color: "var(--tx-3)" }}>
                  <window.UIIcon name="checkcircle" size={26} style={{ color: "var(--ok)" }} />
                  <span className="t-sm">Queue is clear. Nothing generating.</span>
                  <window.Btn size="sm" icon="create" onClick={() => s.setScreen("create")}>Start something</window.Btn>
                </div>
              ) : (
                [...running, ...queued].slice(0, 4).map(j => <MiniJob key={j.id} job={j} />)
              )}
            </div>
          </div>

          {/* latest renders */}
          <div className="card">
            <div className="card-hd between">
              <span className="t-h3">Latest renders</span>
              <window.Btn variant="ghost" size="sm" iconRight="arrowright" onClick={() => s.setScreen("gallery")}>Gallery</window.Btn>
            </div>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
              {recent.map(a => (
                <div key={a.id} className={a.fresh ? "air" : ""} style={{ cursor: "pointer" }} onClick={() => s.setScreen("gallery")}>
                  <window.Media ratio="1:1" type={a.type} hue={s.D.EMP[a.employee]?.hue || a.h} radius={10}>
                    <div style={{ position: "absolute", left: 6, top: 6 }}><window.BrandDot id={a.brand} /></div>
                    {a.score != null && (
                      <div style={{ position: "absolute", right: 6, top: 6, width: 20, height: 20, borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                        background: a.score >= 8 ? "var(--ok-wash)" : "rgba(0,0,0,0.5)", color: a.score >= 8 ? "#84d3b2" : "var(--tx-2)",
                        backdropFilter: "blur(4px)" }}>{a.score}</div>
                    )}
                    {a.score == null && (
                      <div style={{ position: "absolute", right: 6, top: 6 }} className="pill gold" >
                        <span className="led" /></div>
                    )}
                    {a.type === "video" && <div style={{ position: "absolute", left: 6, bottom: 6, color: "rgba(255,255,255,0.8)" }}><window.UIIcon name="video" size={13} /></div>}
                  </window.Media>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col gap5">
          {/* budget detail */}
          <div className="card card-pad gap4">
            <div className="between">
              <span className="t-h3">Today's spend</span>
              <window.Spark data={spendSpark} color="var(--gold)" />
            </div>
            <div className="col gap2">
              <window.Gauge used={budget.usedToday} cap={budget.dailyCap} height={10} />
              <div className="between">
                <span className="mono t-sm" style={{ color: "var(--gold-hi)" }}>${budget.usedToday.toFixed(2)} used</span>
                <span className="mono t-sm" style={{ color: "var(--tx-2)" }}>${budget.remaining.toFixed(2)} left</span>
              </div>
            </div>
            <div className="hr" />
            <div className="row gap3">
              <div className="col grow" style={{ gap: 2 }}>
                <span className="t-xs row gap2"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--fal)" }} />fal balance</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 620, color: budget.falBalance < 20 ? "var(--gold-hi)" : "var(--tx-1)" }}>${budget.falBalance.toFixed(2)}</span>
              </div>
              <div className="vr" />
              <div className="col grow" style={{ gap: 2 }}>
                <span className="t-xs row gap2"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--higgs)" }} />higgs credits</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 620 }}>{budget.higgsCredits}</span>
              </div>
            </div>
            {budget.falBalance < 20 && (
              <div className="row gap2" style={{ fontSize: 11.5, color: "var(--gold-hi)", padding: "8px 10px", borderRadius: 9, background: "var(--gold-wash)" }}>
                <window.UIIcon name="bolt" size={13} />fal balance running low — top up soon
              </div>
            )}
          </div>

          {/* needs scoring */}
          <div className="card">
            <div className="card-hd between">
              <span className="t-h3">Needs scoring</span>
              <span className="pill gold"><span className="led" />{s.needsScoring}</span>
            </div>
            <div className="col" style={{ padding: 8 }}>
              {toScore.length === 0 && <div className="t-sm" style={{ padding: 16, color: "var(--tx-3)" }}>All caught up — everything's scored.</div>}
              {toScore.map(a => (
                <button key={a.id} onClick={() => s.setScreen("gallery")} className="row gap3 scorerow" style={{
                  padding: 8, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <window.Media ratio="1:1" type={a.type} hue={s.D.EMP[a.employee]?.hue || a.h} style={{ width: 40, flex: "none" }} radius={8} />
                  <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                    <span className="t-sm" style={{ color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.prompt}</span>
                    <span className="row gap2"><window.Prov id={a.provider} /><span className="mono t-xs" style={{ color: "var(--tx-3)" }}>${a.cost.toFixed(3)}</span></span>
                  </div>
                  <window.UIIcon name="chevright" size={15} style={{ color: "var(--tx-4)" }} />
                </button>
              ))}
            </div>
          </div>

          {/* next up */}
          <div className="card card-pad gap3">
            <span className="t-h3">What's next</span>
            {[
              { icon: "trophy", t: "3 renders scored 9+", d: "Promote to hero render", c: "var(--gold-hi)" },
              { icon: "briefs", t: "StrikeLab launch brief", d: "12 of 18 shots done", c: "var(--strikelab)" },
              { icon: "handoff", t: "2 Higgsfield packages", d: "Ready to paste & log", c: "var(--higgs)" },
            ].map((x, i) => (
              <button key={i} className="row gap3 scorerow" style={{ padding: "9px 8px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-3)", color: x.c }}><window.UIIcon name={x.icon} size={15} /></div>
                <div className="col grow" style={{ gap: 1 }}>
                  <span className="t-sm" style={{ color: "var(--tx-1)", fontWeight: 560 }}>{x.t}</span>
                  <span className="t-xs">{x.d}</span>
                </div>
                <window.UIIcon name="chevright" size={15} style={{ color: "var(--tx-4)" }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
if (!document.getElementById("__dash_kf")) {
  const st = document.createElement("style"); st.id = "__dash_kf";
  st.textContent = ".scorerow:hover{background:var(--bg-2)!important}";
  document.head.appendChild(st);
}
