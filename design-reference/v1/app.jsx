/* ============================================================
   StudioCreation — App Shell
   Sidebar nav · budget gauge · provider balances · activity ·
   toast host · screen router.
   ============================================================ */

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "create", label: "Create", icon: "create" },
  { id: "queue", label: "Queue", icon: "queue", badge: "active" },
  { id: "gallery", label: "Gallery", icon: "gallery", badge: "score" },
  { id: "costs", label: "Costs", icon: "costs" },
  { id: "briefs", label: "Briefs", icon: "briefs" },
  { id: "handoff", label: "Handoff", icon: "handoff" },
];

function Sidebar() {
  const s = window.useStudio();
  const { budget } = s;
  const balLow = budget.falBalance < 20;
  return (
    <aside className="col" style={{
      width: 224, flex: "none", background: "var(--bg-1)", borderRight: "1px solid var(--line-1)",
      padding: "16px 12px", gap: 4, position: "relative", zIndex: 2 }}>
      {/* brand */}
      <div className="row gap3" style={{ padding: "4px 8px 14px" }}>
        <div style={{ position: "relative" }}>
          <window.Avatar glyph="" size={30} sq style={{ background: "linear-gradient(150deg, var(--gold-hi), var(--gold-dim))" }} />
          <window.UIIcon name="bolt" size={15} fill style={{ position: "absolute", inset: 0, margin: "auto", color: "#1a1405" }} />
        </div>
        <div className="col" style={{ gap: 0 }}>
          <span style={{ fontWeight: 680, fontSize: 14.5, letterSpacing: "-0.02em" }}>StudioCreation</span>
          <span className="t-xs" style={{ color: "var(--tx-4)" }}>production cockpit</span>
        </div>
      </div>

      {/* nav */}
      <nav className="col" style={{ gap: 2 }}>
        {NAV.map(n => {
          const on = s.screen === n.id;
          const badge = n.badge === "active" && s.activeCount ? s.activeCount
            : n.badge === "score" && s.needsScoring ? s.needsScoring : null;
          return (
            <button key={n.id} onClick={() => s.setScreen(n.id)} className="row between navitem"
              style={{
                height: 38, padding: "0 10px", borderRadius: 10, cursor: "pointer", border: "none",
                background: on ? "var(--bg-3)" : "transparent",
                color: on ? "var(--tx-1)" : "var(--tx-2)", fontFamily: "inherit",
                boxShadow: on ? "var(--el-1)" : "none", transition: "all 140ms var(--ease-out)",
              }}>
              <span className="row gap3">
                <window.UIIcon name={n.icon} size={17} style={{ color: on ? "var(--gold-hi)" : "currentColor" }} />
                <span style={{ fontSize: 13.5, fontWeight: on ? 580 : 500 }}>{n.label}</span>
              </span>
              {badge != null && (
                <span style={{
                  minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, fontSize: 11, fontWeight: 680,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: n.badge === "active" ? "var(--run-wash)" : "var(--gold-wash)",
                  color: n.badge === "active" ? "#9ec3ee" : "var(--gold-hi)" }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="grow" />

      {/* budget gauge */}
      <div className="card" style={{ padding: 12, gap: 10, background: "var(--bg-2)" }}>
        <div className="between">
          <span className="t-label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <window.UIIcon name="gauge" size={13} style={{ color: "var(--gold)" }} />Daily budget</span>
          <span className="mono t-xs" style={{ color: budget.pct >= 0.75 ? "var(--gold-hi)" : "var(--tx-2)" }}>
            {Math.round(budget.pct * 100)}%</span>
        </div>
        <window.Gauge used={budget.usedToday} cap={budget.dailyCap} />
        <div className="between" style={{ whiteSpace: "nowrap" }}>
          <span className="mono t-xs" style={{ color: "var(--tx-2)" }}>${budget.usedToday.toFixed(2)} used</span>
          <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>${budget.remaining.toFixed(2)} left</span>
        </div>
        {budget.pct >= 0.75 && (
          <div className="row gap2" style={{ fontSize: 10, lineHeight: 1.3, color: "var(--gold-hi)", marginTop: -2 }}>
            <window.UIIcon name="shield" size={11} style={{ flex: "none" }} />75% cap — confirm spends
          </div>
        )}
        <div className="hr" style={{ margin: "2px 0" }} />
        {/* provider balances */}
        <div className="col" style={{ gap: 7 }}>
          <div className="between">
            <span className="row gap2 t-xs"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--fal)" }} />fal balance</span>
            <span className="mono t-xs" style={{ color: balLow ? "var(--gold-hi)" : "var(--tx-1)" }}>${budget.falBalance.toFixed(2)}</span>
          </div>
          <div className="between">
            <span className="row gap2 t-xs"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--higgs)" }} />higgs credits</span>
            <span className="mono t-xs" style={{ color: "var(--tx-1)" }}>{budget.higgsCredits}</span>
          </div>
        </div>
      </div>

      {/* operator */}
      <button className="row between" style={{ marginTop: 6, padding: "7px 8px", borderRadius: 10, border: "none",
        background: "transparent", cursor: "pointer", color: "var(--tx-2)" }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-3)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span className="row gap3">
          <window.Avatar glyph="AR" size={26} />
          <span className="col" style={{ gap: 0, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12.5, fontWeight: 580, color: "var(--tx-1)" }}>Alex Rivera</span>
            <span className="t-xs" style={{ color: "var(--tx-4)" }}>Operator</span>
          </span>
        </span>
        <window.UIIcon name="settings" size={15} />
      </button>
    </aside>
  );
}

/* slim global activity ribbon shown when jobs run (top of content) */
function ActivityRibbon() {
  const s = window.useStudio();
  if (!s.activeCount) return null;
  const running = s.jobs.filter(j => j.state === "running");
  return (
    <div className="row gap3" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 5, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", height: "100%", width: "30%", background: "linear-gradient(90deg, transparent, var(--gold-hi), transparent)",
          animation: "ribbon 1.8s var(--ease-out) infinite" }} />
      </div>
    </div>
  );
}

/* ---- Toasts ---- */
function ToastHost() {
  const s = window.useStudio();
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 200, display: "flex", flexDirection: "column", gap: 10, width: 320 }}>
      {s.toasts.map(t => {
        const c = { ok: "var(--ok)", bad: "var(--bad)", info: "var(--run)" }[t.kind] || "var(--gold)";
        return (
          <div key={t.id} className="air" style={{
            display: "flex", gap: 11, padding: 12, borderRadius: 13, background: "var(--bg-3)",
            border: "1px solid var(--line-2)", boxShadow: "var(--el-3)", alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "flex", alignItems: "center",
              justifyContent: "center", background: `color-mix(in oklab, ${c} 16%, transparent)`, color: c }}>
              <window.UIIcon name={t.icon || "spark"} size={16} />
            </div>
            <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</span>
              {t.msg && <span className="t-xs" style={{ color: "var(--tx-2)" }}>{t.msg}</span>}
            </div>
            <button onClick={() => s.dismissToast(t.id)} style={{ border: "none", background: "transparent",
              color: "var(--tx-4)", cursor: "pointer", padding: 2 }}><window.UIIcon name="x" size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

const SCREENS = {
  dashboard: () => window.DashboardScreen,
  create: () => window.ComposerScreen,
  queue: () => window.QueueScreen,
  gallery: () => window.GalleryScreen,
  costs: () => window.CostsScreen,
  briefs: () => window.BriefsScreen,
  handoff: () => window.HandoffScreen,
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#d8b24a", "#e8c468"],
  "warmth": "warm",
  "radius": 16,
  "motion": "lively",
  "density": "regular",
  "gallery": "masonry"
}/*EDITMODE-END*/;

const WARMTH = {
  warm:    ["#0a0a0c", "#0f0f12", "#151518", "#1c1c21", "#26262c"],
  neutral: ["#090a0b", "#0e0f11", "#141517", "#1b1c1f", "#252629"],
  cool:    ["#08090c", "#0d0e12", "#131418", "#1a1b20", "#23242a"],
};

function TweakLayer() {
  const s = window.useStudio();
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const r = document.documentElement.style;
    const [g, gh] = t.accent;
    r.setProperty("--gold", g); r.setProperty("--gold-hi", gh);
    r.setProperty("--gold-line", `color-mix(in oklab, ${g} 38%, transparent)`);
    r.setProperty("--gold-wash", `color-mix(in oklab, ${g} 13%, transparent)`);
    r.setProperty("--gold-glow", `color-mix(in oklab, ${g} 26%, transparent)`);
    const w = WARMTH[t.warmth] || WARMTH.warm;
    ["--bg-0", "--bg-1", "--bg-2", "--bg-3", "--bg-4"].forEach((v, i) => r.setProperty(v, w[i]));
    r.setProperty("--r-lg", t.radius + "px");
    r.setProperty("--r-md", Math.max(6, t.radius - 4) + "px");
    r.setProperty("--r-sm", Math.max(5, t.radius - 7) + "px");
    r.setProperty("--r-xl", (t.radius + 6) + "px");
    document.body.setAttribute("data-motion", t.motion);
    document.body.setAttribute("data-density", t.density);
  }, [t]);

  React.useEffect(() => { s.setGalleryLayout(t.gallery); }, [t.gallery]);

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection label="Brand accent" />
      <window.TweakColor label="Accent" value={t.accent} onChange={(v) => setTweak("accent", v)}
        options={[["#d8b24a", "#e8c468"], ["#c9a23c", "#e0bb55"], ["#cf9e4a", "#ecc06a"], ["#b8935f", "#d8b889"]]} />
      <window.TweakRadio label="Canvas" value={t.warmth} options={["warm", "neutral", "cool"]}
        onChange={(v) => setTweak("warmth", v)} />
      <window.TweakSection label="Form" />
      <window.TweakSlider label="Corner radius" value={t.radius} min={8} max={22} unit="px"
        onChange={(v) => setTweak("radius", v)} />
      <window.TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]}
        onChange={(v) => setTweak("density", v)} />
      <window.TweakSection label="Behaviour" />
      <window.TweakRadio label="Motion" value={t.motion} options={["calm", "lively"]}
        onChange={(v) => setTweak("motion", v)} />
      <window.TweakRadio label="Gallery" value={t.gallery} options={["masonry", "grid"]}
        onChange={(v) => setTweak("gallery", v)} />
      <window.TweakToggle label="Completion sound" value={s.soundOn} onChange={(v) => s.setSoundOn(v)} />
    </window.TweaksPanel>
  );
}

function App() {
  const s = window.useStudio();
  const ScreenComp = (SCREENS[s.screen] && SCREENS[s.screen]()) || window.DashboardScreen;
  return (
    <div className="row" style={{ height: "100vh", position: "relative", zIndex: 1 }}>
      <Sidebar />
      <main style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ActivityRibbon />
        <div key={s.screen} className="grow" style={{ overflow: "auto", position: "relative" }}>
          {ScreenComp ? React.createElement(ScreenComp) : null}
        </div>
      </main>
      <ToastHost />
      <TweakLayer />
    </div>
  );
}

function Root() {
  return React.createElement(window.StudioProvider, null, React.createElement(App));
}

const kf = document.createElement("style");
kf.textContent = `
  @keyframes ribbon { 0%{left:-30%} 100%{left:100%} }
  .navitem:hover { background: var(--bg-2) !important; color: var(--tx-1) !important; }
  .screen-pad { padding: 24px 28px 60px; max-width: 1320px; margin: 0 auto; }
  .screen-hd { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom: 22px; gap: 16px; }
`;
document.head.appendChild(kf);

window.__renderApp = function () {
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Root));
};
