/* ============================================================
   StudioCreation — Briefs (batch runner) + Handoff (Higgsfield)
   ============================================================ */

const BRIEFS = [
  { id: "b1", name: "StarXI · World Cup launch", brand: "starxi", done: 12, total: 18, spent: 4.10, hue: 40,
    desc: "Collectible reveal campaign — hero films, ref sheets, social cuts",
    shots: [
      { n: "Captain hero film", emp: "hero-director", model: "kling-3-pro", ratio: "21:9", cost: 0.84, state: "done", score: 9 },
      { n: "Squad turnaround sheet", emp: "reference-sheets", model: "nano-banana-pro", ratio: "4:3", cost: 0.234, state: "done", score: 10 },
      { n: "Group stage title card", emp: "typography-animator", model: "seedance-1", ratio: "9:16", cost: 0.20, state: "done", score: 8 },
      { n: "Value infographic", emp: "infographic-builder", model: "gpt-image-2", ratio: "4:5", cost: 0.24, state: "running", score: null },
      { n: "Keeper diving figurine", emp: "reference-sheets", model: "nano-banana-pro", ratio: "1:1", cost: 0.156, state: "queued", score: null },
      { n: "Striker volley loop", emp: "premium-motion", model: "kling-3-pro", ratio: "16:9", cost: 0.84, state: "pending", score: null },
      { n: "Stadium aerial dusk", emp: "hero-director", model: "veo-3.1", ratio: "16:9", cost: 0.96, state: "pending", score: null },
    ],
  },
  { id: "b2", name: "StrikeLab · Driver launch", brand: "strikelab", done: 5, total: 11, spent: 1.46, hue: 195,
    desc: "Technical product launch — macro stills, clean hero, spec infographics",
    shots: [
      { n: "Driver head macro", emp: "brand-stylist", model: "soul-2", ratio: "4:5", cost: 0.05, state: "done", score: 9 },
      { n: "Shaft flex diagram", emp: "infographic-builder", model: "gpt-image-2", ratio: "16:9", cost: 0.06, state: "done", score: 8 },
      { n: "Glove texture macro", emp: "reference-sheets", model: "nano-banana-pro", ratio: "1:1", cost: 0.039, state: "running", score: null },
      { n: "Hero on tee", emp: "premium-motion", model: "kling-3-pro", ratio: "21:9", cost: 0.84, state: "pending", score: null },
      { n: "Spec card set", emp: "infographic-builder", model: "gpt-image-2", ratio: "4:5", cost: 0.24, state: "pending", score: null },
    ],
  },
];

function BriefsScreen() {
  const s = window.useStudio();
  const D = s.D;
  const [sel, setSel] = React.useState("b1");
  const brief = BRIEFS.find(b => b.id === sel);
  const brand = D.BRANDS[brief.brand];
  const remaining = brief.shots.filter(x => x.state === "pending" || x.state === "queued");
  const estRemaining = remaining.reduce((a, x) => a + x.cost, 0);
  const pct = brief.done / brief.total;

  const stateMap = {
    done: { pill: "ready", label: "Done" }, running: { pill: "running", label: "Generating" },
    queued: { pill: "queued", label: "Queued" }, pending: { pill: "queued", label: "Pending" },
  };

  return (
    <div className="screen-pad" style={{ maxWidth: 1200 }}>
      <div className="screen-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="t-label" style={{ color: "var(--gold)" }}>Briefs · Batch runner</span>
          <h1 className="t-h1">Campaign batches</h1>
        </div>
        <window.Btn variant="quiet" icon="plus">New brief</window.Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", gap: 18, alignItems: "start" }}>
        {/* brief list */}
        <div className="col gap3">
          {BRIEFS.map(b => {
            const on = b.id === sel;
            const bd = D.BRANDS[b.brand];
            return (
              <button key={b.id} onClick={() => setSel(b.id)} className="card card-pad col gap3" style={{
                textAlign: "left", cursor: "pointer", borderColor: on ? "var(--gold-line)" : "var(--line-1)",
                boxShadow: on ? "var(--glow-gold)" : "var(--el-1)" }}>
                <div className="between">
                  <span className="row gap2"><window.BrandDot id={b.brand} />
                    <span className="t-xs" style={{ color: b.brand === "starxi" ? "var(--gold-hi)" : "var(--strikelab)" }}>{bd.name}</span></span>
                  <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>{b.done}/{b.total}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{b.name.split(" · ")[1]}</span>
                <window.Bar value={b.done / b.total} variant="ok" />
                <div className="between">
                  <span className="t-xs">{b.desc.split(" — ")[0]}</span>
                  <span className="mono t-xs" style={{ color: "var(--gold-hi)" }}>${b.spent.toFixed(2)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* shot list */}
        <div className="card">
          <div className="card-hd">
            <div className="between">
              <div className="col" style={{ gap: 3 }}>
                <span className="row gap2"><window.BrandDot id={brief.brand} /><span className="t-h2">{brief.name.split(" · ")[1]}</span></span>
                <span className="t-sm">{brief.desc}</span>
              </div>
              <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                <span className="mono" style={{ fontSize: 18, fontWeight: 660 }}>{Math.round(pct * 100)}%</span>
                <span className="t-xs">{brief.done} of {brief.total} shots</span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}><window.Bar value={pct} variant="ok" height={8} /></div>
          </div>

          <div className="col" style={{ padding: 8 }}>
            {brief.shots.map((sh, i) => {
              const sm = stateMap[sh.state];
              return (
                <div key={i} className="row gap3 shotrow" style={{ padding: "10px 10px", borderRadius: 10 }}>
                  <window.Media ratio="1:1" type={D.MODEL[sh.model].type} hue={D.EMP[sh.emp]?.hue} loading={sh.state === "running"}
                    style={{ width: 40, flex: "none" }} radius={8} />
                  <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                    <span className="t-sm" style={{ color: "var(--tx-1)", fontWeight: 540, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sh.n}</span>
                    <span className="row gap2 t-xs" style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><window.EmpAvatar id={sh.emp} size={14} />{D.EMP[sh.emp]?.name} · {D.MODEL[sh.model].name} · {sh.ratio}</span>
                  </div>
                  {sh.score != null && <span className="mono t-xs" style={{ color: sh.score >= 8 ? "var(--ok)" : "var(--tx-3)", fontWeight: 600, flex: "none" }}>{sh.score}/10</span>}
                  <window.Pill state={sm.pill} label={sm.label} />
                  <window.Cost value={sh.cost} />
                </div>
              );
            })}
          </div>

          <div className="card-hd between" style={{ borderBottom: "none", borderTop: "1px solid var(--line-1)" }}>
            <div className="col" style={{ gap: 2 }}>
              <span className="t-sm">{remaining.length} shots remaining</span>
              <span className="mono t-xs" style={{ color: "var(--gold-hi)" }}>est. ${estRemaining.toFixed(2)} · ${(s.budget.remaining).toFixed(2)} budget left today</span>
            </div>
            <window.Btn variant="primary" icon="play" disabled={estRemaining > s.budget.remaining}
              onClick={() => s.toast({ kind: "info", icon: "queue", title: "Batch queued", msg: `${remaining.length} shots · est. $${estRemaining.toFixed(2)}` })}>
              Run remaining · ${estRemaining.toFixed(2)}</window.Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- HANDOFF ---------------- */
const PACKAGES = [
  { id: "h1", title: "Soul 2.0 · Editorial campaign frame", target: "Soul 2.0", brand: "starxi", state: "ready",
    prompt: "StarXI captain, editorial campaign portrait, deep green kit, gold accents, cream backdrop, controlled studio light, collectible figurine gloss, 4:5",
    settings: ["Aspect 4:5", "Quality High", "Style ref: brand-stylist", "Seed locked"] },
  { id: "h2", title: "Soul 2.0 · Stadium hero plate", target: "Soul 2.0", brand: "starxi", state: "ready",
    prompt: "Anamorphic stadium hero plate at dusk, warm floodlights, cinematic haze, players mid-celebration, 21:9, dramatic side light",
    settings: ["Aspect 21:9", "Quality High", "Upscale 2×"] },
  { id: "h3", title: "Soul 2.0 · Glove macro", target: "Soul 2.0", brand: "strikelab", state: "logged",
    prompt: "StrikeLab glove texture macro, technical perforations, cool teal rim light, seamless graphite backdrop, precise product detail",
    settings: ["Aspect 1:1", "Quality High"], cost: 0.05, score: 9 },
];

function HandoffScreen() {
  const s = window.useStudio();
  const D = s.D;
  const [sel, setSel] = React.useState("h1");
  const [copied, setCopied] = React.useState(false);
  const pkg = PACKAGES.find(p => p.id === sel);
  const brand = D.BRANDS[pkg.brand];

  function copyPkg() {
    const text = `${pkg.prompt}\n\n— ${pkg.settings.join(" · ")}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1800);
    s.toast({ kind: "info", icon: "copy", title: "Copied for Higgsfield", msg: "Paste into Soul 2.0, then log the result" });
  }

  return (
    <div className="screen-pad" style={{ maxWidth: 1120 }}>
      <div className="screen-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="t-label" style={{ color: "var(--gold)" }}>Handoff · Higgsfield</span>
          <h1 className="t-h1">Paste packages</h1>
          <span className="t-body">Higgsfield runs in its web app. Compose here, paste there, then log the result back into the ledger.</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", gap: 18, alignItems: "start" }}>
        {/* list */}
        <div className="col gap3">
          {PACKAGES.map(p => {
            const on = p.id === sel;
            return (
              <button key={p.id} onClick={() => setSel(p.id)} className="card card-pad col gap2" style={{ textAlign: "left", cursor: "pointer",
                borderColor: on ? "var(--gold-line)" : "var(--line-1)", boxShadow: on ? "var(--glow-gold)" : "var(--el-1)" }}>
                <div className="between">
                  <span className="prov higgs"><span className="sq" />higgsfield</span>
                  {p.state === "ready"
                    ? <span className="pill gold"><span className="led" />Ready</span>
                    : <span className="pill ready"><span className="led" />Logged</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 580 }}>{p.title.split(" · ")[1]}</span>
                <span className="row gap2 t-xs"><window.BrandDot id={p.brand} />{D.BRANDS[p.brand].name} · {p.target}</span>
              </button>
            );
          })}
        </div>

        {/* detail */}
        <div className="col gap4">
          <div className="card">
            <div className="card-hd between">
              <div className="row gap2"><span className="prov higgs"><span className="sq" />higgsfield</span><span className="t-h3">{pkg.target}</span></div>
              <window.Btn size="sm" variant={copied ? "" : "primary"} icon={copied ? "check" : "copy"} onClick={copyPkg}>{copied ? "Copied" : "Copy package"}</window.Btn>
            </div>
            <div className="col gap3" style={{ padding: 16 }}>
              <span className="t-label">Prompt block</span>
              <div className="mono" style={{ fontSize: 13, lineHeight: 1.6, padding: 14, borderRadius: 11, background: "var(--bg-1)", border: "1px solid var(--line-2)", color: "var(--tx-1)" }}>
                {pkg.prompt}
              </div>
              <div className="row wrap gap2">
                {pkg.settings.map((x, i) => <span key={i} className="chip" style={{ cursor: "default" }}><window.UIIcon name="sliders" size={12} />{x}</span>)}
              </div>
            </div>
          </div>

          {/* log result */}
          <div className="card card-pad gap4">
            <div className="row gap2"><window.UIIcon name="history" size={15} style={{ color: "var(--gold)" }} /><span className="t-h3">Log the result</span></div>
            {pkg.state === "logged" ? (
              <div className="row gap3" style={{ padding: 14, borderRadius: 12, background: "var(--ok-wash)", border: "1px solid rgba(75,178,134,0.25)" }}>
                <window.UIIcon name="checkcircle" size={20} style={{ color: "var(--ok)" }} />
                <div className="col grow" style={{ gap: 1 }}>
                  <span className="t-sm" style={{ color: "var(--tx-1)" }}>Logged to ledger · scored {pkg.score}/10</span>
                  <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>{pkg.target} · ${pkg.cost.toFixed(2)} · higgs credits</span>
                </div>
                <window.Btn size="sm" variant="ghost" iconRight="arrowright" onClick={() => s.setScreen("gallery")}>View</window.Btn>
              </div>
            ) : (
              <LogForm pkg={pkg} />
            )}
            <span className="t-xs" style={{ color: "var(--tx-4)" }}>Logging records the spend against Higgsfield credits and drops the asset into the unified gallery + local archive.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogForm({ pkg }) {
  const s = window.useStudio();
  const [credits, setCredits] = React.useState("8");
  const [score, setScore] = React.useState(null);
  return (
    <div className="col gap3">
      <div className="row gap4">
        <div className="col gap2 grow">
          <span className="t-sm">Higgsfield credits used</span>
          <input className="input" value={credits} onChange={e => setCredits(e.target.value)} inputMode="numeric" />
        </div>
        <div className="col gap2 grow">
          <span className="t-sm">Quality score</span>
          <div style={{ padding: "9px 0" }}><window.Score value={score} onChange={setScore} size={13} /></div>
        </div>
      </div>
      <window.Btn variant="primary" icon="check" style={{ alignSelf: "flex-start" }}
        onClick={() => s.toast({ kind: "ok", icon: "checkcircle", title: "Logged to ledger", msg: `${pkg.target} · ${credits} credits${score ? ` · scored ${score}` : ""}` })}>
        Log result to ledger</window.Btn>
    </div>
  );
}

window.BriefsScreen = BriefsScreen;
window.HandoffScreen = HandoffScreen;
if (!document.getElementById("__extra_kf")) {
  const st = document.createElement("style"); st.id = "__extra_kf";
  st.textContent = ".shotrow:hover{background:var(--bg-2)}";
  document.head.appendChild(st);
}
