/* ============================================================
   StudioCreation — Queue (alive job progress)
   ============================================================ */

function StageDots({ state }) {
  const stages = ["queued", "running", "ready"];
  const cur = stages.indexOf(state === "done" ? "ready" : state);
  const labels = { queued: "Queued", running: "Generating", ready: "Ready" };
  return (
    <div className="row gap2">
      {stages.map((st, i) => (
        <React.Fragment key={st}>
          <div className="row gap2" style={{ opacity: i <= cur ? 1 : 0.35 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none",
              background: i < cur ? "var(--ok)" : i === cur ? (st === "running" ? "var(--run)" : "var(--gold)") : "var(--tx-4)",
              boxShadow: i === cur && st === "running" ? "0 0 0 3px var(--run-wash)" : "none" }} />
            <span className="t-xs" style={{ color: i === cur ? "var(--tx-1)" : "var(--tx-3)", fontWeight: i === cur ? 600 : 460 }}>{labels[st]}</span>
          </div>
          {i < 2 && <div style={{ width: 18, height: 1, background: i < cur ? "var(--ok)" : "var(--line-2)" }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function JobCard({ job }) {
  const s = window.useStudio();
  const m = s.D.MODEL[job.model];
  const emp = s.D.EMP[job.employee];
  const brand = s.D.BRANDS[job.brand];
  const remain = Math.max(0, Math.round(job.eta - job.elapsed));
  const running = job.state === "running";
  const ready = job.state === "ready" || job.state === "done";

  return (
    <div className={`card ${job._done ? "air" : ""}`} style={{ padding: 16, gap: 14,
      borderColor: running ? "rgba(90,155,220,0.25)" : ready ? "rgba(75,178,134,0.22)" : "var(--line-1)" }}>
      <div className="row gap4" style={{ alignItems: "stretch" }}>
        {/* thumb */}
        <div style={{ width: 132, flex: "none", position: "relative" }}>
          <window.Media ratio={job.ratio} type={job.type} hue={emp?.hue || 220} loading={running} radius={11}
            fresh={job._done}>
            {ready && <div style={{ position: "absolute", right: 7, bottom: 7, width: 26, height: 26, borderRadius: "50%",
              background: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <window.UIIcon name="check" size={15} style={{ color: "#062" }} /></div>}
          </window.Media>
        </div>

        {/* body */}
        <div className="col grow" style={{ gap: 9, minWidth: 0 }}>
          <div className="between">
            <div className="row gap2" style={{ minWidth: 0 }}>
              <window.EmpAvatar id={job.employee} size={22} />
              <div className="col" style={{ gap: 0, minWidth: 0 }}>
                <span className="row gap2" style={{ fontSize: 13.5, fontWeight: 580 }}>{emp?.name}
                  <window.BrandDot id={job.brand} /></span>
                <span className="row gap2 t-xs"><window.Prov id={job.provider || m.provider} />{m.name} · {job.ratio}{job.type === "video" ? ` · ${job.dur}s` : ` · ${job.count}×`}</span>
              </div>
            </div>
            <window.Pill state={job.state} />
          </div>

          <span className="t-sm" style={{ color: "var(--tx-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.prompt}</span>

          {running && (
            <div className="col gap2">
              <window.Bar value={job.progress} variant="run" shimmer />
              <div className="between">
                <span className="row gap3">
                  <span className="mono t-xs" style={{ color: "var(--run)", fontWeight: 600 }}>{Math.round(job.progress * 100)}%</span>
                  <span className="mono t-xs" style={{ color: "var(--tx-3)" }}><window.UIIcon name="clock" size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />{job.elapsed}s elapsed</span>
                </span>
                <span className="mono t-xs" style={{ color: "var(--tx-2)" }}>~{remain}s left <span style={{ color: "var(--tx-4)" }}>· learned ETA</span></span>
              </div>
            </div>
          )}
          {job.state === "queued" && (
            <div className="row between">
              <StageDots state={job.state} />
              <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>~{m.eta}s when started</span>
            </div>
          )}
          {ready && (
            <div className="row between">
              <span className="row gap2 t-xs" style={{ color: "var(--ok)" }}><window.UIIcon name="checkcircle" size={13} />Done in {job.elapsed}s · needs scoring</span>
            </div>
          )}
        </div>

        {/* right meta */}
        <div className="col" style={{ flex: "none", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <window.Cost value={job.cost} variant={running ? "" : ready ? "gold" : ""} />
          {running && <window.Btn size="sm" variant="ghost" icon="x" onClick={() => s.toast({ kind: "info", icon: "x", title: "Cancel requested", msg: "Stopping after current step" })}>Cancel</window.Btn>}
          {job.state === "queued" && <window.Btn size="sm" variant="ghost" icon="x">Remove</window.Btn>}
          {ready && <window.Btn size="sm" variant="primary" iconRight="arrowright" onClick={() => s.setScreen("gallery")}>Review</window.Btn>}
        </div>
      </div>
    </div>
  );
}

function QueueScreen() {
  const s = window.useStudio();
  const running = s.jobs.filter(j => j.state === "running");
  const queued = s.jobs.filter(j => j.state === "queued");
  const ready = s.jobs.filter(j => j.state === "ready" || j.state === "done");

  const Section = ({ title, jobs, accent, icon }) => jobs.length ? (
    <div className="col gap3">
      <div className="row gap2" style={{ marginBottom: 2 }}>
        <window.UIIcon name={icon} size={15} style={{ color: accent }} />
        <span className="t-h3">{title}</span>
        <span className="t-xs" style={{ color: "var(--tx-4)" }}>{jobs.length}</span>
      </div>
      {jobs.map(j => <JobCard key={j.id} job={j} />)}
    </div>
  ) : null;

  return (
    <div className="screen-pad" style={{ maxWidth: 1040 }}>
      <div className="screen-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="t-label" style={{ color: "var(--gold)" }}>Queue</span>
          <h1 className="t-h1">{running.length ? `${running.length} generating` : "Queue clear"}{queued.length ? ` · ${queued.length} waiting` : ""}</h1>
        </div>
        <window.Btn variant="primary" icon="create" onClick={() => s.setScreen("create")}>New generation</window.Btn>
      </div>

      {running.length + queued.length + ready.length === 0 ? (
        <div className="card card-pad col" style={{ alignItems: "center", gap: 12, padding: "60px 0" }}>
          <window.UIIcon name="checkcircle" size={34} style={{ color: "var(--ok)" }} />
          <span className="t-h2">All clear</span>
          <span className="t-body">Nothing in the queue. Start a generation to see it come alive here.</span>
          <window.Btn variant="primary" icon="create" onClick={() => s.setScreen("create")}>Create</window.Btn>
        </div>
      ) : (
        <div className="col gap6">
          <Section title="Generating" jobs={running} accent="var(--run)" icon="zap" />
          <Section title="Queued" jobs={queued} accent="var(--gold)" icon="queue" />
          <Section title="Ready to review" jobs={ready} accent="var(--ok)" icon="checkcircle" />
        </div>
      )}
    </div>
  );
}

window.QueueScreen = QueueScreen;
