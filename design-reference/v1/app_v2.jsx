/* ============================================================
   StudioCreation v2 — App Shell
   Kinetic rail (sliding ink), count-up budget, screen
   transitions, toasts, skin system (onyx / volt / lumen).
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
  const idx = NAV.findIndex(n => n.id === s.screen);
  return (
    <aside className="rail">
      {/* brand */}
      <div className="rail-brand">
        <div className="glyph"><window.UIIcon name="bolt" size={16} fill /></div>
        <div className="col" style={{ gap: 1 }}>
          <span className="name">StudioCreation</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--tx-4)" }}>Production cockpit</span>
        </div>
      </div>

      {/* nav */}
      <nav className="rail-nav">
        {idx >= 0 && <span className="nav-ink" style={{ top: idx * 42 }}></span>}
        {NAV.map(n => {
          const on = s.screen === n.id;
          const badge = n.badge === "active" && s.activeCount ? s.activeCount
            : n.badge === "score" && s.needsScoring ? s.needsScoring : null;
          return (
            <button key={n.id} onClick={() => s.setScreen(n.id)} className={`navitem2 ${on ? "on" : ""}`}>
              <span className="row gap3">
                <window.UIIcon name={n.icon} size={17} className="nicon" />
                <span className="nlabel">{n.label}</span>
              </span>
              {badge != null && (
                <span className={`nav-badge ${n.badge === "active" ? "run" : "accent"}`}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="grow"></div>

      {/* budget gauge */}
      <div className="card" style={{ padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="between">
          <span className="t-label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <window.UIIcon name="gauge" size={13} style={{ color: "var(--gold-hi)" }} />Daily budget</span>
          <span className="mono t-xs" style={{ color: budget.pct >= 0.75 ? "var(--warn-tx)" : "var(--tx-2)" }}>
            {Math.round(budget.pct * 100)}%</span>
        </div>
        <window.Gauge used={budget.usedToday} cap={budget.dailyCap} />
        <div className="between" style={{ whiteSpace: "nowrap" }}>
          <window.CountUp className="mono t-xs" style={{ color: "var(--tx-2)" }} value={budget.usedToday} decimals={2} prefix="$" suffix=" used" />
          <window.CountUp className="mono t-xs" style={{ color: "var(--tx-3)" }} value={budget.remaining} decimals={2} prefix="$" suffix=" left" />
        </div>
        {budget.pct >= 0.75 && (
          <div className="row gap2" style={{ fontSize: 10, lineHeight: 1.3, color: "var(--warn-tx)", marginTop: -2 }}>
            <window.UIIcon name="shield" size={11} style={{ flex: "none" }} />75% cap — confirm spends
          </div>
        )}
        <div className="hr" style={{ margin: "2px 0" }}></div>
        <div className="col" style={{ gap: 7 }}>
          <div className="between">
            <span className="row gap2 t-xs"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--fal)" }}></span>fal balance</span>
            <window.CountUp className="mono t-xs" style={{ color: balLow ? "var(--warn-tx)" : "var(--tx-1)" }} value={budget.falBalance} decimals={2} prefix="$" />
          </div>
          <div className="between">
            <span className="row gap2 t-xs"><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--higgs)" }}></span>higgs credits</span>
            <window.CountUp className="mono t-xs" style={{ color: "var(--tx-1)" }} value={budget.higgsCredits} decimals={0} />
          </div>
        </div>
      </div>

      {/* operator */}
      <button className="row between navitem2" style={{ marginTop: 6, height: 44, padding: "0 8px" }}>
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

/* slim global activity ribbon shown when jobs run */
function ActivityRibbon() {
  const s = window.useStudio();
  if (!s.activeCount) return null;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 5, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", height: "100%", width: "30%",
        background: "linear-gradient(90deg, transparent, var(--gold-hi), transparent)",
        animation: "ribbon 1.8s var(--ease-out) infinite" }}></div>
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
          <div key={t.id} className="toast">
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

/* ---- Skins & tweaks ---- */
const SKIN_ACCENT = {
  onyx:  ["#5b6cff", "#8392ff"],
  volt:  ["#c6f222", "#d8ff45"],
  lumen: ["#4655f0", "#6470ff"],
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "skin": "onyx",
  "accent": ["#5b6cff", "#8392ff"],
  "radius": 15,
  "motion": "lively",
  "density": "regular",
  "gallery": "masonry"
}/*EDITMODE-END*/;

function relLum(hex) {
  const c = i => parseInt(hex.slice(i, i + 2), 16) / 255;
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
}

function TweakLayer() {
  const s = window.useStudio();
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = t.skin;
    const st = root.style;
    const [g, ghRaw] = t.accent;
    const gh = t.skin === "lumen" ? `color-mix(in oklab, ${g} 78%, #14151c)` : ghRaw;
    st.setProperty("--gold", g);
    st.setProperty("--gold-hi", gh);
    st.setProperty("--gold-dim", `color-mix(in oklab, ${g} 72%, #000)`);
    st.setProperty("--gold-wash", `color-mix(in oklab, ${g} 13%, transparent)`);
    st.setProperty("--gold-line", `color-mix(in oklab, ${g} 38%, transparent)`);
    st.setProperty("--gold-glow", `color-mix(in oklab, ${g} 30%, transparent)`);
    st.setProperty("--accent-tx", relLum(g) > 0.55 ? "#101207" : "#ffffff");
    st.setProperty("--r-lg", t.radius + "px");
    st.setProperty("--r-md", Math.max(6, t.radius - 4) + "px");
    st.setProperty("--r-sm", Math.max(5, t.radius - 7) + "px");
    st.setProperty("--r-xl", (t.radius + 6) + "px");
    document.body.setAttribute("data-motion", t.motion);
    document.body.setAttribute("data-density", t.density);
  }, [t]);

  React.useEffect(() => { s.setGalleryLayout(t.gallery); }, [t.gallery]);

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection label="Direction" />
      <window.TweakRadio label="Skin" value={t.skin} options={["onyx", "volt", "lumen"]}
        onChange={(v) => setTweak({ skin: v, accent: SKIN_ACCENT[v] })} />
      <window.TweakColor label="Accent" value={t.accent} onChange={(v) => setTweak("accent", v)}
        options={[["#5b6cff", "#8392ff"], ["#c6f222", "#d8ff45"], ["#ff6a3d", "#ff8d63"], ["#9a6bff", "#b28dff"]]} />
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
    <div className="row" style={{ height: "100vh", position: "relative", zIndex: 1, alignItems: "stretch" }}>
      <Sidebar />
      <main style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ActivityRibbon />
        <div key={s.screen} className="grow screen-wrap" style={{ overflow: "auto", position: "relative" }}>
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

window.__renderApp = function () {
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Root));
};
