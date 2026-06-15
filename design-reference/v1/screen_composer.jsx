/* ============================================================
   StudioCreation — Composer (Create)
   Content-type picker · employee/brand chips · final-prompt
   preview · Improve · live cost calculator · image+video ·
   spend-card confirm.
   ============================================================ */

function ComposerScreen() {
  const s = window.useStudio();
  const D = s.D;
  const [ctId, setCtId] = React.useState("hero-film");
  const ct = D.CT[ctId];
  const [empId, setEmpId] = React.useState(ct.employee);
  const [brand, setBrand] = React.useState("starxi");
  const [model, setModel] = React.useState(ct.model);
  const [ratio, setRatio] = React.useState(ct.ratio);
  const [prompt, setPrompt] = React.useState("Captain lifting the trophy under stadium floodlights, slow heroic push-in, confetti haze");
  const [count, setCount] = React.useState(4);
  const [dur, setDur] = React.useState(6);
  const [audio, setAudio] = React.useState(false);
  const [fast, setFast] = React.useState(false);
  const [hi, setHi] = React.useState(false);
  const [negative, setNegative] = React.useState("");
  const [more, setMore] = React.useState(false);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [improving, setImproving] = React.useState(false);
  const [rewrites, setRewrites] = React.useState(null);
  const [spendCard, setSpendCard] = React.useState(null);

  const m = D.MODEL[model];
  const emp = D.EMP[empId];
  const isVideo = m.type === "video";

  // pick a content type -> route employee / model / ratio / dur
  function pickType(id) {
    const c = D.CT[id];
    setCtId(id); setEmpId(c.employee); setModel(c.model); setRatio(c.ratio);
    if (c.dur) setDur(c.dur);
  }

  const est = window.estimate({ model, count: isVideo ? 1 : count, dur: isVideo ? dur : 0, audio, fast, hi });
  const projected = est.total;
  const afterUsed = s.budget.usedToday + projected;
  const overCap = afterUsed > s.budget.dailyCap;
  const needsCard = projected > s.budget.spendCardThreshold;
  const afterBalance = m.provider === "fal" ? s.budget.falBalance - projected : s.budget.falBalance;

  const brandObj = brand ? D.BRANDS[brand] : null;
  const finalParts = [
    { t: prompt, base: true },
    { t: emp.style, kind: "employee" },
    brandObj && { t: brandObj.style, kind: "brand" },
  ].filter(Boolean);

  function doImprove() {
    setImproving(true); setRewrites(null);
    setTimeout(() => {
      setImproving(false);
      setRewrites([
        { tag: "Model vocabulary", note: `Tuned for ${m.name}`, text: prompt + `, ${isVideo ? "anamorphic 2.39:1, 35mm bokeh, motivated camera move" : "ultra-detailed, controlled key light, shallow depth"}, ${emp.style.split(",")[0]}` },
        { tag: "One-variable iteration", note: "Same shot, golden-hour", text: prompt.replace(/floodlights|stadium light|light/i, "golden-hour backlight") + ", warm rim, long shadows" },
        { tag: "Tighter & punchier", note: "Trimmed for clarity", text: prompt.split(",").slice(0, 2).join(",") + ", decisive composition, single hero subject" },
      ]);
    }, 1100);
  }

  function launch() {
    const spec = { model, brand, employee: empId, prompt, type: m.type, ratio,
      dur: isVideo ? dur : 0, count: isVideo ? 1 : count, cost: est.total, eta: m.eta, operator: "AR" };
    if (needsCard) { setSpendCard(spec); return; }
    if (overCap) { s.toast({ kind: "bad", icon: "shield", title: "Over daily cap", msg: `This would push today to $${afterUsed.toFixed(2)} / $${s.budget.dailyCap.toFixed(2)}` }); return; }
    s.submitJob(spec); s.setScreen("queue");
  }
  function confirmCard() { s.submitJob(spendCard); setSpendCard(null); s.setScreen("queue"); }

  const RATIOS = isVideo ? ["9:16", "1:1", "16:9", "21:9"] : ["1:1", "4:5", "4:3", "16:9", "9:16"];

  return (
    <div className="screen-pad" style={{ maxWidth: 1280 }}>
      <div className="screen-hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="t-label" style={{ color: "var(--gold)" }}>Create</span>
          <h1 className="t-h1">What are we making?</h1>
        </div>
        <div className="row gap2">
          <window.Btn variant="quiet" size="" icon="history">History</window.Btn>
        </div>
      </div>

      {/* content-type picker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10, marginBottom: 20 }}>
        {D.CONTENT_TYPES.map(c => {
          const on = c.id === ctId;
          return (
            <button key={c.id} onClick={() => pickType(c.id)} className="col gap2 typecard" style={{
              padding: "13px 13px 14px", borderRadius: 13, textAlign: "left", cursor: "pointer",
              background: on ? "var(--bg-3)" : "var(--bg-2)",
              border: `1px solid ${on ? "var(--gold-line)" : "var(--line-1)"}`,
              boxShadow: on ? "var(--glow-gold)" : "var(--el-1)", transition: "all 180ms var(--ease-out)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                background: on ? "var(--gold-wash)" : "var(--bg-1)", color: on ? "var(--gold-hi)" : "var(--tx-2)" }}>
                <window.UIIcon name={c.icon} size={17} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--tx-1)" : "var(--tx-1)" }}>{c.name}</span>
              <span className="t-xs" style={{ lineHeight: 1.35 }}>{c.desc}</span>
              <span className="mono t-xs" style={{ color: "var(--tx-4)", marginTop: 2 }}>{c.ratio} · {D.MODEL[c.model].name}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
        {/* LEFT — composer */}
        <div className="col gap4">
          <div className="card">
            {/* attached chips */}
            <div className="card-hd row between wrap gap2">
              <div className="row gap2 wrap">
                <window.Chip on icon="brand"><window.EmpAvatar id={empId} size={16} />{emp.name}</window.Chip>
                {brandObj ? (
                  <window.Chip on dot={brandObj.swatch[0]} onX={() => setBrand(null)}>
                    <window.UIIcon name="lock" size={12} />{brandObj.name}</window.Chip>
                ) : (
                  <div className="row gap1">
                    {Object.values(D.BRANDS).map(b => (
                      <window.Chip key={b.id} dot={b.swatch[0]} onClick={() => setBrand(b.id)}>{b.name}</window.Chip>
                    ))}
                  </div>
                )}
              </div>
              <div className="row gap2" style={{ position: "relative" }}>
                <button className="chip" onClick={() => setModelOpen(o => !o)}>
                  <window.UIIcon name="cpu" size={13} />{m.name}
                  <span className="mono" style={{ color: "var(--gold-hi)", fontSize: 11 }}>
                    ${isVideo ? m.price.toFixed(2) + "/s" : m.price.toFixed(3)}</span>
                  <window.UIIcon name="chevdown" size={12} />
                </button>
                {modelOpen && (
                  <div className="card" style={{ position: "absolute", top: 34, right: 0, width: 280, zIndex: 20, padding: 6, boxShadow: "var(--el-pop)" }}>
                    {D.MODELS.map(mm => (
                      <button key={mm.id} onClick={() => { setModel(mm.id); setModelOpen(false); if (mm.type === "image" && isVideo) setRatio("1:1"); }}
                        className="row between modelrow" style={{ padding: "8px 9px", borderRadius: 9, border: "none", background: mm.id === model ? "var(--bg-3)" : "transparent", cursor: "pointer", width: "100%", textAlign: "left" }}>
                        <span className="col" style={{ gap: 1 }}>
                          <span className="row gap2" style={{ fontSize: 12.5, fontWeight: 560, color: "var(--tx-1)" }}>
                            <window.Prov id={mm.provider} />{mm.name}</span>
                          <span className="t-xs">{mm.blurb}</span>
                        </span>
                        <span className="mono t-xs" style={{ color: "var(--gold-hi)" }}>${mm.type === "video" ? mm.price.toFixed(2) + "/s" : mm.price.toFixed(3)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* prompt textarea */}
            <div style={{ padding: 16 }}>
              <textarea className="input" rows={4} value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the shot. The employee + brand styles below get appended automatically." style={{ fontSize: 15, lineHeight: 1.5 }} />

              <div className="row between" style={{ marginTop: 12 }}>
                <div className="row gap2">
                  <window.Btn size="sm" variant="quiet" icon="wand" onClick={doImprove} disabled={improving}>
                    {improving ? "Improving…" : "Improve"}</window.Btn>
                  <window.Btn size="sm" variant="ghost" icon="refresh" onClick={() => setPrompt("")}>Clear</window.Btn>
                </div>
                <span className="t-xs" style={{ color: "var(--tx-4)" }}>{prompt.length} chars</span>
              </div>

              {/* improve rewrites */}
              {improving && (
                <div className="col gap2" style={{ marginTop: 12 }}>
                  {[0, 1, 2].map(i => <div key={i} className="skel" style={{ height: 56, borderRadius: 11 }} />)}
                </div>
              )}
              {rewrites && !improving && (
                <div className="col gap2" style={{ marginTop: 12 }}>
                  <span className="t-label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <window.UIIcon name="spark" size={12} style={{ color: "var(--gold)" }} />3 rewrites</span>
                  {rewrites.map((r, i) => (
                    <div key={i} className="rise row gap3" style={{ padding: 11, borderRadius: 11, background: "var(--bg-1)", border: "1px solid var(--line-1)", alignItems: "flex-start" }}>
                      <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
                        <div className="row gap2">
                          <span className="pill gold" style={{ height: 18, fontSize: 10 }}>{r.tag}</span>
                          <span className="t-xs">{r.note}</span>
                        </div>
                        <span className="t-sm" style={{ color: "var(--tx-2)", lineHeight: 1.4 }}>{r.text}</span>
                      </div>
                      <window.Btn size="sm" icon="check" onClick={() => { setPrompt(r.text); setRewrites(null); }}>Use</window.Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* final prompt preview */}
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ padding: 13, borderRadius: 11, background: "var(--bg-1)", border: "1px solid var(--line-1)" }}>
                <div className="row gap2" style={{ marginBottom: 8 }}>
                  <window.UIIcon name="eye" size={13} style={{ color: "var(--tx-3)" }} />
                  <span className="t-label">Final prompt sent to {m.name}</span>
                </div>
                <p className="mono" style={{ fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>
                  <span style={{ color: "var(--tx-1)" }}>{prompt || "…"}</span>
                  <span style={{ color: "var(--gold-dim)" }}>, {emp.style}</span>
                  {brandObj && <span style={{ color: "var(--strikelab)" }}>, {brandObj.style}</span>}
                  {negative && <span style={{ color: "var(--bad)" }}> — no {negative}</span>}
                </p>
                <div className="row gap2" style={{ marginTop: 9, flexWrap: "wrap" }}>
                  <span className="t-xs" style={{ color: "var(--gold-dim)" }}>● appended by {emp.name}</span>
                  {brandObj && <span className="t-xs" style={{ color: "var(--strikelab)" }}>● {brandObj.name} brand lock</span>}
                </div>
              </div>
            </div>
          </div>

          {/* output controls */}
          <div className="card card-pad gap4">
            <div className="between">
              <span className="t-h3">Output</span>
              <window.Seg value={ratio} onChange={setRatio} options={RATIOS.map(r => ({ value: r, label: r }))} />
            </div>

            {isVideo ? (
              <div className="col gap4">
                <div className="col gap2">
                  <div className="between"><span className="t-sm">Duration</span><span className="mono t-sm" style={{ color: "var(--gold-hi)" }}>{dur}s</span></div>
                  <input type="range" min="2" max="12" step="1" value={dur} onChange={e => setDur(+e.target.value)} className="rng" />
                </div>
                <label className="row between toggle">
                  <span className="row gap2"><window.UIIcon name="bolt" size={14} style={{ color: "var(--tx-3)" }} />Native audio <span className="mono t-xs" style={{ color: "var(--tx-4)" }}>+${m.audio?.toFixed(2)}/s</span></span>
                  <input type="checkbox" checked={audio} onChange={e => setAudio(e.target.checked)} className="sw" />
                </label>
              </div>
            ) : (
              <div className="col gap2">
                <div className="between"><span className="t-sm">Variations</span><span className="mono t-sm" style={{ color: "var(--gold-hi)" }}>{count} images</span></div>
                <input type="range" min="1" max="8" step="1" value={count} onChange={e => setCount(+e.target.value)} className="rng" />
              </div>
            )}

            {/* advanced */}
            <button className="row between" onClick={() => setMore(!more)} style={{ background: "none", border: "none", color: "var(--tx-2)", cursor: "pointer", padding: "2px 0" }}>
              <span className="row gap2"><window.UIIcon name="sliders" size={14} />More controls</span>
              <window.UIIcon name="chevdown" size={15} style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
            </button>
            {more && (
              <div className="col gap3 rise" style={{ paddingTop: 2 }}>
                <label className="row between toggle"><span className="row gap2"><window.UIIcon name="zap" size={14} style={{ color: "var(--tx-3)" }} />Fast lane <span className="t-xs" style={{ color: "var(--tx-4)" }}>×1.25</span></span><input type="checkbox" checked={fast} onChange={e => setFast(e.target.checked)} className="sw" /></label>
                <label className="row between toggle"><span className="row gap2"><window.UIIcon name="image" size={14} style={{ color: "var(--tx-3)" }} />4K tier <span className="t-xs" style={{ color: "var(--tx-4)" }}>×1.6</span></span><input type="checkbox" checked={hi} onChange={e => setHi(e.target.checked)} className="sw" /></label>
                <div className="col gap2">
                  <span className="t-sm">Negative prompt</span>
                  <input className="input" value={negative} onChange={e => setNegative(e.target.value)} placeholder="text artifacts, extra limbs, watermark…" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — cost calculator (sticky) */}
        <div className="col gap4" style={{ position: "sticky", top: 0 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-hd row gap2">
              <window.UIIcon name="costs" size={15} style={{ color: "var(--gold)" }} />
              <span className="t-h3">Cost calculator</span>
            </div>
            <div className="col gap3" style={{ padding: 16 }}>
              {/* math lines */}
              <div className="col gap2">
                {est.lines.map((l, i) => (
                  <div key={i} className="between">
                    <span className="t-sm" style={{ color: "var(--tx-2)" }}>{l.label}</span>
                    <span className="row gap3">
                      <span className="mono t-xs" style={{ color: "var(--tx-4)" }}>{l.math}</span>
                      <span className="mono t-sm" style={{ minWidth: 56, textAlign: "right" }}>${l.val.toFixed(3)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="hr" />
              {/* total */}
              <div className="between" style={{ alignItems: "baseline" }}>
                <span className="t-h3">Estimate</span>
                <span className="mono" style={{ fontSize: 30, fontWeight: 680, letterSpacing: "-0.03em",
                  color: needsCard ? "var(--gold-hi)" : "var(--tx-1)" }}>${projected.toFixed(2)}</span>
              </div>

              {/* fuel gauge w/ projected */}
              <div className="col gap2" style={{ marginTop: 4 }}>
                <div className="between" style={{ whiteSpace: "nowrap" }}>
                  <span className="t-label">After this job</span>
                  <span className="mono t-xs" style={{ color: overCap ? "var(--bad)" : "var(--tx-2)" }}>
                    ${afterUsed.toFixed(2)} / ${s.budget.dailyCap.toFixed(2)}</span>
                </div>
                <window.Gauge used={s.budget.usedToday} cap={s.budget.dailyCap} projected={projected} height={10} />
                <div className="between">
                  <span className="mono t-xs" style={{ color: "var(--tx-3)" }}>now ${s.budget.usedToday.toFixed(2)}</span>
                  <span className="mono t-xs" style={{ color: overCap ? "var(--bad)" : "var(--gold-hi)" }}>
                    {overCap ? "exceeds cap" : `$${(s.budget.dailyCap - afterUsed).toFixed(2)} left after`}</span>
                </div>
              </div>

              {/* balance after */}
              <div className="row between" style={{ padding: "9px 11px", borderRadius: 10, background: "var(--bg-1)", border: "1px solid var(--line-1)" }}>
                <span className="t-xs row gap2"><window.Prov id={m.provider} /> balance after</span>
                <span className="mono t-sm" style={{ color: afterBalance < 10 ? "var(--gold-hi)" : "var(--tx-1)" }}>
                  {m.provider === "fal" ? "$" + afterBalance.toFixed(2) : s.budget.higgsCredits + " cr"}</span>
              </div>

              {needsCard && (
                <div className="row gap2 rise" style={{ padding: "9px 11px", borderRadius: 10, background: "var(--gold-wash)", color: "var(--gold-hi)", fontSize: 11.5 }}>
                  <window.UIIcon name="shield" size={14} />Over ${s.budget.spendCardThreshold.toFixed(2)} — needs spend-card confirm
                </div>
              )}

              <window.Btn variant="primary" size="lg" icon={isVideo ? "film" : "image"} onClick={launch}
                style={{ width: "100%", marginTop: 2 }}>
                {needsCard ? "Review spend card" : `Generate · $${projected.toFixed(2)}`}
              </window.Btn>
              <span className="t-xs" style={{ textAlign: "center", color: "var(--tx-4)" }}>
                ~{m.eta}s · {isVideo ? `${dur}s ${ratio}` : `${count}× ${ratio}`} · syncs to local archive
              </span>
            </div>
          </div>

          {/* prompt history */}
          <div className="card">
            <div className="card-hd between"><span className="t-h3">Recent prompts</span><window.UIIcon name="history" size={15} style={{ color: "var(--tx-4)" }} /></div>
            <div className="col" style={{ padding: 8 }}>
              {["Captain lifting trophy, floodlights, slow push-in", "Squad value infographic, gold accents, 4:5", "StrikeLab driver macro, cool teal rim"].map((p, i) => (
                <button key={i} onClick={() => setPrompt(p)} className="row gap2 scorerow" style={{ padding: "8px 9px", borderRadius: 9, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <window.UIIcon name="history" size={13} style={{ color: "var(--tx-4)", flex: "none" }} />
                  <span className="t-xs" style={{ color: "var(--tx-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SPEND CARD modal */}
      {spendCard && (
        <window.Sheet onClose={() => setSpendCard(null)} width={460}>
          <div className="col" style={{ padding: 22, gap: 16 }}>
            <div className="row gap3">
              <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gold-wash)", color: "var(--gold-hi)" }}>
                <window.UIIcon name="shield" size={20} />
              </div>
              <div className="col" style={{ gap: 1 }}>
                <span className="t-h2">Confirm spend</span>
                <span className="t-sm">This job is over your ${s.budget.spendCardThreshold.toFixed(2)} auto-approve limit.</span>
              </div>
            </div>
            <div className="col gap2" style={{ padding: 15, borderRadius: 13, background: "var(--bg-1)", border: "1px solid var(--line-2)" }}>
              {[
                ["Model", `${m.name}`],
                ["Output", isVideo ? `${dur}s video · ${ratio}${audio ? " · audio" : ""}` : `${count} images · ${ratio}`],
                ["Employee", emp.name],
                ["Brand", brandObj ? brandObj.name : "—"],
              ].map(([k, v]) => (
                <div key={k} className="between"><span className="t-sm" style={{ color: "var(--tx-3)" }}>{k}</span><span className="t-sm" style={{ color: "var(--tx-1)" }}>{v}</span></div>
              ))}
              <div className="hr" style={{ margin: "4px 0" }} />
              <div className="between" style={{ alignItems: "baseline" }}>
                <span className="t-sm" style={{ color: "var(--tx-3)" }}>Total cost</span>
                <span className="mono" style={{ fontSize: 24, fontWeight: 680, color: "var(--gold-hi)" }}>${projected.toFixed(2)}</span>
              </div>
              <div className="between"><span className="t-xs">Daily budget after</span><span className="mono t-xs" style={{ color: overCap ? "var(--bad)" : "var(--tx-2)" }}>${afterUsed.toFixed(2)} / ${s.budget.dailyCap.toFixed(2)}</span></div>
            </div>
            {overCap && <div className="row gap2" style={{ color: "var(--bad)", fontSize: 12 }}><window.UIIcon name="x" size={14} />This exceeds today's shared cap.</div>}
            <div className="row gap2" style={{ justifyContent: "flex-end" }}>
              <window.Btn variant="quiet" onClick={() => setSpendCard(null)}>Cancel</window.Btn>
              <window.Btn variant="primary" icon="check" onClick={confirmCard} disabled={overCap}>Approve ${projected.toFixed(2)}</window.Btn>
            </div>
          </div>
        </window.Sheet>
      )}
    </div>
  );
}

window.ComposerScreen = ComposerScreen;
if (!document.getElementById("__comp_kf")) {
  const st = document.createElement("style"); st.id = "__comp_kf";
  st.textContent = `
    .typecard:hover{border-color:var(--line-3)!important}
    .modelrow:hover{background:var(--bg-2)!important}
    .toggle{padding:9px 11px;border-radius:10px;background:var(--bg-1);border:1px solid var(--line-1);font-size:13px;cursor:pointer}
    input.rng{-webkit-appearance:none;width:100%;height:6px;border-radius:999px;background:rgba(255,255,255,0.08);outline:none}
    input.rng::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:linear-gradient(180deg,var(--gold-hi),var(--gold));box-shadow:0 1px 4px rgba(0,0,0,0.5),0 0 0 1px var(--gold-dim);cursor:pointer}
    input.sw{-webkit-appearance:none;width:34px;height:20px;border-radius:999px;background:var(--bg-4);position:relative;cursor:pointer;transition:background 160ms;flex:none}
    input.sw:checked{background:var(--gold)}
    input.sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform 180ms var(--ease-spring)}
    input.sw:checked::after{transform:translateX(14px)}
  `;
  document.head.appendChild(st);
}
