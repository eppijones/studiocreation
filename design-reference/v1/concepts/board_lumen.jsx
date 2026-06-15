/* ============================================================
   Direction D — LUMEN
   Light as material. The interface is a lens: frosted glass
   panes over a luminous field; blur is hierarchy; the content's
   own color blooms through the optics. Budget = today's light.
   Exposes: window.LumenHero, window.LumenSpecimen
   ============================================================ */

const lmCSS = `
.lm {
  --ink: #21242B;
  --ink2: #5C6270;
  --ink3: #9AA0AD;
  --line: rgba(33,36,43,0.10);
  --glass: rgba(255,255,255,0.55);
  --glass2: rgba(255,255,255,0.72);
  font-family: "Hanken Grotesk", sans-serif;
  color: var(--ink);
  width: 100%; height: 100%; position: relative; overflow: hidden;
  background:
    radial-gradient(90% 70% at 78% 8%, rgba(120,190,255,0.20), transparent 60%),
    radial-gradient(70% 60% at 8% 90%, rgba(255,150,190,0.13), transparent 55%),
    radial-gradient(60% 50% at 45% 55%, rgba(140,255,220,0.10), transparent 60%),
    linear-gradient(168deg, #FFFFFF 0%, #F4F7FB 52%, #EEF2F8 100%);
}
.lm * { box-sizing: border-box; }
.lm-mono { font-family: "Chivo Mono", monospace; font-variant-numeric: tabular-nums; }
.lm-caps { text-transform: uppercase; letter-spacing: 0.24em; font-weight: 600; }
.lm-caustic {
  position: absolute; inset: -20%; pointer-events: none; opacity: 0.5; filter: blur(40px);
  background:
    conic-gradient(from 210deg at 70% 20%, transparent 0deg, rgba(150,210,255,0.16) 40deg, transparent 90deg, rgba(255,170,210,0.10) 160deg, transparent 220deg, rgba(160,255,225,0.12) 300deg, transparent 360deg);
}
.lm-spectral { position: relative; }
.lm-spectral::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(120deg, rgba(110,200,255,0.85), rgba(190,140,255,0.55) 38%, rgba(255,150,170,0.5) 64%, rgba(140,235,200,0.75));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
}

/* top bar */
.lm-top {
  display: grid; grid-template-columns: 300px 1fr 300px; align-items: center;
  padding: 22px 36px 0; gap: 30px; position: relative; z-index: 2;
}
.lm-word { display: flex; align-items: baseline; gap: 12px; }
.lm-word b { font-size: 17px; font-weight: 700; letter-spacing: 0.02em; }
.lm-word span { font-size: 10px; color: var(--ink3); letter-spacing: 0.3em; text-transform: uppercase; }
.lm-beam-wrap { text-align: center; }
.lm-beam-label { display: flex; justify-content: space-between; font-size: 10px; color: var(--ink2); letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 7px; }
.lm-beam {
  height: 14px; border-radius: 8px; position: relative; overflow: hidden;
  background: rgba(33,36,43,0.06);
}
.lm-beam .lit {
  position: absolute; inset: 0 0 0 0; width: 63.2%;
  background: linear-gradient(90deg, rgba(120,190,255,0.55), rgba(190,150,255,0.5) 45%, rgba(255,160,180,0.5) 80%, rgba(255,200,160,0.55));
  filter: saturate(0.4) brightness(1.04);
}
.lm-beam .rem {
  position: absolute; top: 0; bottom: 0; left: 63.2%; right: 0;
  background: linear-gradient(90deg, #FFF7E8, #FFFFFF 40%, #F0FAFF);
  box-shadow: 0 0 18px 2px rgba(255,255,255,0.95), 0 0 4px rgba(150,200,255,0.6);
}
.lm-beam .warnpin { position: absolute; top: -4px; bottom: -4px; left: 76%; width: 1.5px; background: var(--ink); opacity: 0.5; }
.lm-top-right { display: flex; justify-content: flex-end; gap: 18px; font-size: 11px; color: var(--ink2); align-items: center; }
.lm-top-right b { color: var(--ink); font-weight: 600; }
.lm-op { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(140deg, #DCE8F8, #C3D4EE); display: grid; place-items: center; font-size: 10px; font-weight: 700; color: #4A5878; }

/* dock */
.lm-dock {
  position: absolute; left: 24px; top: 116px; bottom: 26px; width: 86px; z-index: 3;
  display: flex; flex-direction: column; gap: 6px; padding: 10px 8px;
  background: var(--glass); backdrop-filter: blur(20px); border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 18px 50px -28px rgba(60,80,120,0.35);
}
.lm-dock-item {
  border-radius: 14px; padding: 9px 4px 8px; text-align: center; cursor: pointer;
  color: var(--ink2); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 600;
}
.lm-dock-item i {
  display: block; width: 22px; height: 22px; margin: 0 auto 5px; border-radius: 7px;
  border: 1.5px solid currentColor; opacity: 0.75; position: relative;
}
.lm-dock-item i::after { content: ""; position: absolute; inset: 4px; border-radius: 3px; background: currentColor; opacity: 0.25; }
.lm-dock-item.on { background: rgba(255,255,255,0.9); color: var(--ink); box-shadow: 0 6px 18px -8px rgba(60,80,120,0.35); }
.lm-dock-item.on i { opacity: 1; }
.lm-dock-sp { flex: 1; }

/* main panes */
.lm-main { position: absolute; left: 138px; right: 36px; top: 112px; bottom: 26px; display: grid; grid-template-columns: 1fr 426px; gap: 24px; z-index: 2; }
.lm-pane {
  background: var(--glass); backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.85); border-radius: 24px;
  box-shadow: 0 24px 70px -38px rgba(60,80,120,0.4);
  padding: 22px 26px;
}
.lm-h { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
.lm-h h3 { margin: 0; font-size: 12px; letter-spacing: 0.26em; text-transform: uppercase; font-weight: 700; color: var(--ink2); }
.lm-h .sub { font-size: 11px; color: var(--ink3); }

/* render jobs: sharpening */
.lm-job { display: grid; grid-template-columns: 168px 1fr; gap: 18px; padding: 14px 0; border-top: 1px solid var(--line); }
.lm-job:first-of-type { border-top: none; padding-top: 2px; }
.lm-thumb { height: 96px; border-radius: 14px; position: relative; overflow: hidden; }
.lm-thumb .blurred { position: absolute; inset: 0; filter: blur(14px) saturate(1.15); transform: scale(1.15); }
.lm-thumb .sharp { position: absolute; inset: 0; }
.lm-thumb .veil { position: absolute; inset: 0; backdrop-filter: blur(10px); background: rgba(255,255,255,0.08); }
.lm-thumb .pct {
  position: absolute; left: 8px; bottom: 7px; font-family: "Chivo Mono", monospace;
  font-size: 10px; color: #fff; background: rgba(20,24,32,0.4); backdrop-filter: blur(6px);
  padding: 3px 8px; border-radius: 7px; letter-spacing: 0.08em;
}
.lm-job-info p { margin: 0 0 8px; font-size: 14.5px; line-height: 1.4; font-weight: 500; }
.lm-job-meta { display: flex; gap: 14px; font-size: 11px; color: var(--ink2); margin-bottom: 9px; }
.lm-job-meta b { font-weight: 600; color: var(--ink); }
.lm-focusbar { height: 5px; border-radius: 3px; background: rgba(33,36,43,0.07); position: relative; overflow: hidden; }
.lm-focusbar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: linear-gradient(90deg, rgba(120,190,255,0.9), rgba(160,150,255,0.9)); }
.lm-focusbar .lead { position: absolute; top: -2px; bottom: -2px; width: 9px; border-radius: 5px; background: #fff; box-shadow: 0 0 10px 2px rgba(140,180,255,0.9); }
.lm-job .state { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #4D7FBE; font-weight: 700; margin-top: 7px; }
.lm-job.qd .state { color: var(--ink3); }
.lm-job.qd .lm-thumb { opacity: 0.55; }

/* shelf */
.lm-shelf { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-top: 6px; }
.lm-tile { position: relative; }
.lm-tile .art { height: 88px; border-radius: 12px; box-shadow: 0 14px 30px -18px rgba(60,80,120,0.55); }
.lm-tile .score {
  position: absolute; top: -8px; right: -6px; width: 26px; height: 26px; border-radius: 50%;
  display: grid; place-items: center; font-family: "Chivo Mono", monospace; font-size: 11px; font-weight: 600;
  background: rgba(255,255,255,0.92); color: var(--ink);
}
.lm-tile .score.hi { box-shadow: 0 0 0 1.5px rgba(255,255,255,1), 0 0 16px 4px rgba(255,235,170,0.9); }
.lm-tile .score.mid { box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 0 8px 1px rgba(170,200,255,0.55); }
.lm-tile .score.lo { color: var(--ink3); box-shadow: 0 0 0 1px rgba(33,36,43,0.12); }
.lm-tile .cap { margin-top: 7px; font-size: 10px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* composer */
.lm-prompt {
  border-radius: 14px; background: var(--glass2); border: 1px solid rgba(255,255,255,0.9);
  padding: 13px 15px; font-size: 14.5px; line-height: 1.45; min-height: 74px; font-weight: 500;
}
.lm-prompt .caret { color: #4D7FBE; }
.lm-models { margin: 14px 0 4px; }
.lm-model {
  display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: baseline;
  padding: 10px 12px; border-radius: 12px; font-size: 13.5px; cursor: pointer; color: var(--ink2);
}
.lm-model b { font-weight: 600; color: var(--ink); }
.lm-model .rate { font-size: 11px; }
.lm-model .est { font-size: 12px; }
.lm-model.sel { background: rgba(255,255,255,0.85); border-radius: 12px; }
.lm-model.sel .est { color: var(--ink); font-weight: 600; }
.lm-costrow { display: flex; align-items: baseline; justify-content: space-between; padding: 12px 4px 4px; border-top: 1px solid var(--line); margin-top: 8px; }
.lm-costrow .k { font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--ink2); font-weight: 700; }
.lm-costrow .v { font-family: "Chivo Mono", monospace; font-size: 46px; font-weight: 300; letter-spacing: -0.03em; }
.lm-costrow .v small { font-size: 16px; color: var(--ink2); }
.lm-after { font-size: 11px; color: var(--ink2); padding: 0 4px 10px; }
.lm-after b { color: var(--ink); }

/* focal commit */
.lm-focal {
  margin-top: 10px; border-radius: 18px; padding: 16px; display: grid;
  grid-template-columns: 64px 1fr; gap: 14px; align-items: center;
  background: rgba(255,255,255,0.78);
}
.lm-lens { width: 64px; height: 64px; border-radius: 50%; position: relative;
  background: radial-gradient(circle at 36% 30%, rgba(255,255,255,0.95), rgba(210,230,255,0.5) 55%, rgba(160,190,255,0.35));
  box-shadow: inset 0 0 0 1.5px rgba(120,160,230,0.5), 0 6px 22px -8px rgba(90,130,220,0.6);
}
.lm-lens::before { content: ""; position: absolute; inset: 13px; border-radius: 50%; border: 1px dashed rgba(90,130,220,0.55); }
.lm-lens::after { content: "1.84"; position: absolute; inset: 0; display: grid; place-items: center; font-family: "Chivo Mono", monospace; font-size: 13px; font-weight: 600; color: #3D5C96; }
.lm-focal p { margin: 0 0 9px; font-size: 11.5px; line-height: 1.45; color: var(--ink2); }
.lm-focal p b { color: var(--ink); }
.lm-holdbtn {
  border: none; width: 100%; border-radius: 12px; padding: 11px; cursor: pointer;
  font-family: "Hanken Grotesk", sans-serif; font-size: 12px; letter-spacing: 0.2em;
  text-transform: uppercase; font-weight: 700; color: #fff;
  background: linear-gradient(120deg, #5B8DEF, #7A6CEB 60%, #9D5BD8);
  box-shadow: 0 10px 26px -10px rgba(100,110,230,0.7);
}
.lm-holdbtn small { display: block; font-size: 9px; letter-spacing: 0.14em; opacity: 0.8; margin-top: 3px; font-weight: 500; }

/* specimen */
.lm-spec { display: grid; grid-template-columns: 1fr 1fr 1fr; height: 100%; gap: 20px; padding: 30px 32px; position: relative; z-index: 2; }
.lm-spec-col { border-radius: 22px; background: var(--glass); backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,0.85); padding: 26px 28px; display: flex; flex-direction: column; }
.lm-spec-kick { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--ink3); font-weight: 700; margin-bottom: 14px; }
.lm-spec-xl { font-size: 76px; font-weight: 250; letter-spacing: -0.02em; line-height: 1; margin: 6px 0 8px; }
.lm-spec-sub { font-size: 18px; font-weight: 600; margin: 0 0 14px; color: #4D6FAE; }
.lm-spec-body { font-size: 13.5px; line-height: 1.6; color: var(--ink2); }
.lm-spec-body b { color: var(--ink); }
.lm-chips { display: grid; gap: 8px; margin-top: 12px; }
.lm-chip { display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 12px; background: rgba(255,255,255,0.7); border-radius: 12px; padding: 6px; }
.lm-chip .sw { height: 38px; border-radius: 8px; }
.lm-chip .nm { font-size: 12.5px; font-weight: 600; }
.lm-chip .hx { font-family: "Chivo Mono", monospace; font-size: 9.5px; color: var(--ink3); padding-right: 8px; }
.lm-spec-note { font-size: 11.5px; color: var(--ink2); margin-top: auto; line-height: 1.55; padding-top: 14px; }
`;

const lmArt = (h, c = 0.13) => ({ background: `linear-gradient(140deg, oklch(0.78 ${c} ${h}), oklch(0.55 ${c + 0.04} ${h + 40}))` });

function LumenHero() {
  return (
    <div className="lm">
      <style>{lmCSS}</style>
      <div className="lm-caustic"></div>

      <div className="lm-top">
        <div className="lm-word"><b>StudioCreation</b><span>Lumen</span></div>
        <div className="lm-beam-wrap">
          <div className="lm-beam-label lm-mono"><span>TODAY&rsquo;S LIGHT — $2.76 REMAINING</span><span>BURNED $4.74 OF $7.50</span></div>
          <div className="lm-beam"><span className="lit"></span><span className="rem"></span><span className="warnpin"></span></div>
        </div>
        <div className="lm-top-right lm-mono">
          <span>FAL <b>$18.30</b></span>
          <span>HIGGS <b>240</b></span>
          <span className="lm-op">AR</span>
        </div>
      </div>

      <nav className="lm-dock">
        {["Home","Compose","Queue","Library","Spend","Briefs","Handoff"].map((n, i) => (
          <span key={n} className={"lm-dock-item" + (i === 0 ? " on" : "")}><i></i>{n}</span>
        ))}
        <span className="lm-dock-sp"></span>
        <span className="lm-dock-item"><i></i>Tweaks</span>
      </nav>

      <main className="lm-main">
        <div>
          <section className="lm-pane" style={{marginBottom: 22}}>
            <div className="lm-h"><h3>Rendering — sharpening now</h3><span className="sub lm-mono">2 LIVE · 2 QUEUED</span></div>
            <div className="lm-job">
              <div className="lm-thumb">
                <div className="blurred" style={lmArt(28, 0.16)}></div>
                <div className="sharp" style={{...lmArt(28, 0.16), clipPath: "inset(0 38% 0 0)"}}></div>
                <span className="pct">62% · 0:47</span>
              </div>
              <div className="lm-job-info">
                <p>Anamorphic stadium tunnel, players emerging into floodlight haze, slow dolly push</p>
                <div className="lm-job-meta"><span><b>Kling 3 Pro</b> · 21:9 · 6s</span><span className="lm-mono">$0.84</span><span>op AR</span></div>
                <div className="lm-focusbar"><i style={{width:"62%"}}></i><span className="lead" style={{left:"60%"}}></span></div>
                <div className="state">Coming into focus</div>
              </div>
            </div>
            <div className="lm-job">
              <div className="lm-thumb">
                <div className="blurred" style={lmArt(96, 0.14)}></div>
                <div className="sharp" style={{...lmArt(96, 0.14), clipPath: "inset(0 66% 0 0)"}}></div>
                <span className="pct">34% · 0:07</span>
              </div>
              <div className="lm-job-info">
                <p>Squad value infographic ×4 — legible figures, 4:5</p>
                <div className="lm-job-meta"><span><b>GPT Image 2</b> · ×4</span><span className="lm-mono">$0.24</span><span>op JN</span></div>
                <div className="lm-focusbar"><i style={{width:"34%"}}></i><span className="lead" style={{left:"32%"}}></span></div>
                <div className="state">Coming into focus</div>
              </div>
            </div>
            <div className="lm-job qd">
              <div className="lm-thumb"><div className="blurred" style={lmArt(190, 0.1)}></div></div>
              <div className="lm-job-info">
                <p>StrikeLab driver head turnaround ×6, cool-grey seamless</p>
                <div className="lm-job-meta"><span><b>Nano Banana Pro</b> · ×6</span><span className="lm-mono">$0.23</span><span>op AR</span></div>
                <div className="lm-focusbar"></div>
                <div className="state">Waiting for light</div>
              </div>
            </div>
          </section>

          <section className="lm-pane">
            <div className="lm-h"><h3>Library — latest</h3><span className="sub">score = luminance · 10 glows</span></div>
            <div className="lm-shelf">
              <div className="lm-tile"><div className="art" style={lmArt(150)}></div><span className="score hi lm-mono">10</span><div className="cap">keeper ref sheet ×6</div></div>
              <div className="lm-tile"><div className="art" style={lmArt(28)}></div><span className="score mid lm-mono">9</span><div className="cap">hero tunnel push v3</div></div>
              <div className="lm-tile"><div className="art" style={lmArt(320)}></div><span className="score mid lm-mono">9</span><div className="cap">campaign frame</div></div>
              <div className="lm-tile"><div className="art" style={lmArt(200)}></div><span className="score mid lm-mono">7</span><div className="cap">social teaser 8s</div></div>
              <div className="lm-tile"><div className="art" style={lmArt(48)}></div><span className="score lo lm-mono">6</span><div className="cap">storyboard beats</div></div>
              <div className="lm-tile"><div className="art" style={lmArt(280)}></div><span className="score mid lm-mono">8</span><div className="cap">GROUP STAGE type</div></div>
            </div>
          </section>
        </div>

        <section className="lm-pane lm-spectral" style={{borderRadius: 24}}>
          <div className="lm-h"><h3>New render</h3><span className="sub lm-mono">DOCKET 0805 · STARXI</span></div>
          <div className="lm-prompt">StarXI captain figurine, deep green kit, studio rim light, collectible gloss<span className="caret">▎</span></div>
          <div className="lm-models">
            <div className="lm-model"><span><b>FLUX dev</b> — balanced</span><span className="rate lm-mono">$0.025/img</span><span className="est lm-mono">$0.10</span></div>
            <div className="lm-model sel"><span><b>Kling 3 Pro</b> — premium motion</span><span className="rate lm-mono">$0.14/s · 6s ×2</span><span className="est lm-mono">$1.84</span></div>
            <div className="lm-model"><span><b>Veo 3.1</b> — cinematic + audio</span><span className="rate lm-mono">$0.12/s · 6s ×2</span><span className="est lm-mono">$1.58</span></div>
          </div>
          <div className="lm-costrow"><span className="k">Light required</span><span className="v">$1.84</span></div>
          <div className="lm-after">Leaves <b>$0.92</b> of today&rsquo;s light · 33% of remaining</div>
          <div className="lm-focal">
            <div className="lm-lens"></div>
            <div>
              <p>Above <b>$1.25</b>, the lens must be brought to focus — <b>hold</b> until the ring closes. A tap is never enough.</p>
              <button className="lm-holdbtn">Hold to focus &amp; render<small>740ms · releases early = nothing spent</small></button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function LumenSpecimen() {
  return (
    <div className="lm">
      <style>{lmCSS}</style>
      <div className="lm-caustic"></div>
      <div className="lm-spec">
        <div className="lm-spec-col">
          <div className="lm-spec-kick">Direction D</div>
          <div className="lm-spec-xl">Lumen</div>
          <div className="lm-spec-sub">Light is the material. Blur is hierarchy.</div>
          <p className="lm-spec-body">
            The interface is a stack of optical glass over a luminous field. Whatever you&rsquo;re
            working on is <b>in focus</b>; everything else recedes into frost. The renders supply
            all the color — they bloom through the panes — while the UI stays colorless glass.
            Budget is <b>today&rsquo;s light</b>: a beam that visibly dims as you burn it.
            Processing is literal: jobs <b>sharpen from blur</b> as they render.
          </p>
          <div className="lm-spec-note">
            Plain software words — Home, Compose, Queue, Library, Spend — because the metaphor
            lives in the optics, not the nouns. Floating dock, no sidebar, no cards: panes at depths.
          </div>
        </div>
        <div className="lm-spec-col">
          <div className="lm-spec-kick">Type</div>
          <div className="lm-spec-xl" style={{fontSize: 54}}>Hanken Grotesk</div>
          <p className="lm-spec-body">
            One engineered family, used by <b>weight as depth</b>: 250 for the big numerals
            (light passes through), 500–600 for working text, 700 letterspaced micro-caps for
            structure. No second display face — restraint is the luxury.
          </p>
          <p className="lm-spec-body lm-mono" style={{fontSize: 12, lineHeight: 1.9, marginTop: 14}}>
            CHIVO MONO — telemetry &amp; money<br/>$0.14/s · 62% · 0:47 · $1.84
          </p>
          <div className="lm-costrow" style={{borderTop: "none", paddingTop: 4}}><span className="k">Light required</span><span className="v">$1.84</span></div>
          <div className="lm-spec-note">Scale: 76 / 46 mono / 14.5 body / 11 micro-caps. Spectral hairline = selection, never decoration.</div>
        </div>
        <div className="lm-spec-col">
          <div className="lm-spec-kick">Optics, not pigment</div>
          <div className="lm-chips">
            <div className="lm-chip"><span className="sw" style={{background: "linear-gradient(140deg,#FFFFFF,#EEF2F8)"}}></span><span className="nm">Luminous field</span><span className="hx">#FFF→#EEF2F8</span></div>
            <div className="lm-chip"><span className="sw" style={{background: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)", border: "1px solid #fff"}}></span><span className="nm">Frosted glass — all surfaces</span><span className="hx">white @ 55% + blur</span></div>
            <div className="lm-chip"><span className="sw" style={{background: "#21242B"}}></span><span className="nm">Graphite ink</span><span className="hx">#21242B</span></div>
            <div className="lm-chip"><span className="sw" style={{background: "linear-gradient(120deg,#5B8DEF,#7A6CEB,#9D5BD8)"}}></span><span className="nm">Focal gradient — spend actions only</span><span className="hx">5B8DEF→9D5BD8</span></div>
          </div>
          <div style={{marginTop: 18}}>
            <div className="lm-spec-kick">The weighty moment</div>
            <div className="lm-focal" style={{marginTop: 2}}>
              <div className="lm-lens"></div>
              <div>
                <p>Above <b>$1.25</b>: hold until the lens ring closes. Release early, nothing is spent.</p>
                <button className="lm-holdbtn">Hold to focus &amp; render</button>
              </div>
            </div>
          </div>
          <div className="lm-spec-note">Motion: focus pulls (blur→sharp), light blooms on completion, the beam dims in real time. Nothing slides — things resolve.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LumenHero, LumenSpecimen });
