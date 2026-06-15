/* ============================================================
   StudioCreation — Gallery / Review
   Masonry · filter rail · scoring lightbox (0-10, pass >= 8)
   ============================================================ */

function FilterGroup({ title, children }) {
  return (
    <div className="col gap2">
      <span className="t-label">{title}</span>
      <div className="row wrap gap1">{children}</div>
    </div>
  );
}

function GalleryScreen() {
  const s = window.useStudio();
  const D = s.D;
  const layout = s.galleryLayout;
  const setLayout = s.setGalleryLayout;
  const [fBrand, setFBrand] = React.useState(null);
  const [fType, setFType] = React.useState(null);
  const [fProvider, setFProvider] = React.useState(null);
  const [fScore, setFScore] = React.useState(null); // 'unscored' | 'pass' | 'hero'
  const [fOp, setFOp] = React.useState(null);
  const [q, setQ] = React.useState("");
  const [lightId, setLightId] = React.useState(null);

  const filtered = s.assets.filter(a => {
    if (fBrand && a.brand !== fBrand) return false;
    if (fType && a.type !== fType) return false;
    if (fProvider && a.provider !== fProvider) return false;
    if (fOp && a.operator !== fOp) return false;
    if (fScore === "unscored" && a.score != null) return false;
    if (fScore === "pass" && !(a.score >= 8)) return false;
    if (fScore === "hero" && a.score !== 10) return false;
    if (q && !a.prompt.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const lightIdx = filtered.findIndex(a => a.id === lightId);
  const light = lightIdx >= 0 ? filtered[lightIdx] : null;
  function nav(d) {
    const ni = lightIdx + d;
    if (ni >= 0 && ni < filtered.length) setLightId(filtered[ni].id);
  }
  React.useEffect(() => {
    if (!light) return;
    const h = (e) => { if (e.key === "ArrowRight") nav(1); if (e.key === "ArrowLeft") nav(-1); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [light, lightIdx, filtered]);

  const ops = ["AR", "JN", "MK"];
  const anyFilter = fBrand || fType || fProvider || fScore || fOp || q;

  return (
    <div className="row" style={{ height: "100%", alignItems: "stretch" }}>
      {/* FILTER RAIL */}
      <div className="col gap5" style={{ width: 210, flex: "none", padding: "22px 16px", borderRight: "1px solid var(--line-1)", overflow: "auto" }}>
        <div className="between">
          <span className="t-h3">Filters</span>
          {anyFilter && <button onClick={() => { setFBrand(null); setFType(null); setFProvider(null); setFScore(null); setFOp(null); setQ(""); }}
            className="t-xs" style={{ background: "none", border: "none", color: "var(--gold-hi)", cursor: "pointer" }}>Clear</button>}
        </div>
        <FilterGroup title="Project">
          {Object.values(D.BRANDS).map(b => (
            <window.Chip key={b.id} dot={b.swatch[0]} on={fBrand === b.id} onClick={() => setFBrand(fBrand === b.id ? null : b.id)}>{b.name}</window.Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Type">
          <window.Chip icon="image" on={fType === "image"} onClick={() => setFType(fType === "image" ? null : "image")}>Image</window.Chip>
          <window.Chip icon="video" on={fType === "video"} onClick={() => setFType(fType === "video" ? null : "video")}>Video</window.Chip>
        </FilterGroup>
        <FilterGroup title="Provider">
          <window.Chip on={fProvider === "fal"} onClick={() => setFProvider(fProvider === "fal" ? null : "fal")}><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--fal)" }} />fal</window.Chip>
          <window.Chip on={fProvider === "higgs"} onClick={() => setFProvider(fProvider === "higgs" ? null : "higgs")}><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--higgs)" }} />higgs</window.Chip>
        </FilterGroup>
        <FilterGroup title="Score">
          <window.Chip on={fScore === "unscored"} onClick={() => setFScore(fScore === "unscored" ? null : "unscored")}>Unscored</window.Chip>
          <window.Chip on={fScore === "pass"} onClick={() => setFScore(fScore === "pass" ? null : "pass")}><span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--ok)" }} />Pass ≥8</window.Chip>
          <window.Chip on={fScore === "hero"} onClick={() => setFScore(fScore === "hero" ? null : "hero")}><window.UIIcon name="trophy" size={12} />Hero</window.Chip>
        </FilterGroup>
        <FilterGroup title="Operator">
          {ops.map(o => <window.Chip key={o} on={fOp === o} onClick={() => setFOp(fOp === o ? null : o)}><window.Avatar glyph={o} size={15} />{o}</window.Chip>)}
        </FilterGroup>
      </div>

      {/* MAIN */}
      <div className="grow" style={{ overflow: "auto" }}>
        <div style={{ padding: "20px 24px 60px" }}>
          <div className="screen-hd" style={{ marginBottom: 16 }}>
            <div className="col" style={{ gap: 4 }}>
              <span className="t-label" style={{ color: "var(--gold)" }}>Gallery · Review</span>
              <h1 className="t-h1">{filtered.length} renders {anyFilter && <span className="t-body" style={{ fontWeight: 400 }}>filtered</span>}</h1>
            </div>
            <div className="row gap2">
              <div className="row gap2" style={{ position: "relative" }}>
                <window.UIIcon name="search" size={15} style={{ position: "absolute", left: 10, color: "var(--tx-4)" }} />
                <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search prompts…" style={{ width: 200, paddingLeft: 32, height: 34 }} />
              </div>
              <window.Seg value={layout} onChange={setLayout} options={[{ value: "masonry", icon: "masonry" }, { value: "grid", icon: "grid" }]} />
            </div>
          </div>

          {/* GRID */}
          {layout === "masonry" ? (
            <div style={{ columnCount: 4, columnGap: 12 }}>
              {filtered.map(a => <Tile key={a.id} a={a} onOpen={() => setLightId(a.id)} masonry />)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
              {filtered.map(a => <Tile key={a.id} a={a} onOpen={() => setLightId(a.id)} />)}
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX */}
      {light && <Lightbox a={light} idx={lightIdx} total={filtered.length} onClose={() => setLightId(null)} onNav={nav} />}
    </div>
  );
}

function Tile({ a, onOpen, masonry }) {
  const s = window.useStudio();
  const hue = s.D.EMP[a.employee]?.hue || a.h || 220;
  const ratio = masonry ? a.ratio : "1:1";
  return (
    <div className={`tile ${a.fresh ? "air" : ""}`} onClick={onOpen} style={{
      breakInside: "avoid", marginBottom: masonry ? 12 : 0, position: "relative", cursor: "pointer",
      borderRadius: 12, overflow: "hidden" }}>
      <window.Media ratio={ratio} type={a.type} hue={hue} radius={12} scrub={a.type === "video"}>
        {/* top badges */}
        <div className="row between" style={{ position: "absolute", top: 8, left: 8, right: 8 }}>
          <window.BrandDot id={a.brand} size={9} />
          {a.score != null ? (
            <span style={{ width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11.5, fontWeight: 700, background: a.score >= 8 ? "rgba(75,178,134,0.85)" : "rgba(0,0,0,0.6)",
              color: a.score >= 8 ? "#062" : "#fff", backdropFilter: "blur(4px)" }}>{a.score}</span>
          ) : (
            <span className="pill gold" style={{ height: 18, fontSize: 9.5, padding: "0 7px" }}><span className="led" />score</span>
          )}
        </div>
        {a.hero && <div style={{ position: "absolute", top: 34, right: 8, color: "var(--gold-hi)" }}><window.UIIcon name="trophy" size={14} fill /></div>}
        {/* hover overlay */}
        <div className="tile-ov" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end",
          padding: 10, background: "linear-gradient(transparent 40%, rgba(0,0,0,0.82))", opacity: 0, transition: "opacity 180ms" }}>
          <span style={{ fontSize: 11.5, lineHeight: 1.35, color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.prompt}</span>
          <div className="row between" style={{ marginTop: 7 }}>
            <window.Prov id={a.provider} />
            <span className="mono" style={{ fontSize: 10.5, color: "var(--gold-hi)" }}>${a.cost.toFixed(3)}</span>
          </div>
        </div>
        {a.type === "video" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <window.UIIcon name="play" size={15} fill style={{ color: "#fff", marginLeft: 2 }} /></div>
        </div>}
      </window.Media>
    </div>
  );
}

function Lightbox({ a, idx, total, onClose, onNav }) {
  const s = window.useStudio();
  const D = s.D;
  const emp = D.EMP[a.employee], brand = D.BRANDS[a.brand], model = D.MODEL[a.model];
  const passed = a.score >= 8;
  return (
    <div className="overlay" onMouseDown={onClose} style={{ padding: 0 }}>
      {/* nav arrows */}
      <button className="lb-nav" style={{ left: 18 }} onMouseDown={e => { e.stopPropagation(); onNav(-1); }} disabled={idx === 0}><window.UIIcon name="chevleft" size={22} /></button>
      <button className="lb-nav" style={{ right: 18 }} onMouseDown={e => { e.stopPropagation(); onNav(1); }} disabled={idx === total - 1}><window.UIIcon name="chevright" size={22} /></button>

      <div className="sheet row" onMouseDown={e => e.stopPropagation()} style={{ width: "min(1100px, 92vw)", maxHeight: "88vh", padding: 0, gap: 0 }}>
        {/* media */}
        <div style={{ flex: 1, background: "var(--bg-0)", display: "flex", alignItems: "center", justifyContent: "center", padding: 26, position: "relative", borderRight: "1px solid var(--line-1)" }}>
          <window.Media ratio={a.ratio} type={a.type} hue={emp?.hue || a.h} radius={14} style={{ maxWidth: 540, width: "100%" }} scrub={a.type === "video"} />
          <span className="mono t-xs" style={{ position: "absolute", bottom: 14, left: 16, color: "var(--tx-4)" }}>{idx + 1} / {total} · ← → to browse</span>
        </div>

        {/* detail panel */}
        <div className="col" style={{ width: 360, flex: "none", padding: 22, gap: 16, overflow: "auto" }}>
          <div className="between">
            <div className="row gap2"><window.BrandDot id={a.brand} /><span className="t-sm" style={{ color: brand.swatch[0] === "#d8b24a" ? "var(--gold-hi)" : "var(--strikelab)" }}>{brand.name}</span></div>
            <window.IconBtn icon="x" ghost onClick={onClose} />
          </div>

          {/* prompt */}
          <div className="col gap2">
            <span className="t-label">Prompt</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--tx-1)" }}>{a.prompt}</p>
          </div>

          {/* SCORE — the consequential action */}
          <div className="col gap3" style={{ padding: 15, borderRadius: 14, border: `1px solid ${a.score == null ? "var(--gold-line)" : passed ? "rgba(75,178,134,0.3)" : "var(--line-2)"}`,
            background: a.score == null ? "var(--gold-wash)" : passed ? "var(--ok-wash)" : "var(--bg-1)" }}>
            <div className="between">
              <span className="t-label" style={{ color: a.score == null ? "var(--gold-hi)" : "var(--tx-3)" }}>Quality gate</span>
              {a.score != null && (passed
                ? <span className="pill ready"><span className="led" />Pass · ship</span>
                : <span className="pill fail"><span className="led" />Below gate</span>)}
            </div>
            <div className="between">
              <window.Score value={a.score} onChange={(n) => s.scoreAsset(a.id, n)} size={15} />
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: a.score == null ? "var(--tx-4)" : passed ? "#84d3b2" : "var(--tx-2)" }}>
                {a.score != null ? a.score : "—"}<span className="t-xs" style={{ color: "var(--tx-4)" }}>/10</span></span>
            </div>
            <span className="t-xs" style={{ color: a.score == null ? "var(--gold-hi)" : "var(--tx-3)" }}>
              {a.score == null ? "Tap to score. ≥8 passes the gate." : passed ? "Eligible for a hero render." : "Won't earn a hero render."}
            </span>
            {a.score === 10 && <div className="row gap2" style={{ color: "var(--gold-hi)", fontSize: 12 }}><window.UIIcon name="trophy" size={14} fill />Marked as hero</div>}
          </div>

          {/* provenance */}
          <div className="col gap2">
            <span className="t-label">Provenance</span>
            <div className="col gap2" style={{ padding: 13, borderRadius: 12, background: "var(--bg-1)", border: "1px solid var(--line-1)" }}>
              {[
                ["Model", <span className="row gap2"><window.Prov id={a.provider} />{model.name}</span>],
                ["Employee", <span className="row gap2"><window.EmpAvatar id={a.employee} size={16} />{emp.name}</span>],
                ["Operator", <span className="row gap2"><window.Avatar glyph={a.operator} size={16} />{a.operator}</span>],
                ["Format", `${a.ratio} · ${a.type}`],
                ["Cost", <span className="mono" style={{ color: "var(--gold-hi)" }}>${a.cost.toFixed(3)}</span>],
                ["Created", a.ago],
              ].map(([k, v]) => (
                <div key={k} className="between"><span className="t-sm" style={{ color: "var(--tx-3)" }}>{k}</span><span className="t-sm" style={{ color: "var(--tx-1)" }}>{v}</span></div>
              ))}
            </div>
          </div>

          <div className="row gap2">
            <window.Btn variant="quiet" size="sm" icon="refresh" style={{ flex: 1 }} onClick={() => { s.setScreen("create"); onClose(); }}>Iterate</window.Btn>
            <window.Btn variant="quiet" size="sm" icon="download" style={{ flex: 1 }}>Download</window.Btn>
            <window.IconBtn icon="copy" />
          </div>
          <span className="mono t-xs" style={{ color: "var(--tx-4)" }}>↓ archive/2026-06-11/{a.id}.{a.type === "video" ? "mp4" : "png"}</span>
        </div>
      </div>
    </div>
  );
}

window.GalleryScreen = GalleryScreen;
if (!document.getElementById("__gal_kf")) {
  const st = document.createElement("style"); st.id = "__gal_kf";
  st.textContent = `
    .tile:hover .tile-ov{opacity:1}
    .tile{transition:transform 200ms var(--ease-out)}
    .tile:hover{transform:translateY(-2px)}
    .lb-nav{position:fixed;top:50%;transform:translateY(-50%);z-index:90;width:42px;height:42px;border-radius:50%;
      background:var(--bg-3);border:1px solid var(--line-2);color:var(--tx-1);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--el-2)}
    .lb-nav:hover{background:var(--bg-4)}
    .lb-nav:disabled{opacity:0.3;cursor:not-allowed}
  `;
  document.head.appendChild(st);
}
