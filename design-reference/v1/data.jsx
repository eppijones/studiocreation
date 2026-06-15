/* ============================================================
   StudioCreation — Mock Data + Icon Set
   Exposes: window.DATA, window.Icon
   ============================================================ */

/* ---------------- ICONS (stroke, currentColor, 24 grid) ---------------- */
const ICONS = {
  dashboard: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  create: "M12 3v18M3 12h18",
  queue: "M4 6h16M4 12h16M4 18h10",
  gallery: "M3 5h18v14H3zM3 14l5-5 4 4 3-3 6 6",
  costs: "M12 2v20M7 6h7a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8",
  briefs: "M5 3h11l4 4v14H5zM15 3v5h5M9 13h7M9 17h7",
  handoff: "M4 12h13M13 7l5 5-5 5M3 4v16",
  bolt: "M13 2 4 14h6l-1 8 9-12h-6z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  check: "M20 6 9 17l-5-5",
  checkcircle: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  chevdown: "M6 9l6 6 6-6",
  chevright: "M9 6l6 6-6 6",
  chevleft: "M15 6l-6 6 6 6",
  arrowright: "M5 12h14M13 6l6 6-6 6",
  play: "M7 4v16l13-8z",
  pause: "M8 5h3v14H8zM14 5h3v14h-3z",
  image: "M3 5h18v14H3zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5L5 21",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3z",
  film: "M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4",
  filter: "M3 5h18l-7 8v5l-4 2v-7z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  star: "M12 3l2.7 6.1 6.3.5-4.8 4.1 1.5 6.2L12 16.8 6.3 20l1.5-6.2L3 9.6l6.3-.5z",
  wand: "M15 4V2M15 10V8M19 6h2M9 6H7M14.5 6.5 4 17l3 3L17.5 9.5zM17 7l1.2 1.2",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  gauge: "M12 13l4-4M5 19a9 9 0 1 1 14 0",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  folder: "M3 6h6l2 2h10v12H3z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  dots: "M12 5h.01M12 12h.01M12 19h.01",
  grid: "M3 3h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 13h8v8H3z",
  masonry: "M3 3h8v11H3zM13 3h8v6h-8zM13 12h8v9h-8zM3 17h8v4H3z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  scrub: "M3 12h18M7 8v8M11 6v12M15 9v6M19 8v8",
  sliders: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5M14 4v4M6 10v4M11 16v4",
  brand: "M12 2l2.4 6.8H22l-5.8 4.2 2.2 7L12 16l-6.4 4.2 2.2-7L2 8.8h7.6z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  flame: "M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 .5-2-1-4-1-8z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.7-1l-.4-2.6H9.9l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.3-1-2 3.4L5.6 11a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1c.5.4 1.1.7 1.7 1l.4 2.6h4.2l.4-2.6c.6-.3 1.2-.6 1.7-1l2.3 1 2-3.4z",
  trophy: "M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 17h6M8 21h8M12 14v3",
  golf: "M12 3v12M12 5l6 2-6 2M6 21h12",
  cpu: "M6 6h12v12H6zM9 9h6v6H9M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3",
  zap: "M11 2 4 13h6l-1 9 8-12h-6z",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2",
  type: "M4 6h16M9 6v13M7 19h4",
  trend: "M3 17l6-6 4 4 7-7M21 8v4h-4",
};

function Icon({ name, size = 16, fill = false, style, className }) {
  const d = ICONS[name];
  return React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", style, className,
    fill: fill ? "currentColor" : "none",
    stroke: fill ? "none" : "currentColor",
    strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round",
  }, React.createElement("path", { d }));
}

/* ---------------- BRANDS ---------------- */
const BRANDS = {
  starxi: {
    id: "starxi", name: "StarXI", color: "var(--starxi)", swatch: ["#d8b24a", "#2f6b4a", "#efe6cf"],
    tag: "World Cup squad-draft · collectible figurine DNA",
    style: "collectible figurine, gold-cream-deep-green palette, glossy enamel, studio rim light",
  },
  strikelab: {
    id: "strikelab", name: "StrikeLab", color: "var(--strikelab)", swatch: ["#6fb7c4", "#cfd6da", "#1d2226"],
    tag: "Golf brand · clean, technical, precise",
    style: "clean technical product, graphite + cool teal, soft seamless backdrop, precise edges",
  },
};

/* ---------------- EMPLOYEES (9 personas) ---------------- */
const EMPLOYEES = [
  { id: "premium-motion", name: "Premium Motion", role: "Motion Designer", glyph: "PM",
    model: "kling-3-pro", ratio: "16:9", dur: 6, kind: "hero-film", hue: 28,
    style: "cinematic camera move, volumetric light, premium product motion, 24fps filmic",
    blurb: "Hero films & product motion. Slow push-ins, rim light, filmic grade." },
  { id: "reference-sheets", name: "Reference Sheets", role: "Concept Lead", glyph: "RS",
    model: "nano-banana-pro", ratio: "4:3", dur: 0, kind: "ref-sheet", hue: 150,
    style: "character reference sheet, multiple angles, neutral grey backdrop, consistent design",
    blurb: "Turnarounds & multi-angle ref sheets with consistent identity." },
  { id: "typography-animator", name: "Typography Animator", role: "Title Designer", glyph: "TA",
    model: "seedance-1", ratio: "9:16", dur: 4, kind: "type-card", hue: 280,
    style: "kinetic typography, bold grotesk, tight tracking, editorial motion, on-brand color",
    blurb: "Kinetic title cards & lower-thirds. Editorial, bold, tight." },
  { id: "quality-gate", name: "Quality Gate", role: "Reviewer", glyph: "QG",
    model: "gpt-image-2", ratio: "1:1", dur: 0, kind: "infographic", hue: 0,
    style: "high fidelity, crisp detail, accurate text rendering, clean composition",
    blurb: "Final-pass scorer. Crisp detail, text accuracy, ship/no-ship." },
  { id: "social-cutter", name: "Social Cutter", role: "Editor", glyph: "SC",
    model: "veo-3.1", ratio: "9:16", dur: 8, kind: "social-vertical", hue: 200,
    style: "fast-cut vertical social, punchy energy, captions-safe framing, 9:16 native",
    blurb: "Vertical social cuts. Punchy, caption-safe, thumb-stopping." },
  { id: "hero-director", name: "Hero Director", role: "Director", glyph: "HD",
    model: "veo-3.1", ratio: "21:9", dur: 8, kind: "hero-film", hue: 16,
    style: "anamorphic hero shot, dramatic stadium light, slow dolly, epic scale",
    blurb: "Anamorphic hero shots. Stadium scale, dramatic light, slow dolly." },
  { id: "storyboard-artist", name: "Storyboard Artist", role: "Previs", glyph: "SA",
    model: "flux-dev", ratio: "16:9", dur: 0, kind: "storyboard", hue: 48,
    style: "storyboard panel, loose ink + tone, clear staging, sequential beats",
    blurb: "Sequential previs panels. Loose, fast, clear staging." },
  { id: "brand-stylist", name: "Brand Stylist", role: "Art Director", glyph: "BS",
    model: "soul-2", ratio: "4:5", dur: 0, kind: "infographic", hue: 320,
    style: "brand-locked art direction, editorial campaign look, controlled palette",
    blurb: "Locks the brand look across a set. Editorial, controlled palette." },
  { id: "infographic-builder", name: "Infographic Builder", role: "Designer", glyph: "IB",
    model: "gpt-image-2", ratio: "4:5", dur: 0, kind: "infographic", hue: 96,
    style: "clean data infographic, accurate legible text, grid layout, brand color",
    blurb: "Stat cards & infographics with legible, accurate text." },
];

/* ---------------- MODELS (real-ish prices) ---------------- */
const MODELS = [
  { id: "flux-schnell", name: "FLUX schnell", provider: "fal", type: "image", price: 0.004, unit: "img", tier: "Fast", eta: 6, blurb: "Cheapest draft pass" },
  { id: "flux-dev", name: "FLUX dev", provider: "fal", type: "image", price: 0.025, unit: "img", tier: "Std", eta: 14, blurb: "Balanced quality" },
  { id: "nano-banana-pro", name: "Nano Banana Pro", provider: "fal", type: "image", price: 0.039, unit: "img", tier: "Pro", eta: 18, blurb: "Sharp, controllable" },
  { id: "gpt-image-2", name: "GPT Image 2", provider: "fal", type: "image", price: 0.06, unit: "img", tier: "Pro", eta: 22, blurb: "Best text rendering" },
  { id: "soul-2", name: "Soul 2.0", provider: "higgs", type: "image", price: 0.05, unit: "img", tier: "Pro", eta: 20, blurb: "Editorial campaign look" },
  { id: "seedance-1", name: "Seedance 1.0", provider: "fal", type: "video", price: 0.05, unit: "s", tier: "Std", eta: 40, audio: 0.01, blurb: "Snappy short motion" },
  { id: "kling-3-pro", name: "Kling 3 Pro", provider: "fal", type: "video", price: 0.14, unit: "s", tier: "Pro", eta: 75, audio: 0.02, blurb: "Premium motion, top tier" },
  { id: "veo-3.1", name: "Veo 3.1", provider: "fal", type: "video", price: 0.12, unit: "s", tier: "Pro", eta: 70, audio: 0.02, blurb: "Cinematic, native audio" },
];
const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));

/* ---------------- CONTENT TYPES ---------------- */
const CONTENT_TYPES = [
  { id: "social-vertical", name: "Social Vertical", icon: "video", ratio: "9:16", model: "veo-3.1", dur: 8, employee: "social-cutter", hue: 200, desc: "Thumb-stopping 9:16 cut for feed & stories" },
  { id: "hero-film", name: "Hero Film", icon: "film", ratio: "21:9", model: "kling-3-pro", dur: 6, employee: "hero-director", hue: 16, desc: "Anamorphic centerpiece. Stadium scale" },
  { id: "ref-sheet", name: "Reference Sheet", icon: "layers", ratio: "4:3", model: "nano-banana-pro", dur: 0, employee: "reference-sheets", hue: 150, desc: "Multi-angle turnaround, consistent identity" },
  { id: "storyboard", name: "Storyboard", icon: "grid", ratio: "16:9", model: "flux-dev", dur: 0, employee: "storyboard-artist", hue: 48, desc: "Sequential previs beats, fast & loose" },
  { id: "infographic", name: "Infographic", icon: "trend", ratio: "4:5", model: "gpt-image-2", dur: 0, employee: "infographic-builder", hue: 96, desc: "Stat card with legible, accurate text" },
  { id: "type-card", name: "Typography Card", icon: "type", ratio: "9:16", model: "seedance-1", dur: 4, employee: "typography-animator", hue: 280, desc: "Kinetic title / lower-third" },
];

/* ---------------- ASSETS (gallery) ---------------- */
const PROMPTS = [
  "StarXI captain figurine, gold base plinth, deep green kit, studio rim light, collectible gloss",
  "Anamorphic stadium tunnel, players emerging into floodlight haze, slow dolly push",
  "StrikeLab driver head, graphite shaft, seamless cool-grey backdrop, precise product light",
  "Midfielder turnaround ref sheet, three-quarter / front / side, neutral grey",
  "Kinetic title card: GROUP STAGE, bold grotesk, gold on black, tight tracking",
  "Infographic: squad value breakdown, gold accents, legible figures, 4:5",
  "Hero striker mid-volley, frozen spray, dramatic side light, 21:9",
  "StrikeLab glove texture macro, technical perforations, soft teal rim",
  "Collectible keeper figurine, diving pose, cream base, enamel gloss",
  "Storyboard beat 3: crowd reaction, loose ink, clear staging",
  "Typography lower-third: STARTING XI, animated reveal, cream serif",
  "Stadium aerial at dusk, warm floodlights, cinematic haze, 16:9",
];
const OPERATORS = ["AR", "JN", "MK"];
function mkAssets() {
  const out = [];
  for (let i = 0; i < 24; i++) {
    const m = MODELS[i % MODELS.length];
    const brand = i % 3 === 0 ? "strikelab" : "starxi";
    const ar = m.type === "video" ? (i % 2 ? "9:16" : "21:9") : ["1:1", "4:5", "4:3", "16:9"][i % 4];
    const scored = i % 3 !== 2;
    const score = scored ? [9, 8, 7, 10, 6, 9, 8, 5][i % 8] : null;
    out.push({
      id: "a" + (1000 + i), prompt: PROMPTS[i % PROMPTS.length],
      model: m.id, provider: m.provider, type: m.type, ratio: ar, brand,
      employee: EMPLOYEES[i % EMPLOYEES.length].id,
      operator: OPERATORS[i % OPERATORS.length],
      cost: m.type === "video" ? +(m.price * (i % 2 ? 8 : 6)).toFixed(3) : +(m.price * (i % 4 + 1)).toFixed(3),
      score, hero: score === 10, ago: ["just now", "8m", "22m", "1h", "2h", "3h", "yesterday", "yesterday"][i % 8],
      hue: (EMPLOYEES[i % EMPLOYEES.length].hue) , h: [220, 300, 260, 340, 200, 280][i % 6],
    });
  }
  return out;
}

/* ---------------- LIVE JOBS (seed the queue) ---------------- */
function mkJobs() {
  return [
    { id: "j801", state: "running", model: "kling-3-pro", brand: "starxi", employee: "hero-director",
      prompt: "Anamorphic stadium tunnel, players emerging into floodlight haze, slow dolly push",
      type: "video", ratio: "21:9", dur: 6, count: 1, cost: 0.84, progress: 0.62, elapsed: 47, eta: 75, operator: "AR" },
    { id: "j802", state: "running", model: "gpt-image-2", brand: "starxi", employee: "infographic-builder",
      prompt: "Infographic: squad value breakdown, gold accents, legible figures, 4:5",
      type: "image", ratio: "4:5", dur: 0, count: 4, cost: 0.24, progress: 0.34, elapsed: 7, eta: 22, operator: "JN" },
    { id: "j803", state: "queued", model: "nano-banana-pro", brand: "strikelab", employee: "reference-sheets",
      prompt: "StrikeLab driver head turnaround, seamless cool-grey backdrop, precise light",
      type: "image", ratio: "4:3", dur: 0, count: 6, cost: 0.234, progress: 0, elapsed: 0, eta: 18, operator: "AR" },
    { id: "j804", state: "queued", model: "seedance-1", brand: "starxi", employee: "typography-animator",
      prompt: "Kinetic title card: GROUP STAGE, bold grotesk, gold on black, tight tracking",
      type: "video", ratio: "9:16", dur: 4, count: 1, cost: 0.20, progress: 0, elapsed: 0, eta: 40, operator: "MK" },
  ];
}

/* ---------------- LEDGER (today) ---------------- */
const LEDGER = [
  { id: "l1", t: "16:42", model: "kling-3-pro", provider: "fal", desc: "Hero tunnel push v3", cost: 0.84, qty: "6s", op: "AR", score: 9 },
  { id: "l2", t: "16:30", model: "gpt-image-2", provider: "fal", desc: "Squad value infographic ×4", cost: 0.24, qty: "4 img", op: "JN", score: 8 },
  { id: "l3", t: "15:58", model: "soul-2", provider: "higgs", desc: "Brand campaign frame ×3", cost: 0.15, qty: "3 img", op: "AR", score: 9 },
  { id: "l4", t: "15:21", model: "veo-3.1", provider: "fal", desc: "Social vertical teaser 8s", cost: 0.96, qty: "8s", op: "MK", score: 7 },
  { id: "l5", t: "14:47", model: "nano-banana-pro", provider: "fal", desc: "Keeper ref sheet ×6", cost: 0.234, qty: "6 img", op: "AR", score: 10 },
  { id: "l6", t: "14:10", model: "flux-dev", provider: "fal", desc: "Storyboard beats ×8", cost: 0.20, qty: "8 img", op: "JN", score: 6 },
  { id: "l7", t: "13:32", model: "flux-schnell", provider: "fal", desc: "Draft explorations ×20", cost: 0.08, qty: "20 img", op: "MK", score: null },
  { id: "l8", t: "12:55", model: "kling-3-pro", provider: "fal", desc: "Striker volley loop 6s", cost: 0.84, qty: "6s", op: "AR", score: 8 },
];

window.DATA = {
  BRANDS, EMPLOYEES, MODELS, MODEL, CONTENT_TYPES,
  ASSETS: mkAssets(), JOBS: mkJobs(), LEDGER,
  EMP: Object.fromEntries(EMPLOYEES.map(e => [e.id, e])),
  CT: Object.fromEntries(CONTENT_TYPES.map(c => [c.id, c])),
  BUDGET: { dailyCap: 7.50, usedToday: 4.74, falBalance: 18.30, higgsCredits: 240, spendCardThreshold: 1.25, warnAt: 0.75 },
  OPERATOR: { name: "Alex Rivera", glyph: "AR", role: "Studio Operator" },
};
window.Icon = Icon;
