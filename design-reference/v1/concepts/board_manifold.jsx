/* ============================================================
   Direction E — MANIFOLD
   The studio is a space, not a page. One continuous volume:
   jobs are bodies with position = state, the nav is a minimap,
   telemetry HUD frames the edges. Deep chroma, never near-black.
   Exposes: window.ManifoldHero, window.ManifoldSpecimen
   ============================================================ */

const mfCSS = `
.mf {
  --hi: #EDF3FF;
  --dim: #94A6CE;
  --faint: #5E6FA0;
  --cyan: #5BE3FF;
  --mag: #FF5BD0;
  --coral: #FF7A5C;
  --panel: rgba(20, 26, 64, 0.45);
  --hudline: rgba(160, 190, 255, 0.22);
  font-family: "Saira", sans-serif;
  color: var(--hi);
  width: 100%; height: 100%; position: relative; overflow: hidden;
  background:
    radial-gradient(60% 50% at 22% 30%, rgba(255,91,208,0.16), transparent 60%),
    radial-gradient(55% 45% at 80% 70%, rgba(91,227,255,0.14), transparent 60%),
    radial-gradient(40% 36% at 60% 14%, rgba(130,110,255,0.20), transparent 65%),
    linear-gradient(152deg, #33205E 0%, #232560 38%, #16315E 74%, #14406B 100%);
}
.mf * { box-sizing: border-box; }
.mf-zone-type { font-family: "Big Shoulders Display", sans-serif; font-weight: 700; }
.mf-mono { font-family: "Red Hat Mono", monospace; font-variant-numeric: tabular-nums; }
.mf-iso {
  position: absolute; inset: -30%; pointer-events: none; opacity: 0.35;
  background:
    repeating-radial-gradient(circle at 30% 40%, transparent 0 70px, rgba(170,200,255,0.07) 70px 71px),
    repeating-radial-gradient(circle at 75% 65%, transparent 0 90px, rgba(170,200,255,0.05) 90px 91px);
}
.mf-ghost {
  position: absolute; pointer-events: none; user-select: none;
  font-family: "Big Shoulders Display", sans-serif; font-weight: 800;
  color: transparent; -webkit-text-stroke: 1.5px rgba(170,200,255,0.13);
  letter-spacing: 0.06em; line-height: 1;
}

/* HUD corners */
.mf-hud-tl { position: absolute; top: 24px; left: 28px; z-index: 5; }
.mf-hud-tl .word { font-family: "Big Shoulders Display", sans-serif; font-weight: 800; font-size: 26px; letter-spacing: 0.08em; }
.mf-hud-tl .word span { color: var(--cyan); }
.mf-hud-tl .crumb { font-size: 10.5px; letter-spacing: 0.26em; color: var(--dim); margin-top: 4px; }
.mf-hud-tr { position: absolute; top: 22px; right: 28px; z-index: 5; display: flex; gap: 18px; align-items: center; }
.mf-gauge { width: 64px; height: 64px; border-radius: 50%; position: relative;
  background: conic-gradient(var(--coral) 0 227deg, rgba(170,200,255,0.15) 227deg 360deg); }
.mf-gauge::before { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: #1D2456; }
.mf-gauge span { position: absolute; inset: 0; display: grid; place-items: center; font-family: "Red Hat Mono", monospace; font-size: 11px; color: var(--hi); }
.mf-hud-tr .figs { font-size: 10.5px; line-height: 1.8; color: var(--dim); text-align: right; letter-spacing: 0.08em; }
.mf-hud-tr .figs b { color: var(--hi); font-weight: 600; }
.mf-hud-tr .figs .warn { color: var(--coral); }

/* minimap = nav */
.mf-map {
  position: absolute; left: 28px; bottom: 24px; z-index: 5; width: 312px;
  background: var(--panel); backdrop-filter: blur(14px);
  border: 1px solid var(--hudline); border-radius: 10px; padding: 12px 14px;
}
.mf-map .lbl { font-size: 9.5px; letter-spacing: 0.3em; color: var(--dim); margin-bottom: 9px; }
.mf-map-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.mf-map-cell {
  border: 1px solid var(--hudline); border-radius: 6px; padding: 8px 9px; cursor: pointer;
  font-size: 10px; letter-spacing: 0.18em; color: var(--dim); position: relative;
}
.mf-map-cell.on { border-color: var(--cyan); color: var(--hi); box-shadow: 0 0 14px -4px rgba(91,227,255,0.6), inset 0 0 10px -6px rgba(91,227,255,0.8); }
.mf-map-cell .dotrow { display: flex; gap: 3px; margin-top: 5px; }
.mf-map-cell .dotrow i { width: 4px; height: 4px; border-radius: 50%; background: var(--faint); }
.mf-map-cell.on .dotrow i { background: var(--cyan); }
.mf-map-cell .dotrow i.live { background: var(--mag); }

/* bodies in space */
.mf-body { position: absolute; }
.mf-orb { width: 96px; height: 96px; border-radius: 50%; position: relative;
  background: radial-gradient(circle at 34% 28%, rgba(255,255,255,0.85), var(--c1) 35%, var(--c2) 75%);
  box-shadow: 0 0 50px -6px var(--c2), 0 0 110px -20px var(--c2);
}
.mf-orb.small { width: 64px; height: 64px; }
.mf-ring { position: absolute; inset: -11px; border-radius: 50%;
  background: conic-gradient(var(--cyan) 0 calc(var(--p) * 360deg), rgba(170,200,255,0.14) calc(var(--p) * 360deg) 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px));
}
.mf-ring::after { content: ""; position: absolute; left: 50%; top: -2px; width: 7px; height: 7px; margin-left: -3px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px 2px var(--cyan); transform-origin: 50% calc(50% + 2px); }
.mf-callout { position: absolute; min-width: 218px; }
.mf-callout .ln { position: absolute; background: var(--hudline); }
.mf-callout .card {
  background: var(--panel); backdrop-filter: blur(12px); border: 1px solid var(--hudline);
  border-radius: 8px; padding: 9px 12px;
}
.mf-callout .id { font-family: "Red Hat Mono", monospace; font-size: 9px; letter-spacing: 0.2em; color: var(--cyan); margin-bottom: 4px; }
.mf-callout .id .st { color: var(--mag); }
.mf-callout p { margin: 0 0 5px; font-size: 12px; line-height: 1.4; color: var(--hi); font-weight: 500; }
.mf-callout .tel { font-family: "Red Hat Mono", monospace; font-size: 9.5px; color: var(--dim); display: flex; gap: 10px; }
.mf-callout .tel b { color: var(--hi); font-weight: 500; }

/* shipped gems */
.mf-gem { position: absolute; width: 44px; height: 44px; border-radius: 12px; transform: rotate(45deg);
  background: linear-gradient(140deg, var(--c1), var(--c2));
  box-shadow: 0 0 24px -4px var(--c2); }
.mf-gem span { position: absolute; inset: 0; display: grid; place-items: center; transform: rotate(-45deg);
  font-family: "Red Hat Mono", monospace; font-size: 12px; font-weight: 600; color: #fff; text-shadow: 0 1px 6px rgba(0,0,40,0.5); }
.mf-gem.ten { box-shadow: 0 0 30px 2px var(--c2), 0 0 60px -8px #fff; outline: 1.5px solid rgba(255,255,255,0.85); outline-offset: 3px; }

/* forge */
.mf-forge {
  position: absolute; right: 28px; bottom: 24px; z-index: 5; width: 396px;
  background: var(--panel); backdrop-filter: blur(16px);
  border: 1px solid var(--hudline); border-radius: 12px; padding: 16px 18px;
}
.mf-forge .lbl { font-size: 9.5px; letter-spacing: 0.3em; color: var(--dim); display: flex; justify-content: space-between; margin-bottom: 10px; }
.mf-forge .lbl b { color: var(--cyan); font-weight: 500; }
.mf-prompt { border: 1px solid var(--hudline); border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.45; color: var(--hi); background: rgba(10,14,40,0.3); }
.mf-prompt .caret { color: var(--cyan); }
.mf-chips { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; }
.mf-chip { border: 1px solid var(--hudline); border-radius: 6px; padding: 5px 9px; font-size: 10px; letter-spacing: 0.1em; color: var(--dim); }
.mf-chip b { color: var(--hi); font-weight: 600; }
.mf-chip.sel { border-color: var(--mag); color: var(--hi); box-shadow: inset 0 0 12px -6px var(--mag); }
.mf-cost { display: flex; align-items: baseline; justify-content: space-between; padding: 8px 2px 10px; }
.mf-cost .k { font-size: 9.5px; letter-spacing: 0.28em; color: var(--dim); }
.mf-cost .v { font-family: "Red Hat Mono", monospace; font-size: 40px; font-weight: 600; letter-spacing: -0.02em; }
.mf-cost .v small { font-size: 13px; color: var(--dim); font-weight: 400; }
.mf-arm { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; border-top: 1px solid var(--hudline); padding-top: 12px; }
.mf-switch { width: 52px; height: 28px; border-radius: 16px; border: 1.5px solid var(--coral); position: relative; cursor: pointer; }
.mf-switch i { position: absolute; top: 2.5px; left: 2.5px; width: 19px; height: 19px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 12px var(--coral); }
.mf-arm p { margin: 0; font-size: 10.5px; line-height: 1.5; color: var(--dim); }
.mf-arm p b { color: var(--coral); font-weight: 600; }
.mf-commit {
  margin-top: 11px; width: 100%; border: none; border-radius: 8px; padding: 12px; cursor: pointer;
  font-family: "Saira", sans-serif; font-weight: 700; font-size: 12.5px; letter-spacing: 0.24em; text-transform: uppercase;
  color: #1A1040; background: linear-gradient(100deg, var(--cyan), #8FB7FF);
  box-shadow: 0 8px 30px -8px rgba(91,227,255,0.65);
}
.mf-commit small { display: block; font-size: 8.5px; letter-spacing: 0.18em; margin-top: 3px; opacity: 0.75; font-weight: 600; }

/* axis labels */
.mf-axis { position: absolute; font-size: 9px; letter-spacing: 0.34em; color: var(--faint); }

/* specimen */
.mf-spec { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; padding: 30px 32px; height: 100%; position: relative; z-index: 2; }
.mf-spec-col { background: var(--panel); backdrop-filter: blur(14px); border: 1px solid var(--hudline); border-radius: 12px; padding: 26px 28px; display: flex; flex-direction: column; }
.mf-spec-kick { font-size: 9.5px; letter-spacing: 0.34em; color: var(--cyan); margin-bottom: 14px; }
.mf-spec-xl { font-family: "Big Shoulders Display", sans-serif; font-weight: 800; font-size: 68px; line-height: 1; letter-spacing: 0.02em; margin: 2px 0 14px; }
.mf-spec-sub { font-size: 17px; font-weight: 600; margin: 0 0 12px; color: var(--mag); }
.mf-spec-body { font-size: 13px; line-height: 1.65; color: var(--dim); }
.mf-spec-body b { color: var(--hi); font-weight: 600; }
.mf-chipsbox { display: grid; gap: 8px; margin-top: 12px; }
.mf-cchip { display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 12px; border: 1px solid var(--hudline); border-radius: 8px; padding: 6px; }
.mf-cchip .sw { height: 36px; border-radius: 5px; }
.mf-cchip .nm { font-size: 12px; font-weight: 600; color: var(--hi); }
.mf-cchip .hx { font-family: "Red Hat Mono", monospace; font-size: 9px; color: var(--dim); padding-right: 8px; }
.mf-spec-note { font-size: 11px; color: var(--dim); margin-top: auto; line-height: 1.6; padding-top: 14px; }
`;

function MFBody({ x, y, c1, c2, p, small, callout, calloutPos }) {
  return (
    <div className="mf-body" style={{ left: x, top: y }}>
      <div className={"mf-orb" + (small ? " small" : "")} style={{ "--c1": c1, "--c2": c2 }}>
        {p != null && <span className="mf-ring" style={{ "--p": p }}></span>}
      </div>
      {callout && (
        <div className="mf-callout" style={calloutPos}>
          <span className="ln" style={callout.ln}></span>
          <div className="card">
            <div className="id">{callout.id} <span className="st">{callout.st}</span></div>
            <p>{callout.text}</p>
            <div className="tel">{callout.tel.map((t, i) => <span key={i}>{t}</span>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManifoldHero() {
  return (
    <div className="mf">
      <style>{mfCSS}</style>
      <div className="mf-iso"></div>

      <span className="mf-ghost" style={{ fontSize: 200, left: 360, top: 100 }}>QUEUE</span>
      <span className="mf-ghost" style={{ fontSize: 150, right: 90, top: 270 }}>SHIPPED</span>
      <span className="mf-ghost" style={{ fontSize: 110, left: 400, bottom: 110 }}>FORGE</span>

      <div className="mf-hud-tl">
        <div className="word mf-zone-type">MANIFOLD <span>// STUDIOCREATION</span></div>
        <div className="crumb mf-mono">SECTOR: PRODUCTION · X 412 / Y −80 · ZOOM 1.0</div>
      </div>

      <div className="mf-hud-tr">
        <div className="figs mf-mono">
          BUDGET <b>$2.76</b> / $7.50<br/>
          BURN <span className="warn">$4.74</span> · RATE $1.18/h<br/>
          FAL <b>$18.30</b> · HIGGS <b>240</b>
        </div>
        <div className="mf-gauge"><span>63%</span></div>
      </div>

      <span className="mf-axis" style={{ left: "47%", top: 96 }}>── DRAFT → SHIPPED ──→</span>

      <MFBody x={430} y={250} c1="#FFB38A" c2="#E0512F" p={0.62}
        callout={{ id: "BODY 801 · KLING 3 PRO · 21:9 · 6s", st: "RENDERING 62%", text: "Anamorphic stadium tunnel, players emerging into floodlight haze", tel: [<span key="a">0:47/<b>1:15</b></span>, <b key="b">$0.84</b>, "OP AR"] }}
        calloutPos={{ left: 116, top: -34 }} />
      <MFBody x={620} y={460} c1="#C5FF9E" c2="#3E9E3C" p={0.34}
        callout={{ id: "BODY 802 · GPT IMAGE 2 · ×4", st: "RENDERING 34%", text: "Squad value infographic — legible figures, 4:5", tel: [<span key="a">0:07/<b>0:22</b></span>, <b key="b">$0.24</b>, "OP JN"] }}
        calloutPos={{ left: 112, top: 6 }} />
      <MFBody x={300} y={420} c1="#9ED8E8" c2="#27708A" p={0} small
        callout={{ id: "BODY 803 · NANO BANANA · ×6", st: "HOLDING", text: "StrikeLab driver head turnaround", tel: [<b key="b">$0.23</b>, "OP AR"] }}
        calloutPos={{ left: -240, top: 4 }} />
      <MFBody x={350} y={580} c1="#D8B5FF" c2="#7B3FBF" p={0} small
        callout={{ id: "BODY 804 · SEEDANCE · 9:16 · 4s", st: "HOLDING", text: "Kinetic title card: GROUP STAGE", tel: [<b key="b">$0.20</b>, "OP MK"] }}
        calloutPos={{ left: -250, top: 10 }} />

      {/* shipped cluster */}
      <div className="mf-gem ten" style={{ right: 218, top: 420, "--c1": "#B6FFD9", "--c2": "#1F9E68" }}><span>10</span></div>
      <div className="mf-gem" style={{ right: 150, top: 480, "--c1": "#FFD0A8", "--c2": "#D06A2F" }}><span>9</span></div>
      <div className="mf-gem" style={{ right: 280, top: 500, "--c1": "#F2BCFF", "--c2": "#A03FB8" }}><span>9</span></div>
      <div className="mf-gem" style={{ right: 200, top: 545, "--c1": "#B8DCFF", "--c2": "#2F6BC0" }}><span>7</span></div>
      <div className="mf-gem" style={{ right: 130, top: 395, "--c1": "#FFE9A8", "--c2": "#B08A2F", opacity: 0.55 }}><span>6</span></div>

      <nav className="mf-map">
        <div className="lbl mf-mono">MINIMAP — CLICK TO FLY</div>
        <div className="mf-map-grid">
          {[["COMPOSE", 0], ["QUEUE", 4, true], ["LIBRARY", 6], ["LEDGER", 2], ["BRIEFS", 1], ["HANDOFF", 1]].map(([n, dots, live], i) => (
            <span key={n} className={"mf-map-cell" + (n === "QUEUE" ? " on" : "")}>
              {n}
              <span className="dotrow">{Array.from({ length: dots }).map((_, j) => <i key={j} className={live && j < 2 ? "live" : ""}></i>)}</span>
            </span>
          ))}
        </div>
      </nav>

      <section className="mf-forge">
        <div className="lbl mf-mono"><span>FORGE — NEW BODY</span><b>DOCKET 0805 · STARXI</b></div>
        <div className="mf-prompt">StarXI captain figurine, deep green kit, studio rim light, collectible gloss<span className="caret">▎</span></div>
        <div className="mf-chips">
          <span className="mf-chip sel"><b>KLING 3 PRO</b> $0.14/s</span>
          <span className="mf-chip">VEO 3.1 $0.12/s</span>
          <span className="mf-chip"><b>6s</b> × 2</span>
          <span className="mf-chip">16:9</span>
        </div>
        <div className="mf-cost"><span className="k">MASS TO COMMIT</span><span className="v">$1.84<small> / $2.76 left</small></span></div>
        <div className="mf-arm">
          <span className="mf-switch"><i></i></span>
          <p>Over <b>$1.25</b> the forge must be <b>ARMED</b> first. Two deliberate acts — arm, then commit. Disarms itself in 5s.</p>
        </div>
        <button className="mf-commit">COMMIT $1.84 TO THE MANIFOLD<small>ARMED · SPAWNS AT QUEUE X-AXIS ORIGIN</small></button>
      </section>
    </div>
  );
}

function ManifoldSpecimen() {
  return (
    <div className="mf">
      <style>{mfCSS}</style>
      <div className="mf-iso"></div>
      <div className="mf-spec">
        <div className="mf-spec-col">
          <div className="mf-spec-kick mf-mono">DIRECTION E</div>
          <div className="mf-spec-xl">MANIFOLD</div>
          <div className="mf-spec-sub">The studio is a space, not a page.</div>
          <p className="mf-spec-body">
            One continuous navigable volume. Jobs are <b>bodies</b> with position as state —
            they spawn at the left, drift right as they render, and crystallize into scored
            gems when shipped. There are no screens to switch between: the <b>minimap is the
            nav</b>, and you fly. Telemetry HUD pins the corners; giant ghost type names the
            zones from inside the space itself.
          </p>
          <div className="mf-spec-note">
            Compose → Forge · Queue → live bodies · Gallery → shipped cluster · Costs → Ledger zone.
            Deep chroma field — violet into teal — never near-black, never grey.
          </div>
        </div>
        <div className="mf-spec-col">
          <div className="mf-spec-kick mf-mono">TYPE</div>
          <div className="mf-spec-xl" style={{ fontSize: 44 }}>BIG SHOULDERS</div>
          <p className="mf-spec-sub" style={{ fontFamily: '"Saira", sans-serif', fontSize: 15 }}>Saira for reading · Red Hat Mono for telemetry</p>
          <p className="mf-spec-body">
            Big Shoulders is the zone signage — engineered, condensed, only ever huge or ghosted.
            Saira (a true multi-width family) does the working text. Everything that measures —
            money, time, coordinates — is mono.
          </p>
          <p className="mf-spec-body mf-mono" style={{ fontSize: 11, lineHeight: 2 }}>
            RED HAT MONO · X 412 / Y −80<br/>$0.14/s · 0:47/1:15 · BURN $4.74
          </p>
          <div className="mf-spec-note">Scale: 200 ghost / 92 / 40 mono / 13 body / 9.5 HUD caps.</div>
        </div>
        <div className="mf-spec-col">
          <div className="mf-spec-kick mf-mono">FIELD &amp; SIGNALS</div>
          <div className="mf-chipsbox">
            <div className="mf-cchip"><span className="sw" style={{ background: "linear-gradient(140deg,#33205E,#14406B)" }}></span><span className="nm">The volume</span><span className="hx">33205E→14406B</span></div>
            <div className="mf-cchip"><span className="sw" style={{ background: "#5BE3FF" }}></span><span className="nm">Cyan — progress &amp; focus</span><span className="hx">#5BE3FF</span></div>
            <div className="mf-cchip"><span className="sw" style={{ background: "#FF5BD0" }}></span><span className="nm">Magenta — live state</span><span className="hx">#FF5BD0</span></div>
            <div className="mf-cchip"><span className="sw" style={{ background: "#FF7A5C" }}></span><span className="nm">Coral — money at risk</span><span className="hx">#FF7A5C</span></div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="mf-spec-kick mf-mono">THE WEIGHTY MOMENT</div>
            <div className="mf-arm" style={{ borderTop: "none", paddingTop: 2 }}>
              <span className="mf-switch"><i></i></span>
              <p>Over <b>$1.25</b>: <b>ARM</b>, then commit. The switch self-disarms in 5 seconds — hesitation costs nothing.</p>
            </div>
          </div>
          <div className="mf-spec-note">Motion: bodies drift along the state axis, rings sweep, gems crystallize with a flash; the camera glides — nothing cuts.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ManifoldHero, ManifoldSpecimen });
