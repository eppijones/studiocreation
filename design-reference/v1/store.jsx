/* ============================================================
   StudioCreation — Live Store
   Context with a global ticker: jobs advance queued -> running -> done,
   completion toasts fire, budget recomputes. Exposes useStudio().
   ============================================================ */

const StudioCtx = React.createContext(null);
const useStudio = () => React.useContext(StudioCtx);

/* ---- pure cost math (shared by composer + calculator) ---- */
function estimate({ model, count = 1, dur = 0, audio = false, fast = false, hi = false }) {
  const m = window.DATA.MODEL[model];
  if (!m) return { total: 0, lines: [] };
  const lines = [];
  let total = 0;
  if (m.type === "video") {
    const base = m.price * dur;
    lines.push({ label: `${m.name}`, math: `$${m.price.toFixed(2)}/s × ${dur}s`, val: base });
    total += base;
    if (audio && m.audio) { const a = m.audio * dur; lines.push({ label: "Native audio", math: `$${m.audio.toFixed(2)}/s × ${dur}s`, val: a }); total += a; }
  } else {
    const base = m.price * count;
    lines.push({ label: `${m.name}`, math: `$${m.price.toFixed(3)}/img × ${count}`, val: base });
    total += base;
  }
  if (hi) { const mult = total * 0.6; lines.push({ label: "4K tier", math: "×1.6", val: mult }); total += mult; }
  if (fast) { const mult = total * 0.25; lines.push({ label: "Fast lane", math: "×1.25", val: mult }); total += mult; }
  return { total: +total.toFixed(4), lines, type: m.type };
}

function StudioProvider({ children }) {
  const D = window.DATA;
  const [jobs, setJobs] = React.useState(D.JOBS);
  const [assets, setAssets] = React.useState(D.ASSETS);
  const [ledger, setLedger] = React.useState(D.LEDGER);
  const [usedToday, setUsedToday] = React.useState(D.BUDGET.usedToday);
  const [falBalance, setFalBalance] = React.useState(D.BUDGET.falBalance);
  const [toasts, setToasts] = React.useState([]);
  const [screen, setScreen] = React.useState("dashboard");
  const [soundOn, setSoundOn] = React.useState(false);
  const [galleryLayout, setGalleryLayout] = React.useState("masonry");
  const seq = React.useRef(900);

  const budget = {
    ...D.BUDGET, usedToday, falBalance,
    remaining: +(D.BUDGET.dailyCap - usedToday).toFixed(2),
    pct: usedToday / D.BUDGET.dailyCap,
  };

  function toast(t) {
    const id = ++seq.current;
    setToasts(ts => [...ts, { id, ...t }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.sticky ? 9000 : 5200);
    if (soundOn && t.kind !== "info") blip(t.kind === "bad" ? 220 : 660);
  }
  function dismissToast(id) { setToasts(ts => ts.filter(x => x.id !== id)); }

  /* ---- submit a new job from the composer ---- */
  function submitJob(spec) {
    const id = "j" + (++seq.current);
    const anyRunning = jobs.some(j => j.state === "running");
    const job = { ...spec, id, state: anyRunning ? "queued" : "running",
      progress: 0, elapsed: 0, _start: Date.now() };
    setJobs(js => [job, ...js]);
    toast({ kind: "info", icon: "queue", title: anyRunning ? "Queued" : "Generating",
      msg: `${window.DATA.MODEL[spec.model].name} · ${spec.count > 1 ? spec.count + " imgs" : (spec.dur ? spec.dur + "s" : "1 img")}` });
    return id;
  }

  function scoreAsset(id, score) {
    setAssets(as => as.map(a => a.id === id ? { ...a, score, hero: score === 10 } : a));
    const pass = score >= 8;
    toast({ kind: pass ? "ok" : "bad", icon: pass ? "checkcircle" : "shield",
      title: pass ? `Scored ${score} · Pass` : `Scored ${score} · Below gate`,
      msg: pass ? "Eligible for hero render" : "Won't earn a hero render (gate ≥ 8)" });
  }

  /* ---- global ticker: advance jobs, complete them, bank cost ---- */
  React.useEffect(() => {
    const iv = setInterval(() => {
      setJobs(prev => {
        let changed = false;
        let next = prev.map(j => {
          if (j.state !== "running") return j;
          const inc = 1 / Math.max(j.eta, 8);              // ~eta seconds to fill
          const progress = Math.min(1, j.progress + inc * (0.85 + Math.random() * 0.4));
          changed = true;
          return { ...j, progress, elapsed: j.elapsed + 1 };
        });
        // complete finished
        next.forEach(j => {
          if (j.state === "running" && j.progress >= 1 && !j._done) {
            j._done = true; j.state = "ready";
            const m = window.DATA.MODEL[j.model];
            // bank cost + push assets + ledger
            setUsedToday(u => +(u + j.cost).toFixed(3));
            setFalBalance(b => m.provider === "fal" ? +(b - j.cost).toFixed(3) : b);
            const newAssets = Array.from({ length: Math.min(j.count || 1, 4) }).map((_, k) => ({
              id: "n" + (Date.now() + k), prompt: j.prompt, model: j.model, provider: m.provider,
              type: j.type, ratio: j.ratio, brand: j.brand, employee: j.employee, operator: j.operator || "AR",
              cost: +((j.cost) / Math.min(j.count || 1, 4)).toFixed(3), score: null, hero: false,
              ago: "just now", fresh: true, h: [220, 300, 260, 340][k % 4],
            }));
            setAssets(a => [...newAssets, ...a]);
            setLedger(l => [{ id: "lx" + j.id, t: "now", model: j.model, provider: m.provider,
              desc: j.prompt.slice(0, 38) + "…", cost: j.cost, qty: j.type === "video" ? j.dur + "s" : (j.count + " img"),
              op: j.operator || "AR", score: null }, ...l]);
            toast({ kind: "ok", icon: "checkcircle", title: "Ready to review",
              msg: `${m.name} · $${j.cost.toFixed(2)} · needs scoring`, sticky: true });
          }
        });
        // promote a queued job if nothing running
        if (!next.some(j => j.state === "running")) {
          const q = next.find(j => j.state === "queued");
          if (q) { q.state = "running"; q._start = Date.now(); changed = true; }
        }
        return changed || next.some(j => j._done) ? [...next] : prev;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [soundOn]);

  const value = {
    jobs, assets, ledger, budget, toasts, screen, setScreen, soundOn, setSoundOn,
    galleryLayout, setGalleryLayout,
    submitJob, scoreAsset, toast, dismissToast, estimate,
    activeCount: jobs.filter(j => j.state === "running").length,
    queuedCount: jobs.filter(j => j.state === "queued").length,
    needsScoring: assets.filter(a => a.score == null).length,
    D,
  };
  return React.createElement(StudioCtx.Provider, { value }, children);
}

/* tiny web-audio blip for completion (only if sound on) */
let _actx;
function blip(freq) {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _actx.createOscillator(), g = _actx.createGain();
    o.frequency.value = freq; o.type = "sine"; o.connect(g); g.connect(_actx.destination);
    g.gain.setValueAtTime(0.0001, _actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, _actx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, _actx.currentTime + 0.25);
    o.start(); o.stop(_actx.currentTime + 0.26);
  } catch (e) {}
}

Object.assign(window, { StudioProvider, useStudio, estimate });
