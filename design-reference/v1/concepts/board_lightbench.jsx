/* ============================================================
   Direction C — THE LIGHTBENCH
   The studio as a film-lab finishing bench: an illuminated
   lightbox surface, contact strips, grease-pencil markups,
   chemistry budgets, and a countersign for big commits.
   Exposes: window.LightbenchHero, window.LightbenchSpecimen
   ============================================================ */

const lbCSS = `
.lb {
  --glass: #FCFBF6;
  --glow: #FFFFFF;
  --edge: #D9D6CC;
  --graphite: #33342F;
  --soft: #6E6F68;
  --faint: #A4A49B;
  --marker-red: #D6402B;
  --marker-blue: #2C55A6;
  font-family: "Jost", sans-serif;
  background:
    radial-gradient(120% 90% at 50% 38%, var(--glow) 0%, var(--glass) 58%, #F1EFE7 100%);
  color: var(--graphite);
  width: 100%; height: 100%; position: relative; overflow: hidden;
}
.lb * { box-sizing: border-box; }
.lb-mono { font-family: "Fragment Mono", monospace; font-variant-numeric: tabular-nums; }
.lb-pencil { font-family: "Shantell Sans", cursive; }
.lb-caps { text-transform: uppercase; letter-spacing: 0.22em; }

/* registration marks */
.lb-reg { position: absolute; width: 26px; height: 26px; opacity: 0.5; }
.lb-reg::before, .lb-reg::after { content: ""; position: absolute; background: var(--graphite); }
.lb-reg::before { left: 50%; top: 0; bottom: 0; width: 1px; }
.lb-reg::after { top: 50%; left: 0; right: 0; height: 1px; }
.lb-reg i { position: absolute; inset: 6px; border: 1px solid var(--graphite); border-radius: 50%; }

/* header: tape + drawers */
.lb-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 26px 56px 0;
}
.lb-tape {
  background: rgba(231, 226, 209, 0.9); padding: 10px 26px;
  transform: rotate(-0.6deg);
  box-shadow: 0 2px 7px rgba(51,52,47,0.13);
  font-size: 19px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 500;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 7px, #000 calc(100% - 7px), transparent 100%);
}
.lb-tape small { display: block; font-size: 9px; letter-spacing: 0.34em; color: var(--soft); margin-top: 2px; }
.lb-drawers { display: flex; gap: 6px; }
.lb-drawer {
  border: 1px solid var(--edge); background: #F7F5EC; padding: 8px 15px;
  font-size: 11.5px; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer;
  color: var(--soft); box-shadow: inset 0 -2px 0 rgba(51,52,47,0.06);
}
.lb-drawer.on { background: var(--graphite); color: var(--glass); border-color: var(--graphite); }
.lb-meta { font-size: 11px; color: var(--soft); text-align: right; line-height: 1.7; }

/* contact strip */
.lb-striplabel {
  display: flex; align-items: baseline; gap: 14px; padding: 30px 56px 10px;
}
.lb-striplabel h2 { margin: 0; font-size: 13px; font-weight: 500; }
.lb-striplabel .edge { font-size: 10px; color: var(--faint); }
.lb-strip {
  margin: 0 56px; background: #2B2C28; padding: 13px 18px; display: flex; gap: 10px;
  position: relative; border-radius: 2px;
  box-shadow: 0 14px 34px -16px rgba(51,52,47,0.45);
  background-image:
    radial-gradient(circle at 8px 6px, transparent 2.6px, #2B2C28 3px),
    radial-gradient(circle at 8px calc(100% - 6px), transparent 2.6px, #2B2C28 3px);
}
.lb-strip::before, .lb-strip::after {
  content: "▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪ ▪";
  position: absolute; left: 16px; right: 16px; color: #FCFBF6; font-size: 6px;
  letter-spacing: 12px; overflow: hidden; white-space: nowrap; opacity: 0.85; line-height: 1;
}
.lb-strip::before { top: 4px; }
.lb-strip::after { bottom: 4px; }
.lb-frame { position: relative; flex: 1; }
.lb-frame .ph {
  height: 132px; border-radius: 1px; position: relative; overflow: hidden;
  background-image: repeating-linear-gradient(45deg, rgba(252,251,246,0.16) 0 2px, transparent 2px 7px);
}
.lb-frame .cap {
  position: absolute; left: 4px; bottom: 4px; right: 4px;
  font-family: "Fragment Mono", monospace; font-size: 8.5px; color: rgba(252,251,246,0.85);
  letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lb-frame .code {
  position: absolute; top: -10px; left: 2px; font-family: "Fragment Mono", monospace;
  font-size: 7.5px; color: rgba(252,251,246,0.6); letter-spacing: 0.2em;
}
.lb-circle {
  position: absolute; inset: -7px -5px; border: 3px solid var(--marker-red); border-radius: 50%;
  transform: rotate(-4deg); pointer-events: none;
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5'><rect width='5' height='5' fill='white' opacity='0.88'/></svg>");
}
.lb-scrawl {
  position: absolute; font-family: "Shantell Sans", cursive; pointer-events: none; line-height: 1;
}
.lb-x { position: absolute; inset: 8px; pointer-events: none; }
.lb-x::before, .lb-x::after {
  content: ""; position: absolute; left: -4px; right: -4px; top: 50%; height: 3.5px;
  background: var(--marker-blue); opacity: 0.85; border-radius: 3px;
}
.lb-x::before { transform: rotate(24deg); }
.lb-x::after { transform: rotate(-24deg); }

/* lower bench */
.lb-lower { display: grid; grid-template-columns: 330px 1fr 410px; gap: 34px; padding: 32px 56px 0; }
.lb-panel-label { font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--soft); margin-bottom: 13px; display: flex; gap: 10px; align-items: center; }
.lb-panel-label::after { content: ""; flex: 1; border-top: 1px solid var(--edge); }

/* chemistry */
.lb-chem { display: flex; gap: 22px; }
.lb-cylinder { width: 64px; height: 218px; border: 1.5px solid var(--graphite); border-top: none; position: relative; border-radius: 0 0 8px 8px; background: rgba(255,255,255,0.6); }
.lb-cylinder .liquid { position: absolute; left: 2px; right: 2px; bottom: 2px; height: 36.8%; background: linear-gradient(180deg, rgba(44,85,166,0.5), rgba(44,85,166,0.72)); border-radius: 0 0 6px 6px; }
.lb-cylinder .tick { position: absolute; right: -1px; width: 9px; height: 1px; background: var(--graphite); }
.lb-cylinder .tl { position: absolute; right: 13px; font-family: "Fragment Mono", monospace; font-size: 8.5px; color: var(--soft); transform: translateY(-50%); }
.lb-chem-read .big { font-family: "Fragment Mono", monospace; font-size: 40px; letter-spacing: -0.02em; }
.lb-chem-read .big small { font-size: 15px; color: var(--soft); }
.lb-chem-read .sub { font-size: 12.5px; color: var(--soft); margin: 5px 0 14px; line-height: 1.5; }
.lb-chem-line { display: flex; justify-content: space-between; font-size: 11.5px; padding: 5px 0; border-top: 1px dotted var(--edge); }
.lb-chem-line b { font-family: "Fragment Mono", monospace; font-weight: 400; }
.lb-chem-warn { margin-top: 12px; font-size: 13px; color: var(--marker-red); }

/* bath */
.lb-bath-item { border: 1px solid var(--edge); background: rgba(255,255,255,0.75); padding: 12px 15px; margin-bottom: 11px; position: relative; }
.lb-bath-item .row1 { display: flex; justify-content: space-between; font-family: "Fragment Mono", monospace; font-size: 9.5px; letter-spacing: 0.14em; color: var(--soft); margin-bottom: 6px; }
.lb-bath-item .row1 .dev { color: var(--marker-blue); }
.lb-bath-item p { margin: 0 0 9px; font-size: 13.5px; line-height: 1.4; }
.lb-wave { height: 14px; position: relative; overflow: hidden; }
.lb-wave svg { position: absolute; left: 0; top: 0; }
.lb-wave .timer { position: absolute; right: 0; top: 0; font-family: "Fragment Mono", monospace; font-size: 10px; color: var(--soft); }
.lb-bath-item.qd { opacity: 0.65; }
.lb-bath-item.qd .row1 .dev { color: var(--faint); }

/* exposure / commit */
.lb-exposure { border: 1.5px solid var(--graphite); background: rgba(255,255,255,0.82); padding: 18px 20px; position: relative; }
.lb-exposure .corner { position: absolute; top: -7px; right: 14px; background: rgba(231,226,209,0.95); transform: rotate(1.4deg); padding: 3px 12px; font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--soft); box-shadow: 0 1px 4px rgba(51,52,47,0.15); }
.lb-prompt { font-size: 15px; line-height: 1.5; border-bottom: 1px solid var(--edge); padding-bottom: 12px; }
.lb-prompt .caret { color: var(--marker-red); }
.lb-dials { display: flex; gap: 8px; margin: 13px 0; }
.lb-dial { flex: 1; border: 1px solid var(--edge); padding: 8px 10px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--soft); }
.lb-dial b { display: block; font-family: "Fragment Mono", monospace; font-size: 12px; color: var(--graphite); margin-top: 3px; letter-spacing: 0; text-transform: none; }
.lb-dial.sel { border-color: var(--marker-blue); box-shadow: inset 0 0 0 1px var(--marker-blue); }
.lb-exp-read { display: flex; align-items: baseline; justify-content: space-between; padding: 6px 0 12px; }
.lb-exp-read .k { font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--soft); }
.lb-exp-read .v { font-family: "Fragment Mono", monospace; font-size: 38px; }
.lb-countersign { border-top: 2px solid var(--marker-red); padding-top: 11px; display: grid; grid-template-columns: 1fr 128px; gap: 14px; align-items: center; }
.lb-countersign p { margin: 0; font-size: 12px; line-height: 1.45; color: var(--soft); }
.lb-countersign p b { color: var(--marker-red); }
.lb-sigbox { border: 1.5px dashed var(--marker-red); height: 58px; position: relative; display: grid; place-items: center; }
.lb-sigbox .sig { font-family: "Shantell Sans", cursive; color: var(--marker-red); font-size: 19px; transform: rotate(-3deg); }
.lb-sigbox .lbl { position: absolute; bottom: 2px; right: 5px; font-size: 7.5px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--faint); }
.lb-commit { margin-top: 13px; width: 100%; border: none; background: var(--graphite); color: var(--glass); padding: 13px; font-family: "Jost", sans-serif; font-size: 14px; letter-spacing: 0.26em; text-transform: uppercase; cursor: pointer; }
.lb-commit small { display: block; font-family: "Fragment Mono", monospace; font-size: 8.5px; letter-spacing: 0.2em; margin-top: 4px; opacity: 0.65; }

/* specimen */
.lb-spec { display: grid; grid-template-columns: 1fr 1fr 1fr; height: 100%; }
.lb-spec-col { padding: 34px 38px; border-right: 1px solid var(--edge); display: flex; flex-direction: column; }
.lb-spec-col:last-child { border-right: none; }
.lb-spec-xl { font-size: 74px; line-height: 1; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; margin: 8px 0 6px; }
.lb-spec-sub { font-family: "Shantell Sans", cursive; font-size: 23px; color: var(--marker-red); transform: rotate(-1.2deg); margin: 2px 0 16px; }
.lb-spec-body { font-size: 14.5px; line-height: 1.6; max-width: 36ch; }
.lb-chips { border: 1px solid var(--graphite); margin-top: 12px; }
.lb-chip { display: grid; grid-template-columns: 62px 1fr auto; align-items: center; border-bottom: 1px solid var(--graphite); }
.lb-chip:last-child { border-bottom: none; }
.lb-chip .sw { height: 50px; border-right: 1px solid var(--graphite); }
.lb-chip .nm { padding: 0 14px; font-size: 14px; }
.lb-chip .hx { padding: 0 14px; font-family: "Fragment Mono", monospace; font-size: 10.5px; color: var(--soft); }
.lb-spec-note { font-size: 12.5px; color: var(--soft); margin-top: auto; line-height: 1.55; }
`;

function LBWave({ pct, t }) {
  return (
    <div className="lb-wave">
      <svg width="300" height="14" viewBox="0 0 300 14">
        <path d="M0 7 Q 7 1, 14 7 T 28 7 T 42 7 T 56 7 T 70 7 T 84 7 T 98 7 T 112 7 T 126 7 T 140 7 T 154 7 T 168 7 T 182 7 T 196 7 T 210 7 T 224 7"
          fill="none" stroke="#2C55A6" strokeWidth="1.6" strokeDasharray="224" strokeDashoffset={224 - 224 * pct} opacity="0.8"/>
        <path d="M0 7 Q 7 1, 14 7 T 28 7 T 42 7 T 56 7 T 70 7 T 84 7 T 98 7 T 112 7 T 126 7 T 140 7 T 154 7 T 168 7 T 182 7 T 196 7 T 210 7 T 224 7"
          fill="none" stroke="#D9D6CC" strokeWidth="1.6" strokeDasharray="4 3" opacity="0.7" style={{zIndex:-1}}/>
      </svg>
      <span className="timer">{t}</span>
    </div>
  );
}

function LightbenchHero() {
  const frames = [
    { hue: 150, cap: "keeper ref sheet ×6", code: "SC·1004", circle: true, scrawl: { text: "PRINT — 10", color: "var(--marker-red)", style: { top: -26, right: -6, fontSize: 16, transform: "rotate(2deg)" } } },
    { hue: 28, cap: "hero tunnel push v3", code: "SC·1005", scrawl: { text: "9 ✓", color: "var(--marker-red)", style: { bottom: -24, left: 6, fontSize: 15, transform: "rotate(-3deg)" } } },
    { hue: 200, cap: "social teaser 8s", code: "SC·1006", scrawl: { text: "7 — tighter crop?", color: "var(--marker-blue)", style: { bottom: -25, left: 2, fontSize: 13, transform: "rotate(-1deg)" } } },
    { hue: 48, cap: "storyboard beat 3", code: "SC·1007", x: true, scrawl: { text: "redraw", color: "var(--marker-blue)", style: { top: -25, left: 10, fontSize: 14, transform: "rotate(-2deg)" } } },
    { hue: 320, cap: "campaign frame", code: "SC·1008", scrawl: { text: "9 ✓", color: "var(--marker-red)", style: { bottom: -24, right: 8, fontSize: 15, transform: "rotate(2deg)" } } },
    { hue: 280, cap: "GROUP STAGE type", code: "SC·1009" },
  ];
  return (
    <div className="lb">
      <style>{lbCSS}</style>
      <span className="lb-reg" style={{top:14,left:18}}><i></i></span>
      <span className="lb-reg" style={{top:14,right:18}}><i></i></span>
      <span className="lb-reg" style={{bottom:14,left:18}}><i></i></span>
      <span className="lb-reg" style={{bottom:14,right:18}}><i></i></span>

      <header className="lb-head">
        <div className="lb-tape">StudioCreation<small>Finishing Bench · Roll 164</small></div>
        <nav className="lb-drawers">
          <span className="lb-drawer on">Bench</span>
          <span className="lb-drawer">Exposure</span>
          <span className="lb-drawer">In the Bath</span>
          <span className="lb-drawer">Contact Sheets</span>
          <span className="lb-drawer">Chemistry</span>
          <span className="lb-drawer">Dockets</span>
          <span className="lb-drawer">Dispatch</span>
        </nav>
        <div className="lb-meta lb-mono">THU 12 JUN 2026 · 16:47<br/>OPERATOR A. RIVERA</div>
      </header>

      <div className="lb-striplabel">
        <h2 className="lb-caps">Today&rsquo;s strip — scored on the glass</h2>
        <span className="edge lb-mono">EDGE CODE SC-164 ▸ KODAK SAFETY FILM ▸ 24 EXPOSURES</span>
      </div>
      <section className="lb-strip">
        {frames.map((f, i) => (
          <div className="lb-frame" key={i}>
            <span className="code">{f.code}</span>
            <div className="ph" style={{background:`oklch(0.42 0.06 ${f.hue})`}}></div>
            <div className="cap">{f.cap}</div>
            {f.circle && <span className="lb-circle"></span>}
            {f.x && <span className="lb-x"></span>}
            {f.scrawl && <span className="lb-scrawl" style={{...f.scrawl.style, color: f.scrawl.color}}>{f.scrawl.text}</span>}
          </div>
        ))}
      </section>

      <div className="lb-lower">
        <section>
          <div className="lb-panel-label">Chemistry — today&rsquo;s budget</div>
          <div className="lb-chem">
            <div className="lb-cylinder">
              <span className="liquid"></span>
              {[0.2,0.4,0.6,0.8].map(p => <span key={p} className="tick" style={{bottom:`${p*100}%`}}></span>)}
              <span className="tl" style={{bottom:"80%"}}>6.00</span>
              <span className="tl" style={{bottom:"40%"}}>3.00</span>
            </div>
            <div className="lb-chem-read">
              <div className="big lb-mono">$2.76<small> left</small></div>
              <div className="sub">of a $7.50 daily mix —<br/>$4.74 already in the trays.</div>
              <div className="lb-chem-line"><span>fal reservoir</span><b>$18.30</b></div>
              <div className="lb-chem-line"><span>higgs credits</span><b>240 cr</b></div>
              <div className="lb-chem-line"><span>burn rate</span><b>$1.18/hr</b></div>
              <div className="lb-chem-warn lb-pencil">running low after ~2 more hero pulls</div>
            </div>
          </div>
        </section>

        <section>
          <div className="lb-panel-label">In the bath — developing now</div>
          <div className="lb-bath-item">
            <div className="row1"><span>SC·801 · KLING 3 PRO · 21:9 · 6s</span><span className="dev">DEVELOPING</span></div>
            <p>Anamorphic stadium tunnel, players emerging into floodlight haze</p>
            <LBWave pct={0.62} t="0:47 / ~1:15 · $0.84" />
          </div>
          <div className="lb-bath-item">
            <div className="row1"><span>SC·802 · GPT IMAGE 2 · ×4</span><span className="dev">DEVELOPING</span></div>
            <p>Squad value infographic, legible figures, 4:5</p>
            <LBWave pct={0.34} t="0:07 / ~0:22 · $0.24" />
          </div>
          <div className="lb-bath-item qd">
            <div className="row1"><span>SC·803 · NANO BANANA PRO · ×6</span><span className="dev">ON THE RACK</span></div>
            <p>StrikeLab driver head turnaround, cool-grey seamless</p>
            <LBWave pct={0} t="queued · $0.23" />
          </div>
        </section>

        <section>
          <div className="lb-panel-label">Exposure — new pull</div>
          <div className="lb-exposure">
            <span className="corner">Docket 0805</span>
            <div className="lb-prompt">StarXI captain figurine, deep green kit, studio rim light, collectible gloss<span className="caret">▎</span></div>
            <div className="lb-dials">
              <div className="lb-dial sel">Stock<b>Kling 3 Pro</b></div>
              <div className="lb-dial">Exposure<b>6s × 2</b></div>
              <div className="lb-dial">Frame<b>16:9</b></div>
            </div>
            <div className="lb-exp-read">
              <span className="k">Chemistry required</span>
              <span className="v">$1.84</span>
            </div>
            <div className="lb-countersign">
              <p>Pulls over <b>$1.25</b> need a countersign on the docket. Sign on the glass — then commit.</p>
              <div className="lb-sigbox"><span className="sig">A. Rivera</span><span className="lbl">countersign</span></div>
            </div>
            <button className="lb-commit">Commit to the bath<small>$1.84 FROM TODAY&rsquo;S MIX</small></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function LightbenchSpecimen() {
  return (
    <div className="lb">
      <style>{lbCSS}</style>
      <div className="lb-spec">
        <div className="lb-spec-col">
          <div className="lb-panel-label">Direction C</div>
          <div className="lb-spec-xl">The Lightbench</div>
          <div className="lb-spec-sub">every frame earns its mark</div>
          <p className="lb-spec-body">
            The studio as a film-lab finishing bench. The whole interface sits on an
            illuminated lightbox — luminous, calm, zero eye strain. Generations develop
            <i> in the bath</i> with agitation waves; finished frames land on a contact strip
            where scoring is literal grease pencil: a red circle means print, a blue X means
            redraw. Budget is chemistry in a graduated cylinder. Big commits get a
            handwritten countersign on the docket.
          </p>
          <div className="lb-spec-note">
            Dashboard → Bench · Create → Exposure · Queue → In the Bath ·
            Gallery → Contact Sheets · Costs → Chemistry · Briefs → Dockets · Handoff → Dispatch
          </div>
        </div>
        <div className="lb-spec-col">
          <div className="lb-panel-label">Type</div>
          <div className="lb-spec-xl" style={{fontSize:56}}>Jost</div>
          <p className="lb-spec-body">
            Jost — a geometric with film-leader DNA — set wide and uppercase for structure,
            sentence case for reading.
          </p>
          <p className="lb-spec-body lb-mono" style={{fontSize:12, lineHeight:1.9}}>
            FRAGMENT MONO — edge codes,<br/>timers &amp; chemistry · SC·1004 · $0.14/s
          </p>
          <div className="lb-spec-sub" style={{fontSize:26, marginTop:16}}>Shantell Sans — the grease pencil</div>
          <p className="lb-spec-body">Reserved for human marks only: scores, signatures, warnings. If it&rsquo;s handwritten, a person decided it.</p>
          <div className="lb-spec-note">Scale: 74 / 19 / 14.5 body / 10 mono. Letterspaced caps for all structure.</div>
        </div>
        <div className="lb-spec-col">
          <div className="lb-panel-label">Glass &amp; Markers</div>
          <div className="lb-chips">
            <div className="lb-chip"><span className="sw" style={{background:"radial-gradient(circle at 50% 30%, #FFFFFF, #FCFBF6)"}}></span><span className="nm">Lightbox glass</span><span className="hx">#FCFBF6 + glow</span></div>
            <div className="lb-chip"><span className="sw" style={{background:"#33342F"}}></span><span className="nm">Graphite</span><span className="hx">#33342F</span></div>
            <div className="lb-chip"><span className="sw" style={{background:"#D6402B"}}></span><span className="nm">China marker red — print / spend</span><span className="hx">#D6402B</span></div>
            <div className="lb-chip"><span className="sw" style={{background:"#2C55A6"}}></span><span className="nm">China marker blue — notes / develop</span><span className="hx">#2C55A6</span></div>
          </div>
          <div style={{marginTop:20}}>
            <div className="lb-panel-label">The weighty moment</div>
            <div className="lb-countersign" style={{marginTop:2}}>
              <p>Pulls over <b>$1.25</b> need a countersign — you literally sign the docket before the money moves.</p>
              <div className="lb-sigbox"><span className="sig">A. Rivera</span><span className="lbl">countersign</span></div>
            </div>
          </div>
          <div className="lb-spec-note">Motion: agitation ripples while developing, frames &ldquo;fix&rdquo; from blur to sharp when done, pencil marks draw themselves on score.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LightbenchHero, LightbenchSpecimen });
