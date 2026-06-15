// StudioCreation — mock data: models, employees, brands, content types, seeds
(function(){

const MODELS = {
  'flux-schnell':   { id:'flux-schnell',   name:'FLUX schnell',    kind:'image', unit:0.004, unitLabel:'$0.004/img' },
  'flux-dev':       { id:'flux-dev',       name:'FLUX dev',        kind:'image', unit:0.025, unitLabel:'$0.025/img' },
  'nano-banana-pro':{ id:'nano-banana-pro',name:'Nano Banana Pro', kind:'image', unit:0.039, unitLabel:'$0.039/img' },
  'gpt-image-2':    { id:'gpt-image-2',    name:'GPT Image 2',     kind:'image', unit:0.06,  unitLabel:'$0.06/img' },
  'seedance-1':     { id:'seedance-1',     name:'Seedance 1.0',    kind:'video', unit:0.062, unitLabel:'$0.062/s' },
  'veo-3.1':        { id:'veo-3.1',        name:'Veo 3.1',         kind:'video', unit:0.12,  unitLabel:'$0.12/s', audioUnit:0.02 },
  'kling-3-pro':    { id:'kling-3-pro',    name:'Kling 3 Pro',     kind:'video', unit:0.14,  unitLabel:'$0.14/s' },
};

const PALETTES = {
  pitchGold:    ['#E8B84B','#1E5B38','#0D1F14'],
  emberTeal:    ['#FF8C42','#2A9DB8','#0B1B26'],
  violetRun:    ['#B14BE8','#4A2BD9','#16093A'],
  coolStrike:   ['#7FE8C0','#2E7F66','#0A1F18'],
  crimsonNight: ['#FF4D5E','#7A1B4D','#1A0A14'],
  arcticBlue:   ['#9AD8FF','#2B66D9','#0A1226'],
  sunsetMagenta:['#FF7AC8','#FF9A3C','#2A0E22'],
  limeNoir:     ['#CFFF5E','#2E8C4A','#0E1A0C'],
};

const EMPLOYEES = [
  { id:'premium-motion-designer', persona:'Vega',  role:'Premium motion designer', model:'kling-3-pro', kind:'video', aspect:'16:9', duration:6, count:1,
    style:'cinematic camera language, volumetric light, anamorphic 35mm, graded like a title sequence', palette:PALETTES.crimsonNight },
  { id:'social-cutdowns',         persona:'Juno',  role:'Social cutdowns',         model:'seedance-1',  kind:'video', aspect:'9:16', duration:8, count:1,
    style:'punchy vertical pacing, bold first frame, loop-safe ending', palette:PALETTES.emberTeal },
  { id:'typography-animator',     persona:'Sable', role:'Typography animator',     model:'veo-3.1',     kind:'video', aspect:'9:16', duration:4, count:1,
    style:'kinetic typography, engineered grotesk, tight tracking, type as the hero', palette:PALETTES.sunsetMagenta },
  { id:'reference-sheets',        persona:'Otis',  role:'Reference sheets',        model:'flux-dev',    kind:'image', aspect:'1:1',  count:4,
    style:'character turnaround, neutral studio sweep, consistent proportions and materials', palette:PALETTES.pitchGold },
  { id:'storyboard-artist',       persona:'Pim',   role:'Storyboard artist',       model:'flux-schnell',kind:'image', aspect:'16:9', count:8,
    style:'loose cinematic frames, blocking and lensing notes, contact-sheet energy', palette:PALETTES.arcticBlue },
  { id:'hero-key-art',            persona:'Ilsa',  role:'Hero key art',            model:'gpt-image-2', kind:'image', aspect:'16:9', count:1,
    style:'single-frame key art, poster composition, dramatic rim light', palette:PALETTES.violetRun },
  { id:'infographic-compositor',  persona:'Rooke', role:'Infographic compositor',  model:'nano-banana-pro', kind:'image', aspect:'4:5', count:1,
    style:'clean data panels, labeled callouts, precise alignment, generous margins', palette:PALETTES.coolStrike },
  { id:'product-photographer',    persona:'Calder',role:'Product photographer',    model:'flux-dev',    kind:'image', aspect:'4:5', count:1,
    style:'macro product detail, controlled speculars, seamless background', palette:PALETTES.limeNoir },
  { id:'quality-gate',            persona:'Nyx',   role:'Quality gate',            model:'flux-schnell',kind:'image', aspect:'1:1',  count:4,
    style:'side-by-side consistency check, flag drift in proportion, color and type', palette:PALETTES.arcticBlue },
];

const BRANDS = {
  starxi: { id:'starxi', name:'StarXI', tagline:'2026 World Cup squad-drafting',
    lockStyle:'StarXI brand: collectible figurine finish, gold + cream + deep pitch green, stadium glow',
    palette:PALETTES.pitchGold },
  strikelab: { id:'strikelab', name:'StrikeLab', tagline:'Precision golf',
    lockStyle:'StrikeLab brand: clean technical look, cool greens, precision grid, matte studio light',
    palette:PALETTES.coolStrike },
};

const CONTENT_TYPES = [
  { id:'social-vertical', name:'Social vertical', sub:'9:16 · video', employee:'social-cutdowns' },
  { id:'hero-film',       name:'Hero film',       sub:'16:9 · video', employee:'premium-motion-designer' },
  { id:'ref-sheet',       name:'Ref sheet',       sub:'1:1 · ×4 img', employee:'reference-sheets' },
  { id:'storyboard',      name:'Storyboard',      sub:'16:9 · ×8 img',employee:'storyboard-artist' },
  { id:'infographic',     name:'Infographic',     sub:'4:5 · img',    employee:'infographic-compositor' },
  { id:'typography-card', name:'Typography card', sub:'9:16 · video', employee:'typography-animator' },
];

const BUDGET = { cap: 7.50, warnAt: 0.75, spendCardThreshold: 1.25 };

// ---- seed renders (gallery) ----
let _n = 0; const rid = () => 'r' + String(++_n).padStart(2,'0');
const seedRenders = [
  { id:rid(), title:'Opening ident — stadium pull-back', prompt:'Slow aerial pull-back from a golden figurine striker mid-volley, packed night stadium',
    employee:'premium-motion-designer', brand:'starxi', model:'kling-3-pro', provider:'fal', type:'video', aspect:'16:9', duration:6,
    palette:PALETTES.pitchGold, seed:3, cost:0.84, score:9, hero:true, time:'09:12', day:'today' },
  { id:rid(), title:'Figurine striker turnaround ×4', prompt:'Collectible figurine striker, 4-angle turnaround on neutral sweep',
    employee:'reference-sheets', brand:'starxi', model:'flux-dev', provider:'fal', type:'image', aspect:'1:1', count:4,
    palette:PALETTES.emberTeal, seed:7, cost:0.10, score:7, hero:false, time:'09:31', day:'today' },
  { id:rid(), title:'Wedge face macro, morning dew', prompt:'Macro of milled wedge face with dew droplets, raking light',
    employee:'product-photographer', brand:'strikelab', model:'flux-dev', provider:'fal', type:'image', aspect:'4:5',
    palette:PALETTES.coolStrike, seed:11, cost:0.025, score:8, hero:true, time:'09:48', day:'today' },
  { id:rid(), title:'Group stage teaser 01', prompt:'Vertical teaser: draft countdown over roaring crowd, confetti light streaks',
    employee:'social-cutdowns', brand:'starxi', model:'seedance-1', provider:'fal', type:'video', aspect:'9:16', duration:8,
    palette:PALETTES.crimsonNight, seed:5, cost:0.50, score:null, hero:false, time:'10:05', day:'today' },
  { id:rid(), title:'Kit reveal typography card', prompt:'Kinetic type kit reveal — “SQUAD LOCKED” slams in, fabric ripple behind',
    employee:'typography-animator', brand:'starxi', model:'veo-3.1', provider:'fal', type:'video', aspect:'9:16', duration:4,
    palette:PALETTES.sunsetMagenta, seed:9, cost:0.48, score:null, hero:false, time:'10:18', day:'today' },
  { id:rid(), title:'Range night — drone orbit', prompt:'Drone orbit of a driving range at night, tracer balls arcing through fog',
    employee:'premium-motion-designer', brand:'strikelab', model:'kling-3-pro', provider:'higgsfield', type:'video', aspect:'16:9', duration:6,
    palette:PALETTES.arcticBlue, seed:13, cost:0.90, score:6, hero:false, time:'10:26', day:'today' },
  { id:rid(), title:'Bracket infographic — Group F', prompt:'Group F bracket panel, fixtures and odds, labeled callouts',
    employee:'infographic-compositor', brand:'starxi', model:'nano-banana-pro', provider:'fal', type:'image', aspect:'4:5',
    palette:PALETTES.violetRun, seed:17, cost:0.039, score:null, hero:false, time:'10:40', day:'today' },
  { id:rid(), title:'Storyboard — captain reveal ×8', prompt:'8 frames: captain reveal sequence, locker tunnel to pitch',
    employee:'storyboard-artist', brand:'starxi', model:'flux-schnell', provider:'fal', type:'image', aspect:'16:9', count:8,
    palette:PALETTES.arcticBlue, seed:19, cost:0.032, score:5, hero:false, time:'10:52', day:'today' },
  { id:rid(), title:'Hero key art — golden hour pitch', prompt:'Poster key art: lone figurine on the center spot, golden hour, long shadow',
    employee:'hero-key-art', brand:'starxi', model:'gpt-image-2', provider:'fal', type:'image', aspect:'16:9',
    palette:PALETTES.pitchGold, seed:23, cost:0.06, score:9, hero:true, time:'11:07', day:'today' },
  { id:rid(), title:'Grip texture study', prompt:'Extreme macro of corded grip texture, matte studio light',
    employee:'product-photographer', brand:'strikelab', model:'flux-dev', provider:'fal', type:'image', aspect:'4:5',
    palette:PALETTES.limeNoir, seed:29, cost:0.025, score:null, hero:false, time:'11:15', day:'today' },
  { id:rid(), title:'Crowd wave loop', prompt:'Seamless loop: stadium crowd wave, flag sea, dusk light',
    employee:'social-cutdowns', brand:'starxi', model:'seedance-1', provider:'higgsfield', type:'video', aspect:'16:9', duration:8,
    palette:PALETTES.crimsonNight, seed:31, cost:0.75, score:8, hero:true, time:'17:41', day:'yesterday' },
  { id:rid(), title:'Tee box idents — v3', prompt:'Vertical ident: ball on tee, club head enters frame, clean strike',
    employee:'social-cutdowns', brand:'strikelab', model:'seedance-1', provider:'fal', type:'video', aspect:'9:16', duration:6,
    palette:PALETTES.coolStrike, seed:37, cost:0.37, score:7, hero:false, time:'16:12', day:'yesterday' },
];

// ---- seed jobs (queue) ----
const seedJobs = [
  { id:'j01', title:'Group stage teaser 02', prompt:'Vertical teaser: last-minute swap drama, bench cam push-in',
    employee:'social-cutdowns', brand:'starxi', model:'seedance-1', type:'video', aspect:'9:16', duration:8, count:1,
    cost:0.50, palette:PALETTES.emberTeal, seed:41, status:'generating', progress:34 },
  { id:'j02', title:'Trophy macro pass', prompt:'Macro pass across engraved trophy base, dust motes in beam',
    employee:'product-photographer', brand:'strikelab', model:'flux-dev', type:'image', aspect:'4:5', count:2,
    cost:0.05, palette:PALETTES.limeNoir, seed:43, status:'queued', progress:0 },
  { id:'j03', title:'Draft countdown — kinetic numbers', prompt:'Numbers 10→1 slam in sync with crowd chant, camera shake on zero',
    employee:'typography-animator', brand:'starxi', model:'veo-3.1', type:'video', aspect:'9:16', duration:4, count:1, audio:true,
    cost:0.56, palette:PALETTES.sunsetMagenta, seed:47, status:'queued', progress:0 },
];

// ---- seed ledger ----
const seedLedger = [
  { id:'l12', time:'11:15', title:'Grip texture study',            model:'flux-dev',        provider:'fal',        kind:'image', cost:0.025 },
  { id:'l11', time:'11:07', title:'Hero key art — golden hour',    model:'gpt-image-2',     provider:'fal',        kind:'image', cost:0.06 },
  { id:'l10', time:'10:52', title:'Storyboard — captain reveal ×8',model:'flux-schnell',    provider:'fal',        kind:'image', cost:0.032 },
  { id:'l09', time:'10:40', title:'Bracket infographic — Group F', model:'nano-banana-pro', provider:'fal',        kind:'image', cost:0.039 },
  { id:'l08', time:'10:26', title:'Range night — drone orbit',     model:'kling-3-pro',     provider:'higgsfield', kind:'video', cost:0.90 },
  { id:'l07', time:'10:18', title:'Kit reveal typography card',    model:'veo-3.1',         provider:'fal',        kind:'video', cost:0.48 },
  { id:'l06', time:'10:05', title:'Group stage teaser 01',         model:'seedance-1',      provider:'fal',        kind:'video', cost:0.50 },
  { id:'l05', time:'09:48', title:'Wedge face macro, morning dew', model:'flux-dev',        provider:'fal',        kind:'image', cost:0.025 },
  { id:'l04', time:'09:31', title:'Figurine striker turnaround ×4',model:'flux-dev',        provider:'fal',        kind:'image', cost:0.10 },
  { id:'l03', time:'09:12', title:'Opening ident — stadium pull-back', model:'kling-3-pro', provider:'fal',        kind:'video', cost:0.84 },
];

// ---- briefs ----
const BRIEFS = [
  { id:'b1', title:'Matchday teasers', brand:'starxi', desc:'Four 9:16 teasers for the group-stage drop. One per matchday angle.',
    items:[
      { title:'Teaser 03 — keeper wall',    employee:'social-cutdowns', duration:8, count:1 },
      { title:'Teaser 04 — golden boot',    employee:'social-cutdowns', duration:8, count:1 },
      { title:'Teaser 05 — derby heat',     employee:'social-cutdowns', duration:8, count:1 },
      { title:'Teaser 06 — final whistle',  employee:'social-cutdowns', duration:8, count:1 },
    ]},
  { id:'b2', title:'Wedge launch ref pack', brand:'strikelab', desc:'Turnaround sheets for the new milled wedge line, both finishes.',
    items:[
      { title:'Wedge ref — raw finish',     employee:'reference-sheets', count:4 },
      { title:'Wedge ref — black DLC',      employee:'reference-sheets', count:4 },
    ]},
  { id:'b3', title:'Stadium idents', brand:'starxi', desc:'Two 16:9 hero idents for the broadcast package. Premium motion only.',
    items:[
      { title:'Ident A — tunnel emergence', employee:'premium-motion-designer', duration:6, count:1 },
      { title:'Ident B — trophy lift',      employee:'premium-motion-designer', duration:6, count:1 },
    ]},
];

// ---- handoff packages (Higgsfield) ----
const HANDOFF_PACKAGES = [
  { id:'h1', title:'Crowd surge — slow shutter pan', brand:'starxi', aspect:'16:9', duration:6, estCost:0.90,
    prompt:'Slow shutter pan across a surging crowd, flags smearing into light trails, figurine hero sharp in foreground',
    palette:PALETTES.crimsonNight, seed:53, status:'ready' },
  { id:'h2', title:'Range at dusk — fog layers', brand:'strikelab', aspect:'16:9', duration:8, estCost:1.10,
    prompt:'Layered fog over a driving range at dusk, single tracer ball cutting clean through, precision grid overlay fades in',
    palette:PALETTES.arcticBlue, seed:59, status:'ready' },
  { id:'h3', title:'Figurine shelf dolly', brand:'starxi', aspect:'9:16', duration:5, estCost:0.75,
    prompt:'Vertical dolly along a collector shelf of squad figurines, each catching a stadium-glow rim light in turn',
    palette:PALETTES.pitchGold, seed:61, status:'ready' },
];

// ---- prompt improver (mock) ----
function improvePrompt(p){
  const base = p.replace(/[.\s]+$/,'');
  return [
    base + ' — low-angle hero framing, shallow depth of field, single hard key light, atmospheric haze',
    base + ' — graded teal-and-amber, anamorphic flare, slow push-in, premiere tempo',
    base + ' — clean studio sweep, controlled speculars, poster negative space, brand-locked palette',
  ];
}

window.SC_DATA = { MODELS, PALETTES, EMPLOYEES, BRANDS, CONTENT_TYPES, BUDGET,
  seedRenders, seedJobs, seedLedger, BRIEFS, HANDOFF_PACKAGES, improvePrompt };
})();
