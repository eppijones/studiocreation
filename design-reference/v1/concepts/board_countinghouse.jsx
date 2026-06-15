/* ============================================================
   Direction A — THE COUNTING HOUSE
   The studio as a 19th-century banking hall / financial broadsheet.
   Every generation is a transaction. The dashboard is a front page.
   Exposes: window.CountingHouseHero, window.CountingHouseSpecimen
   ============================================================ */

const chCSS = `
.ch {
  --paper: #F6F1E5;
  --paper-deep: #EFE8D6;
  --ink: #232838;
  --ink-soft: #4A5063;
  --ink-faint: #8B8FA0;
  --oxblood: #7E2D26;
  --ledger: #28604B;
  --rule: #C9C0A8;
  font-family: "Newsreader", serif;
  background: var(--paper);
  color: var(--ink);
  width: 100%; height: 100%;
  position: relative;
  overflow: hidden;
}
.ch * { box-sizing: border-box; }
.ch-display { font-family: "Instrument Serif", serif; font-weight: 400; }
.ch-mono { font-family: "Spline Sans Mono", monospace; font-variant-numeric: tabular-nums; }
.ch-sc { font-variant-caps: all-small-caps; letter-spacing: 0.14em; }

.ch-grain {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
  background-image: repeating-linear-gradient(0deg, rgba(35,40,56,0.022) 0 1px, transparent 1px 3px);
}

/* masthead */
.ch-mast { padding: 26px 48px 0; }
.ch-mast-rules { border-top: 3px double var(--ink); margin-bottom: 6px; }
.ch-mast-top {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 13px; color: var(--ink-soft); padding: 8px 0 2px;
}
.ch-masthead {
  text-align: center; font-size: 84px; line-height: 1; letter-spacing: -0.01em;
  padding: 6px 0 14px;
}
.ch-masthead em { font-style: italic; }
.ch-mast-bottom {
  display: flex; align-items: center; justify-content: space-between;
  border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink);
  padding: 7px 0; font-size: 13.5px;
}
.ch-nav { display: flex; gap: 22px; align-items: baseline; }
.ch-nav span { cursor: pointer; color: var(--ink-soft); }
.ch-nav span.on { color: var(--oxblood); border-bottom: 2px solid var(--oxblood); padding-bottom: 2px; }
.ch-ticker { display: flex; gap: 18px; font-size: 12.5px; color: var(--ink-soft); }
.ch-ticker b { color: var(--ink); font-weight: 600; }

/* columns */
.ch-cols {
  display: grid; grid-template-columns: 330px 1fr 360px;
  gap: 0; padding: 0 48px; margin-top: 18px; height: 596px;
}
.ch-col { padding: 0 26px; }
.ch-col:first-child { padding-left: 0; }
.ch-col:last-child { padding-right: 0; }
.ch-col + .ch-col { border-left: 1px solid var(--rule); }
.ch-kicker {
  font-size: 12.5px; letter-spacing: 0.22em; text-transform: uppercase;
  font-family: "Spline Sans Mono", monospace; color: var(--oxblood);
  display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.ch-kicker::after { content: ""; flex: 1; border-top: 1px solid var(--rule); }

/* the float */
.ch-float-big { font-size: 96px; line-height: 0.9; letter-spacing: -0.02em; }
.ch-float-big sup { font-size: 38px; vertical-align: 30px; letter-spacing: 0; }
.ch-float-sub { font-size: 15px; font-style: italic; color: var(--ink-soft); margin-top: 10px; }
.ch-meter { margin: 18px 0 6px; }
.ch-meter-bar {
  height: 10px; border: 1px solid var(--ink); position: relative; background: #FBF7EC;
}
.ch-meter-fill {
  position: absolute; inset: 1px auto 1px 1px; width: 63.2%;
  background: repeating-linear-gradient(135deg, var(--oxblood) 0 3px, #9A4038 3px 6px);
}
.ch-meter-cap { position: absolute; top: -5px; bottom: -5px; left: 76%; width: 1px; background: var(--ink); }
.ch-meter-cap::after {
  content: "warn"; position: absolute; top: -16px; left: -12px;
  font-family: "Spline Sans Mono", monospace; font-size: 9.5px; color: var(--ink-faint);
}
.ch-meter-row { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-soft); margin-top: 6px; }

.ch-ledgerlist { margin-top: 20px; border-top: 1px solid var(--ink); }
.ch-ledgerlist h4 {
  margin: 0; padding: 8px 0 6px; font-size: 13px; font-weight: 600;
}
.ch-lrow {
  display: grid; grid-template-columns: 44px 1fr 64px; gap: 8px;
  padding: 5.5px 0; border-top: 1px dotted var(--rule);
  font-size: 13px; align-items: baseline;
}
.ch-lrow .t { font-size: 11px; color: var(--ink-faint); }
.ch-lrow .d { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch-lrow .v { text-align: right; color: var(--oxblood); font-size: 12px; }
.ch-lrow .v::before { content: "–"; }

/* center: composing room */
.ch-lead-head { font-size: 40px; line-height: 1.04; margin: 0 0 4px; }
.ch-lead-dek { font-style: italic; font-size: 15.5px; color: var(--ink-soft); margin: 0 0 16px; }
.ch-manuscript {
  background: #FBF7EC; border: 1px solid var(--rule);
  padding: 14px 16px 12px; font-style: italic; font-size: 17px; line-height: 1.5;
  background-image: repeating-linear-gradient(0deg, transparent 0 25px, rgba(126,45,38,0.13) 25px 26px);
  min-height: 78px; position: relative;
}
.ch-manuscript .caret { color: var(--oxblood); }
.ch-manuscript .hint {
  position: absolute; right: 10px; bottom: 6px; font-style: normal;
  font-family: "Spline Sans Mono", monospace; font-size: 10px; color: var(--ink-faint);
}
.ch-fees { margin-top: 16px; border-top: 2px solid var(--ink); }
.ch-fees-head {
  display: grid; grid-template-columns: 1fr 110px 90px 90px;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  font-family: "Spline Sans Mono", monospace; color: var(--ink-soft);
  padding: 7px 0; border-bottom: 1px solid var(--ink);
}
.ch-fee {
  display: grid; grid-template-columns: 1fr 110px 90px 90px;
  padding: 8px 0; border-bottom: 1px dotted var(--rule);
  font-size: 14.5px; align-items: baseline; cursor: pointer;
}
.ch-fee .nm { font-weight: 500; }
.ch-fee .nm i { font-style: italic; color: var(--ink-faint); font-size: 13px; }
.ch-fee .rt, .ch-fee .qy, .ch-fee .tt { font-size: 13px; text-align: right; }
.ch-fee.sel { background: linear-gradient(0deg, rgba(40,96,75,0.07), rgba(40,96,75,0.07)); }
.ch-fee.sel .nm::before { content: "☞ "; color: var(--ledger); }
.ch-fee.sel .tt { color: var(--ledger); font-weight: 600; }
.ch-total {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 12px 0 0; margin-top: 2px; border-top: 2px solid var(--ink);
}
.ch-total .lbl { font-size: 13px; }
.ch-total .sum { font-size: 34px; }
.ch-stampline {
  display: flex; align-items: center; gap: 14px; margin-top: 14px;
}
.ch-authbtn {
  flex: 1; border: 1.5px solid var(--oxblood); color: var(--oxblood);
  padding: 12px 18px; text-align: center; font-size: 15px; letter-spacing: 0.12em;
  text-transform: uppercase; font-family: "Spline Sans Mono", monospace;
  background:
    linear-gradient(0deg, rgba(126,45,38,0.06), rgba(126,45,38,0.06));
  cursor: pointer; position: relative;
}
.ch-authbtn small { display: block; font-size: 10px; letter-spacing: 0.08em; color: var(--ink-soft); margin-top: 3px; text-transform: none; }
.ch-stamp {
  width: 92px; height: 92px; border: 2.5px solid var(--oxblood); border-radius: 50%;
  display: grid; place-items: center; text-align: center;
  color: var(--oxblood); transform: rotate(-11deg);
  font-family: "Spline Sans Mono", monospace; font-size: 9.5px; letter-spacing: 0.1em;
  line-height: 1.5; opacity: 0.85;
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='4' fill='white' opacity='0.92'/></svg>");
}
.ch-stamp b { font-size: 13px; display: block; }

/* right: wires */
.ch-wire { padding: 12px 0; border-bottom: 1px solid var(--rule); }
.ch-wire-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-family: "Spline Sans Mono", monospace; color: var(--ink-faint); margin-bottom: 5px; }
.ch-wire-top .st { color: var(--ledger); letter-spacing: 0.12em; }
.ch-wire-top .st.q { color: var(--ink-faint); }
.ch-wire p { margin: 0 0 7px; font-size: 14px; line-height: 1.35; }
.ch-morse { display: flex; align-items: center; gap: 3px; height: 8px; }
.ch-morse i { display: block; height: 3px; background: var(--ledger); }
.ch-morse i.dot { width: 3px; }
.ch-morse i.dash { width: 11px; }
.ch-morse i.off { background: var(--rule); }
.ch-morse .pct { font-family: "Spline Sans Mono", monospace; font-size: 10.5px; color: var(--ink-soft); margin-left: 6px; }
.ch-wire-meta { display: flex; gap: 12px; margin-top: 6px; font-size: 11.5px; color: var(--ink-soft); }
.ch-wire-meta b { color: var(--oxblood); font-weight: 500; }
.ch-audit {
  margin-top: 16px; border: 1px solid var(--rule); background: #FBF7EC; padding: 12px 14px;
}
.ch-audit h5 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; font-family: "Spline Sans Mono", monospace; color: var(--ink-soft); font-weight: 500; }
.ch-audit-row { display: flex; justify-content: space-between; font-size: 13.5px; padding: 3px 0; }
.ch-audit-row .mk { color: var(--ledger); font-style: italic; }
.ch-audit-row .mk.no { color: var(--oxblood); }

.ch-folio {
  position: absolute; bottom: 0; left: 48px; right: 48px;
  border-top: 1px solid var(--ink); padding: 8px 0 14px;
  display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-soft);
}

/* ---------- specimen ---------- */
.ch-spec { display: grid; grid-template-columns: 1fr 1fr 1fr; height: 100%; }
.ch-spec-col { padding: 34px 36px; border-right: 1px solid var(--rule); display: flex; flex-direction: column; }
.ch-spec-col:last-child { border-right: none; }
.ch-spec-type-xl { font-size: 88px; line-height: 1.02; margin: 14px 0 8px; }
.ch-spec-type-it { font-size: 30px; font-style: italic; margin: 4px 0 18px; color: var(--ink-soft); }
.ch-spec-body { font-size: 15.5px; line-height: 1.55; max-width: 34ch; }
.ch-spec-monoline { font-size: 13px; margin-top: 18px; line-height: 1.8; color: var(--ink-soft); }
.ch-chips { display: grid; gap: 0; margin-top: 14px; border: 1px solid var(--ink); }
.ch-chip { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; border-bottom: 1px solid var(--ink); }
.ch-chip:last-child { border-bottom: none; }
.ch-chip .sw { height: 52px; border-right: 1px solid var(--ink); }
.ch-chip .nm { padding: 0 14px; font-size: 15px; font-style: italic; }
.ch-chip .hx { padding: 0 14px; font-family: "Spline Sans Mono", monospace; font-size: 11px; color: var(--ink-soft); }
.ch-spec-note { font-size: 13px; font-style: italic; color: var(--ink-soft); margin-top: auto; line-height: 1.5; }
`;

function CHMorse({ pct }) {
  const units = [];
  const seq = ["dot","dash","dot","dot","dash","dot","dash","dash","dot","dot","dash","dot","dot","dash","dot","dash"];
  const onCount = Math.round(seq.length * pct);
  seq.forEach((s, i) => units.push(<i key={i} className={s + (i < onCount ? "" : " off")}></i>));
  return <div className="ch-morse">{units}<span className="pct">{Math.round(pct * 100)}%</span></div>;
}

function CountingHouseHero() {
  return (
    <div className="ch">
      <style>{chCSS}</style>
      <div className="ch-grain"></div>

      <header className="ch-mast">
        <div className="ch-mast-rules"></div>
        <div className="ch-mast-top ch-sc">
          <span>Vol. II — № 164</span>
          <span>Thursday, 12 June 2026</span>
          <span>Operator on duty: A. Rivera</span>
        </div>
        <h1 className="ch-masthead ch-display">The <em>Counting</em> House</h1>
        <div className="ch-mast-bottom">
          <nav className="ch-nav ch-sc">
            <span className="on">Front Page</span>
            <span>Composing Room</span>
            <span>Wires</span>
            <span>Plates</span>
            <span>Accounts</span>
            <span>Briefs</span>
            <span>Dispatch</span>
          </nav>
          <div className="ch-ticker ch-mono">
            <span>FAL <b>$18.30</b></span>
            <span>HIGGS <b>240 cr</b></span>
            <span>WIRES <b>2 live</b></span>
          </div>
        </div>
      </header>

      <main className="ch-cols">
        {/* THE FLOAT */}
        <section className="ch-col">
          <div className="ch-kicker">The Float</div>
          <div className="ch-float-big ch-display"><sup>$</sup>2.76</div>
          <p className="ch-float-sub">remains of this day&rsquo;s float of $7.50, four dollars seventy&#8209;four having been spent.</p>
          <div className="ch-meter">
            <div className="ch-meter-bar"><div className="ch-meter-fill"></div><div className="ch-meter-cap"></div></div>
            <div className="ch-meter-row ch-mono"><span>$0</span><span>spent $4.74</span><span>$7.50</span></div>
          </div>
          <div className="ch-ledgerlist">
            <h4 className="ch-sc">Entries of the afternoon</h4>
            <div className="ch-lrow"><span className="t ch-mono">16:42</span><span className="d">Hero tunnel push v3 — Kling 3 Pro, 6s</span><span className="v ch-mono">0.840</span></div>
            <div className="ch-lrow"><span className="t ch-mono">16:30</span><span className="d">Squad value infographic ×4 — GPT Image 2</span><span className="v ch-mono">0.240</span></div>
            <div className="ch-lrow"><span className="t ch-mono">15:58</span><span className="d">Brand campaign frame ×3 — Soul 2.0</span><span className="v ch-mono">0.150</span></div>
            <div className="ch-lrow"><span className="t ch-mono">15:21</span><span className="d">Social vertical teaser, 8s — Veo 3.1</span><span className="v ch-mono">0.960</span></div>
            <div className="ch-lrow"><span className="t ch-mono">14:47</span><span className="d">Keeper ref sheet ×6 — Nano Banana Pro</span><span className="v ch-mono">0.234</span></div>
          </div>
        </section>

        {/* COMPOSING ROOM */}
        <section className="ch-col">
          <div className="ch-kicker">Composing Room — New Entry</div>
          <h2 className="ch-lead-head ch-display">A transaction is drafted in ink before a penny moves.</h2>
          <p className="ch-lead-dek">Set the manuscript, choose the engraver, and the fee is computed to the fourth decimal — in plain sight, always.</p>
          <div className="ch-manuscript">
            StarXI captain figurine, deep green kit, studio rim light, collectible gloss<span className="caret">▎</span>
            <span className="hint">MANUSCRIPT · 14 WORDS</span>
          </div>
          <div className="ch-fees">
            <div className="ch-fees-head"><span>Engraver</span><span style={{textAlign:"right"}}>Rate</span><span style={{textAlign:"right"}}>Qty</span><span style={{textAlign:"right"}}>Fee</span></div>
            <div className="ch-fee"><span className="nm">FLUX dev <i>— balanced plate</i></span><span className="rt ch-mono">$0.025/img</span><span className="qy ch-mono">×4</span><span className="tt ch-mono">$0.10</span></div>
            <div className="ch-fee sel"><span className="nm">Kling 3 Pro <i>— premium motion</i></span><span className="rt ch-mono">$0.14/s</span><span className="qy ch-mono">6s ×2</span><span className="tt ch-mono">$1.84</span></div>
            <div className="ch-fee"><span className="nm">Veo 3.1 <i>— cinematic, sound</i></span><span className="rt ch-mono">$0.12/s</span><span className="qy ch-mono">6s ×2</span><span className="tt ch-mono">$1.58</span></div>
          </div>
          <div className="ch-total">
            <span className="lbl ch-sc">Total fee, payable from the float</span>
            <span className="sum ch-display">$1.84</span>
          </div>
          <div className="ch-stampline">
            <div className="ch-authbtn">
              Present for stamp
              <small>fees above $1.25 must be stamped by hand — no exceptions</small>
            </div>
            <div className="ch-stamp"><span>AUTHORIZED<b>$1.84</b>A.R. · 12 VI 26</span></div>
          </div>
        </section>

        {/* WIRES */}
        <section className="ch-col">
          <div className="ch-kicker">Wires in Progress</div>
          <div className="ch-wire">
            <div className="ch-wire-top"><span>№ 801 · KLING 3 PRO · 21:9</span><span className="st">TRANSMITTING</span></div>
            <p>Anamorphic stadium tunnel, players emerging into floodlight haze, slow dolly push</p>
            <CHMorse pct={0.62} />
            <div className="ch-wire-meta ch-mono"><span>47s of ~75s</span><b>fee $0.84</b><span>op AR</span></div>
          </div>
          <div className="ch-wire">
            <div className="ch-wire-top"><span>№ 802 · GPT IMAGE 2 · ×4</span><span className="st">TRANSMITTING</span></div>
            <p>Infographic: squad value breakdown, legible figures, 4:5</p>
            <CHMorse pct={0.34} />
            <div className="ch-wire-meta ch-mono"><span>7s of ~22s</span><b>fee $0.24</b><span>op JN</span></div>
          </div>
          <div className="ch-wire">
            <div className="ch-wire-top"><span>№ 803 · NANO BANANA PRO · ×6</span><span className="st q">HELD IN QUEUE</span></div>
            <p>StrikeLab driver head turnaround, seamless cool-grey backdrop</p>
            <CHMorse pct={0} />
            <div className="ch-wire-meta ch-mono"><span>awaiting wire</span><b>fee $0.23</b><span>op AR</span></div>
          </div>
          <div className="ch-audit">
            <h5>Auditor&rsquo;s marks, latest plates</h5>
            <div className="ch-audit-row"><span>Keeper ref sheet ×6</span><span className="mk">10 — exemplary, ship ✓</span></div>
            <div className="ch-audit-row"><span>Hero tunnel push v3</span><span className="mk">9 — ship ✓</span></div>
            <div className="ch-audit-row"><span>Storyboard beats ×8</span><span className="mk no">6 — hold, redraw</span></div>
          </div>
        </section>
      </main>

      <footer className="ch-folio ch-sc">
        <span>The Counting House — kept daily, balanced nightly</span>
        <span>Page 1 of 7</span>
      </footer>
    </div>
  );
}

function CountingHouseSpecimen() {
  return (
    <div className="ch">
      <style>{chCSS}</style>
      <div className="ch-grain"></div>
      <div className="ch-spec">
        <div className="ch-spec-col">
          <div className="ch-kicker">Direction A</div>
          <div className="ch-spec-type-xl ch-display">The <em>Counting</em> House</div>
          <div className="ch-spec-type-it">Every generation is a transaction.</div>
          <p className="ch-spec-body">
            The studio as a banking hall crossed with a financial broadsheet. Money is the
            first-class citizen: fees are typeset before they are spent, the daily float is
            front-page news, and anything over $1.25 must be physically <i>stamped</i>.
            Scoring is an auditor&rsquo;s mark in the margin. No cards, no panels — ruled
            columns, hairlines, and ink.
          </p>
          <div className="ch-spec-note">
            Dashboard → Front Page · Create → Composing Room · Queue → Wires ·
            Gallery → Plates · Costs → Accounts · Handoff → Dispatch
          </div>
        </div>
        <div className="ch-spec-col">
          <div className="ch-kicker">Type</div>
          <div className="ch-spec-type-xl ch-display" style={{fontSize:50}}>Instrument Serif</div>
          <div className="ch-spec-type-it" style={{fontSize:22}}>for mastheads, sums &amp; headlines</div>
          <p className="ch-spec-body" style={{fontFamily:'"Newsreader", serif'}}>
            Newsreader carries the running text — a true news face with real italics,
            comfortable at 14px for eight hours straight.
          </p>
          <div className="ch-spec-monoline ch-mono">
            SPLINE SANS MONO — 0123456789 · $0.0040/img · $0.14/s<br/>
            tabular figures for every fee, rate and timestamp
          </div>
          <div className="ch-spec-note">Scale: 84 / 40 / 17 / 14.5 / 13 mono. Small caps for wayfinding.</div>
        </div>
        <div className="ch-spec-col">
          <div className="ch-kicker">Ink &amp; Paper</div>
          <div className="ch-chips">
            <div className="ch-chip"><span className="sw" style={{background:"#F6F1E5"}}></span><span className="nm">Counting paper</span><span className="hx">#F6F1E5</span></div>
            <div className="ch-chip"><span className="sw" style={{background:"#232838"}}></span><span className="nm">Iron-gall ink</span><span className="hx">#232838</span></div>
            <div className="ch-chip"><span className="sw" style={{background:"#7E2D26"}}></span><span className="nm">Oxblood — debits &amp; stamps</span><span className="hx">#7E2D26</span></div>
            <div className="ch-chip"><span className="sw" style={{background:"#28604B"}}></span><span className="nm">Ledger green — credits &amp; ships</span><span className="hx">#28604B</span></div>
          </div>
          <div style={{marginTop:22}}>
            <div className="ch-kicker">The weighty moment</div>
            <div className="ch-stampline" style={{marginTop:4}}>
              <div className="ch-authbtn">Present for stamp<small>fees above $1.25 are stamped by hand</small></div>
              <div className="ch-stamp"><span>AUTHORIZED<b>$1.84</b>A.R. · 12 VI 26</span></div>
            </div>
          </div>
          <div className="ch-spec-note">Motion: nib-line draws, stamp thunk with paper shake, morse-dash progress. Nothing fades — things are <i>entered</i>.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CountingHouseHero, CountingHouseSpecimen });
