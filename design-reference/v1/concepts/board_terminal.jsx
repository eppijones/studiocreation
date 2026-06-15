/* ============================================================
   Direction B — TERMINAL ONE
   The studio as a grand rail terminal. Jobs are departures on a
   split-flap board; models are platforms with posted fares; the
   composer is a ticket window; >$1.25 is fare control.
   Exposes: window.TerminalHero, window.TerminalSpecimen
   ============================================================ */

const t1CSS = `
.t1 {
  --hall: #EDEAE1;
  --hall-deep: #E2DED2;
  --enamel: #1E3A5F;
  --enamel-deep: #162C49;
  --flap: #F4F1E6;
  --flap-dim: #9FB0C6;
  --ink: #20242B;
  --ink-soft: #5A6170;
  --sigred: #C8402F;
  --line-s: #1E7A4E;
  --line-k: #2E7E8C;
  font-family: "Familjen Grotesk", sans-serif;
  background: var(--hall);
  color: var(--ink);
  width: 100%; height: 100%; position: relative; overflow: hidden;
}
.t1 * { box-sizing: border-box; }
.t1-sign { font-family: "Anton", sans-serif; font-weight: 400; letter-spacing: 0.02em; }
.t1-mono { font-family: "Martian Mono", monospace; font-variant-numeric: tabular-nums; }
.t1-floor {
  position: absolute; inset: 0; pointer-events: none;
  background-image: repeating-linear-gradient(90deg, rgba(32,36,43,0.03) 0 1px, transparent 1px 120px);
}

/* hall header */
.t1-head {
  display: flex; align-items: stretch; justify-content: space-between;
  padding: 0 40px; height: 92px; border-bottom: 4px solid var(--ink);
  background: var(--hall);
}
.t1-brandsign {
  display: flex; align-items: center; gap: 16px;
}
.t1-roundel {
  width: 52px; height: 52px; border-radius: 50%; border: 5px solid var(--enamel);
  display: grid; place-items: center; position: relative;
}
.t1-roundel::after { content: ""; position: absolute; left: -10px; right: -10px; height: 12px; background: var(--sigred); }
.t1-roundel span { position: relative; z-index: 1; color: #fff; font-size: 10px; font-family: "Anton", sans-serif; }
.t1-brandsign h1 { margin: 0; font-size: 34px; line-height: 1; text-transform: uppercase; }
.t1-brandsign h1 small { display: block; font-family: "Familjen Grotesk", sans-serif; font-size: 11px; letter-spacing: 0.34em; color: var(--ink-soft); margin-top: 3px; }
.t1-way { display: flex; align-items: center; gap: 6px; }
.t1-way-chip {
  background: var(--enamel); color: var(--flap); padding: 8px 13px 8px 11px;
  font-size: 12.5px; letter-spacing: 0.05em; text-transform: uppercase;
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
}
.t1-way-chip.on { background: var(--sigred); }
.t1-way-chip .num { font-family: "Martian Mono", monospace; font-size: 10px; opacity: 0.7; }
.t1-clockface { display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 2px; }
.t1-clockface .tm { font-size: 26px; font-family: "Martian Mono", monospace; font-weight: 600; }
.t1-clockface .dt { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-soft); }

/* departures board */
.t1-board {
  margin: 26px 40px 0; background: var(--enamel);
  border: 3px solid var(--enamel-deep);
  box-shadow: 0 18px 40px -18px rgba(22,44,73,0.55), inset 0 1px 0 rgba(244,241,230,0.18);
}
.t1-board-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 22px; border-bottom: 2px solid var(--enamel-deep);
}
.t1-board-head h2 { margin: 0; color: var(--flap); font-size: 24px; text-transform: uppercase; letter-spacing: 0.08em; }
.t1-board-head .live { color: var(--flap); font-size: 11px; letter-spacing: 0.18em; display: flex; align-items: center; gap: 8px; }
.t1-board-head .live i { width: 9px; height: 9px; border-radius: 50%; background: #6FCF8E; display: inline-block; animation: t1blink 1.4s infinite; }
@keyframes t1blink { 50% { opacity: 0.25; } }
.t1-cols {
  display: grid; grid-template-columns: 84px 1fr 96px 150px 170px 96px;
  gap: 0 14px; padding: 8px 22px 6px; color: var(--flap-dim);
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  font-family: "Martian Mono", monospace;
}
.t1-dep {
  display: grid; grid-template-columns: 84px 1fr 96px 150px 170px 96px;
  gap: 0 14px; padding: 11px 22px; align-items: center;
  border-top: 1px solid rgba(244,241,230,0.12);
}
.t1-flap { display: inline-flex; gap: 2px; }
.t1-flap b {
  display: inline-block; min-width: 15px; padding: 3px 1px; text-align: center;
  background: var(--enamel-deep); color: var(--flap);
  font-family: "Martian Mono", monospace; font-size: 12px; font-weight: 500;
  border-radius: 2px; position: relative;
}
.t1-flap b::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,0.45); }
.t1-dep .svc { color: var(--flap); font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t1-dep .svc small { display: block; color: var(--flap-dim); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; }
.t1-linedot { display: inline-flex; align-items: center; gap: 7px; color: var(--flap); font-size: 12px; }
.t1-linedot i { width: 14px; height: 14px; border-radius: 50%; display: inline-block; border: 2px solid var(--flap); }
.t1-plat { color: var(--flap); font-size: 12px; font-family: "Martian Mono", monospace; }
.t1-plat small { display: block; color: var(--flap-dim); font-size: 9.5px; margin-top: 2px; }
.t1-status { font-family: "Martian Mono", monospace; font-size: 11px; letter-spacing: 0.06em; }
.t1-status.go { color: #6FCF8E; }
.t1-status.hold { color: var(--flap-dim); }
.t1-status .bar { display: block; height: 4px; background: rgba(244,241,230,0.16); margin-top: 5px; position: relative; }
.t1-status .bar i { position: absolute; inset: 0 auto 0 0; background: #6FCF8E; }
.t1-fare { text-align: right; color: var(--flap); font-family: "Martian Mono", monospace; font-size: 13px; }

/* lower hall */
.t1-lower { display: grid; grid-template-columns: 1fr 470px; gap: 28px; padding: 26px 40px 0; }

/* fare schedule */
.t1-fares h3, .t1-ticketwrap h3 {
  margin: 0 0 12px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em;
  display: flex; align-items: center; gap: 12px;
}
.t1-fares h3::after, .t1-ticketwrap h3::after { content: ""; flex: 1; height: 4px; background: var(--ink); }
.t1-fare-table { border: 2px solid var(--ink); background: #F6F4EC; }
.t1-fare-row {
  display: grid; grid-template-columns: 54px 1fr 120px 110px; align-items: center;
  border-bottom: 1px solid var(--hall-deep); padding: 9px 14px 9px 0; cursor: pointer;
}
.t1-fare-row:last-child { border-bottom: none; }
.t1-fare-row.sel { background: var(--enamel); color: var(--flap); }
.t1-fare-row .pl {
  font-family: "Anton", sans-serif; font-size: 19px; text-align: center;
}
.t1-fare-row .nm { font-size: 14.5px; font-weight: 600; }
.t1-fare-row .nm small { display: block; font-weight: 400; font-size: 11px; opacity: 0.65; letter-spacing: 0.04em; text-transform: uppercase; }
.t1-fare-row .tier { font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.7; font-family: "Martian Mono", monospace; }
.t1-fare-row .pr { text-align: right; font-family: "Martian Mono", monospace; font-size: 13px; }
.t1-allow { margin-top: 16px; border: 2px solid var(--ink); background: #F6F4EC; padding: 13px 16px; display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; align-items: center; }
.t1-allow .lbl { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-soft); }
.t1-allow .big { font-family: "Martian Mono", monospace; font-size: 22px; font-weight: 600; grid-row: span 2; align-self: center; }
.t1-allow .track { grid-column: 1; height: 10px; border: 1.5px solid var(--ink); position: relative; background: #fff; }
.t1-allow .track i { position: absolute; inset: 1px auto 1px 1px; width: 63.2%; background: repeating-linear-gradient(135deg, var(--enamel) 0 6px, var(--line-k) 6px 12px); }

/* ticket window */
.t1-ticket {
  background: #FBF9F1; border: 2px solid var(--ink); position: relative;
  padding: 18px 20px 16px 20px;
}
.t1-ticket::before, .t1-ticket::after {
  content: ""; position: absolute; top: -2px; bottom: -2px; width: 14px;
  background-image: radial-gradient(circle at 50% 8px, var(--hall) 5px, transparent 5.5px);
  background-size: 14px 22px; background-repeat: repeat-y;
}
.t1-ticket::before { left: -8px; }
.t1-ticket::after { right: -8px; }
.t1-ticket-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px dashed var(--ink); padding-bottom: 10px; }
.t1-ticket-head .cls { font-family: "Anton", sans-serif; font-size: 20px; text-transform: uppercase; }
.t1-ticket-head .no { font-family: "Martian Mono", monospace; font-size: 11px; color: var(--ink-soft); }
.t1-ticket-route { padding: 13px 0 11px; border-bottom: 1px solid var(--hall-deep); }
.t1-ticket-route .from-to { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; }
.t1-ticket-route .from-to .arr { color: var(--sigred); font-family: "Anton", sans-serif; }
.t1-ticket-route p { margin: 8px 0 0; font-size: 13px; line-height: 1.45; color: var(--ink-soft); }
.t1-ticket-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--hall-deep); }
.t1-ticket-grid .cell .k { font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); }
.t1-ticket-grid .cell .v { font-family: "Martian Mono", monospace; font-size: 13px; margin-top: 3px; }
.t1-ticket-fare { display: flex; justify-content: space-between; align-items: center; padding: 13px 0 4px; }
.t1-ticket-fare .lbl { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-soft); }
.t1-ticket-fare .amt { font-family: "Anton", sans-serif; font-size: 44px; }
.t1-gate {
  margin-top: 10px; border: 2.5px solid var(--sigred); background: rgba(200,64,47,0.07);
  padding: 11px 14px; display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center;
}
.t1-gate .barrier { font-family: "Anton", sans-serif; color: var(--sigred); font-size: 13px; letter-spacing: 0.1em; white-space: nowrap; }
.t1-gate p { margin: 0; font-size: 12px; line-height: 1.4; color: var(--ink); min-width: 0; }
.t1-issue {
  margin-top: 12px; width: 100%; background: var(--ink); color: var(--hall);
  font-family: "Anton", sans-serif; font-size: 19px; letter-spacing: 0.14em; text-transform: uppercase;
  padding: 14px 0; text-align: center; cursor: pointer; border: none;
}
.t1-issue small { display: block; font-family: "Martian Mono", monospace; font-size: 9px; letter-spacing: 0.2em; margin-top: 4px; opacity: 0.7; }

/* specimen */
.t1-spec { display: grid; grid-template-columns: 1fr 1fr 1fr; height: 100%; }
.t1-spec-col { padding: 34px 36px; border-right: 2px solid var(--ink); display: flex; flex-direction: column; }
.t1-spec-col:last-child { border-right: none; }
.t1-spec-kick { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--sigred); font-family: "Martian Mono", monospace; margin-bottom: 14px; }
.t1-spec-xl { font-size: 84px; line-height: 0.96; text-transform: uppercase; margin: 6px 0 10px; }
.t1-spec-sub { font-size: 20px; font-weight: 600; margin: 0 0 14px; }
.t1-spec-body { font-size: 15px; line-height: 1.55; max-width: 36ch; }
.t1-chips { border: 2px solid var(--ink); margin-top: 12px; }
.t1-chip { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; border-bottom: 2px solid var(--ink); }
.t1-chip:last-child { border-bottom: none; }
.t1-chip .sw { height: 50px; border-right: 2px solid var(--ink); }
.t1-chip .nm { padding: 0 14px; font-size: 14px; font-weight: 600; }
.t1-chip .hx { padding: 0 14px; font-family: "Martian Mono", monospace; font-size: 10.5px; color: var(--ink-soft); }
.t1-spec-note { font-size: 13px; color: var(--ink-soft); margin-top: auto; line-height: 1.5; }
`;

function T1Flap({ text }) {
  return <span className="t1-flap">{text.split("").map((c, i) => <b key={i}>{c === " " ? "\u00A0" : c}</b>)}</span>;
}

function TerminalHero() {
  return (
    <div className="t1">
      <style>{t1CSS}</style>
      <div className="t1-floor"></div>

      <header className="t1-head">
        <div className="t1-brandsign">
          <div className="t1-roundel"><span>SC</span></div>
          <h1 className="t1-sign">Terminal One<small>STUDIOCREATION · ALL SERVICES</small></h1>
        </div>
        <div className="t1-way">
          <span className="t1-way-chip on">Concourse <span className="num">01</span></span>
          <span className="t1-way-chip">Ticketing <span className="num">02</span></span>
          <span className="t1-way-chip">Departures <span className="num">03</span></span>
          <span className="t1-way-chip">Arrivals <span className="num">04</span></span>
          <span className="t1-way-chip">Fares <span className="num">05</span></span>
          <span className="t1-way-chip">Timetables <span className="num">06</span></span>
          <span className="t1-way-chip">Customs <span className="num">07</span></span>
        </div>
        <div className="t1-clockface">
          <span className="tm">16:47</span>
          <span className="dt">Thu 12 Jun 2026</span>
        </div>
      </header>

      <section className="t1-board">
        <div className="t1-board-head">
          <h2 className="t1-sign">Departures</h2>
          <span className="live t1-mono"><i></i>2 SERVICES RUNNING · 2 HELD</span>
        </div>
        <div className="t1-cols"><span>Sched</span><span>Service</span><span>Line</span><span>Platform</span><span>Status</span><span style={{textAlign:"right"}}>Fare</span></div>
        <div className="t1-dep">
          <T1Flap text="16:42" />
          <div className="svc">Anamorphic stadium tunnel, slow dolly push<small>Hero Director · 21:9 · 6s</small></div>
          <span className="t1-linedot"><i style={{background:"var(--line-s)"}}></i>S</span>
          <div className="t1-plat">KLING 3 PRO<small>PLATFORM 7 · $0.14/s</small></div>
          <div className="t1-status go">EN ROUTE 62%<span className="bar"><i style={{width:"62%"}}></i></span></div>
          <div className="t1-fare">$0.84</div>
        </div>
        <div className="t1-dep">
          <T1Flap text="16:45" />
          <div className="svc">Squad value infographic ×4, legible figures<small>Infographic Builder · 4:5</small></div>
          <span className="t1-linedot"><i style={{background:"var(--line-s)"}}></i>S</span>
          <div className="t1-plat">GPT IMAGE 2<small>PLATFORM 4 · $0.06/img</small></div>
          <div className="t1-status go">EN ROUTE 34%<span className="bar"><i style={{width:"34%"}}></i></span></div>
          <div className="t1-fare">$0.24</div>
        </div>
        <div className="t1-dep">
          <T1Flap text="16:55" />
          <div className="svc">StrikeLab driver head turnaround ×6<small>Reference Sheets · 4:3</small></div>
          <span className="t1-linedot"><i style={{background:"var(--line-k)"}}></i>K</span>
          <div className="t1-plat">NANO BANANA<small>PLATFORM 3 · $0.039/img</small></div>
          <div className="t1-status hold">WAIT — BOARDING</div>
          <div className="t1-fare">$0.23</div>
        </div>
        <div className="t1-dep">
          <T1Flap text="17:02" />
          <div className="svc">Kinetic title card: GROUP STAGE<small>Typography Animator · 9:16 · 4s</small></div>
          <span className="t1-linedot"><i style={{background:"var(--line-s)"}}></i>S</span>
          <div className="t1-plat">SEEDANCE 1.0<small>PLATFORM 5 · $0.05/s</small></div>
          <div className="t1-status hold">WAIT — BOARDING</div>
          <div className="t1-fare">$0.20</div>
        </div>
      </section>

      <div className="t1-lower">
        <section className="t1-fares">
          <h3 className="t1-sign">Fare Schedule</h3>
          <div className="t1-fare-table">
            <div className="t1-fare-row"><span className="pl">1</span><div className="nm">FLUX schnell<small>draft pass · ~6s</small></div><span className="tier">FAST</span><span className="pr">$0.004/img</span></div>
            <div className="t1-fare-row"><span className="pl">2</span><div className="nm">FLUX dev<small>balanced quality · ~14s</small></div><span className="tier">STD</span><span className="pr">$0.025/img</span></div>
            <div className="t1-fare-row"><span className="pl">4</span><div className="nm">GPT Image 2<small>best text rendering · ~22s</small></div><span className="tier">PRO</span><span className="pr">$0.06/img</span></div>
            <div className="t1-fare-row sel"><span className="pl">7</span><div className="nm">Kling 3 Pro<small>premium motion · ~75s</small></div><span className="tier">PRO</span><span className="pr">$0.14/s</span></div>
            <div className="t1-fare-row"><span className="pl">8</span><div className="nm">Veo 3.1<small>cinematic, native audio · ~70s</small></div><span className="tier">PRO</span><span className="pr">$0.12/s</span></div>
          </div>
          <div className="t1-allow">
            <span className="lbl">Daily travel allowance — $4.74 spent of $7.50</span>
            <span className="big t1-mono">$2.76</span>
            <span className="track"><i></i></span>
          </div>
        </section>

        <section className="t1-ticketwrap">
          <h3 className="t1-sign">Ticket Window</h3>
          <div className="t1-ticket">
            <div className="t1-ticket-head">
              <span className="cls">Single · Pro Class</span>
              <span className="no">TKT 0805-A · OP AR</span>
            </div>
            <div className="t1-ticket-route">
              <div className="from-to">PROMPT <span className="arr">→</span> RENDER</div>
              <p>StarXI captain figurine, deep green kit, studio rim light, collectible gloss</p>
            </div>
            <div className="t1-ticket-grid">
              <div className="cell"><div className="k">Platform</div><div className="v">7 · KLING 3</div></div>
              <div className="cell"><div className="k">Duration</div><div className="v">6s × 2</div></div>
              <div className="cell"><div className="k">Ratio</div><div className="v">16:9</div></div>
              <div className="cell"><div className="k">Line</div><div className="v">S · STARXI</div></div>
            </div>
            <div className="t1-ticket-fare">
              <span className="lbl">Fare due</span>
              <span className="amt t1-sign">$1.84</span>
            </div>
            <div className="t1-gate">
              <span className="barrier">⊘ FARE<br/>CONTROL</span>
              <p>Fares above <b>$1.25</b> stop at the gate. The barrier lifts only on a second, deliberate press.</p>
            </div>
            <button className="t1-issue">Issue Ticket — $1.84<small>HOLD TO PASS FARE CONTROL</small></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function TerminalSpecimen() {
  return (
    <div className="t1">
      <style>{t1CSS}</style>
      <div className="t1-spec">
        <div className="t1-spec-col">
          <div className="t1-spec-kick">Direction B</div>
          <div className="t1-spec-xl t1-sign">Terminal One</div>
          <p className="t1-spec-sub">Every job is a departure.</p>
          <p className="t1-spec-body">
            The studio as a grand rail terminal. The queue is a split-flap departures board you
            can read from across the room; models are numbered platforms with posted fares;
            creating is buying a ticket at the window. Spending over $1.25 means stopping at
            <b> fare control</b> — a physical barrier, not a dialog. Signage scale everywhere:
            an operator never squints.
          </p>
          <div className="t1-spec-note">
            Dashboard → Concourse · Create → Ticketing · Queue → Departures ·
            Gallery → Arrivals · Costs → Fares · Briefs → Timetables · Handoff → Customs
          </div>
        </div>
        <div className="t1-spec-col">
          <div className="t1-spec-kick">Type</div>
          <div className="t1-spec-xl t1-sign" style={{fontSize:62}}>Anton</div>
          <p className="t1-spec-sub" style={{fontFamily:'"Familjen Grotesk", sans-serif'}}>Familjen Grotesk for wayfinding &amp; body</p>
          <p className="t1-spec-body">
            Anton is the station signage — used huge and sparingly. Familjen Grotesk does the
            human-scale work with warmth and a tall x-height.
          </p>
          <p className="t1-spec-body t1-mono" style={{fontSize:12, lineHeight:1.9}}>
            MARTIAN MONO — flap characters,<br/>fares &amp; clocks · 16:47 · $0.14/s
          </p>
          <div style={{marginTop:14}}><T1Flap text="EN ROUTE 62%" /></div>
          <div className="t1-spec-note">Scale: 84 / 34 / 19 / 14.5 / 12 mono. All-caps reserved for signage.</div>
        </div>
        <div className="t1-spec-col">
          <div className="t1-spec-kick">Enamel &amp; Signal</div>
          <div className="t1-chips">
            <div className="t1-chip"><span className="sw" style={{background:"#EDEAE1"}}></span><span className="nm">Hall stone</span><span className="hx">#EDEAE1</span></div>
            <div className="t1-chip"><span className="sw" style={{background:"#1E3A5F"}}></span><span className="nm">Board enamel</span><span className="hx">#1E3A5F</span></div>
            <div className="t1-chip"><span className="sw" style={{background:"#C8402F"}}></span><span className="nm">Signal red — gates &amp; alerts</span><span className="hx">#C8402F</span></div>
            <div className="t1-chip"><span className="sw" style={{background:"#1E7A4E"}}></span><span className="nm">Line S — StarXI</span><span className="hx">#1E7A4E</span></div>
            <div className="t1-chip"><span className="sw" style={{background:"#2E7E8C"}}></span><span className="nm">Line K — StrikeLab</span><span className="hx">#2E7E8C</span></div>
          </div>
          <div style={{marginTop:20}}>
            <div className="t1-spec-kick">The weighty moment</div>
            <div className="t1-gate" style={{marginTop:4}}>
              <span className="barrier">⊘ FARE<br/>CONTROL</span>
              <p>Fares above <b>$1.25</b> stop at the gate. Hold to lift the barrier.</p>
            </div>
          </div>
          <div className="t1-spec-note">Motion: split-flap cascades on every state change, barrier lift on confirm, platform chimes. Progress is a train moving along a line.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TerminalHero, TerminalSpecimen });
