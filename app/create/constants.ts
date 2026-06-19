/** Create-composer constants, lifted out of the page to keep page.tsx focused on
 *  behaviour. Pure data — safe to share with the sequence builder and any future
 *  create sub-components. */
import type { CameraRecipe, CameraAxis } from "./types";

// Empty-composer starters — a non-expert operator gets a running start instead of a blank box.
export const EXAMPLES: Record<"image" | "video", string[]> = {
  image: [
    "a studio render of a matte-black espresso machine on seamless white, soft key light",
    "editorial portrait, dramatic rim light, shallow depth of field",
    "isometric product hero, pastel palette, clean soft shadows",
  ],
  video: [
    "a cinematic dolly through neon-lit rain, reflections on wet asphalt",
    "slow orbit around a glass perfume bottle on a lit pedestal",
    "kinetic title reveal, bold type snapping into place",
  ],
};

// Camera/motion presets — first-class video direction, appended like house style.
// `glyph` is an Icon name (app/components/Icon.tsx) so the move reads at a glance.
export const MOTION_PRESETS: { id: string; label: string; phrase: string; glyph: string }[] = [
  { id: "push", label: "Push-in", phrase: "slow push-in", glyph: "mPush" },
  { id: "orbit", label: "Orbit", phrase: "smooth orbital camera move", glyph: "mOrbit" },
  { id: "handheld", label: "Handheld", phrase: "handheld camera, subtle natural shake", glyph: "mHandheld" },
  { id: "locked", label: "Locked-off", phrase: "locked-off static camera", glyph: "mLocked" },
  { id: "crash", label: "Crash zoom", phrase: "fast crash zoom", glyph: "mCrash" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA — direction as creative intent, compiled to prompt language ($0). Not a
// gear spec-sheet: we expose the three axes that actually change a frame (framing
// / depth / light), and DEPTH is one continuous dial instead of independent
// focal-length + aperture pickers — so you can't build a physically impossible
// look. See CameraRecipe / cameraPhrase. Works for stills and video.

// FRAMING — how much of the subject fills the frame.
export const FRAMING_OPTIONS: { id: string; label: string; phrase: string }[] = [
  { id: "wide", label: "Wide", phrase: "wide establishing shot" },
  { id: "medium", label: "Medium", phrase: "medium shot" },
  { id: "close", label: "Close-up", phrase: "tight close-up" },
  { id: "macro", label: "Macro", phrase: "extreme macro detail" },
];

// LIGHT — mood / direction.
export const LIGHT_OPTIONS: { id: string; label: string; phrase: string }[] = [
  { id: "golden", label: "Golden hour", phrase: "warm golden-hour light" },
  { id: "soft", label: "Soft studio", phrase: "soft diffused studio lighting" },
  { id: "noir", label: "Hard noir", phrase: "hard chiaroscuro noir lighting, deep shadows" },
  { id: "neon", label: "Neon", phrase: "moody neon practical lighting" },
];

// DEPTH — the continuous deep↔shallow axis, bucketed into coherent focal+aperture
// pairings. Each stop carries BOTH the gear label (so pros stay oriented) and the
// prompt language. depth 0 = deep focus, 100 = creamy bokeh. Ordered by `max`.
export const DEPTH_STOPS: { max: number; gear: string; phrase: string }[] = [
  { max: 19, gear: "24mm f/8", phrase: "24mm wide-angle lens, deep focus, everything sharp" },
  { max: 39, gear: "35mm f/5.6", phrase: "35mm lens, deep focus" },
  { max: 59, gear: "50mm f/2.8", phrase: "50mm lens, natural perspective" },
  { max: 79, gear: "85mm f/1.8", phrase: "85mm lens, shallow depth of field, soft background" },
  { max: 100, gear: "85mm f/1.4", phrase: "85mm portrait lens, very shallow depth of field, creamy bokeh, subject isolated" },
];

/** The coherent focal+aperture stop a depth value lands in. */
export function depthStop(depth: number): { max: number; gear: string; phrase: string } {
  return DEPTH_STOPS.find((s) => depth <= s.max) ?? DEPTH_STOPS[DEPTH_STOPS.length - 1];
}

/** Compile a camera recipe into prompt language, in a stable order. $0 — pure
 *  prompt composition. Used by the single-shot composer AND the sequence loop. */
export function cameraPhrase(cam: CameraRecipe | undefined): string {
  if (!cam) return "";
  return [
    FRAMING_OPTIONS.find((o) => o.id === cam.framing)?.phrase,
    typeof cam.depth === "number" ? depthStop(cam.depth).phrase : undefined,
    LIGHT_OPTIONS.find((o) => o.id === cam.light)?.phrase,
  ]
    .filter(Boolean)
    .join(", ");
}

/** How many axes the recipe sets — drives the "Camera · N" chip count. */
export function cameraCount(cam: CameraRecipe | undefined): number {
  if (!cam) return 0;
  return (cam.framing ? 1 : 0) + (typeof cam.depth === "number" ? 1 : 0) + (cam.light ? 1 : 0);
}

/** A short badge for a recipe (sequence shot cards): gear if depth set, else framing. */
export function cameraBadge(cam: CameraRecipe | undefined): string {
  if (!cam) return "";
  if (typeof cam.depth === "number") return depthStop(cam.depth).gear;
  const f = FRAMING_OPTIONS.find((o) => o.id === cam.framing)?.label;
  if (f) return f;
  return LIGHT_OPTIONS.find((o) => o.id === cam.light)?.label ?? "";
}

export function sameRecipe(a: CameraRecipe, b: CameraRecipe): boolean {
  return a.framing === b.framing && a.depth === b.depth && a.light === b.light;
}

// LOOKS — complete, physically-coherent recipes in one tap. Each bundles framing
// + depth + light (+ an optional motion for video). The anti-spec-sheet move: a
// Look can't be internally contradictory, and power users tweak one axis after.
export const CAMERA_LOOKS: { id: string; label: string; recipe: CameraRecipe; motion?: string }[] = [
  { id: "portrait", label: "Portrait", recipe: { framing: "close", depth: 90, light: "soft" } },
  { id: "epic-wide", label: "Epic Wide", recipe: { framing: "wide", depth: 10, light: "golden" } },
  { id: "noir", label: "Noir", recipe: { framing: "medium", depth: 70, light: "noir" } },
  { id: "doc", label: "Doc Handheld", recipe: { framing: "medium", depth: 45, light: "soft" }, motion: "handheld" },
  { id: "neon-macro", label: "Neon Macro", recipe: { framing: "macro", depth: 85, light: "neon" } },
];

// The axes a one-variable re-roll can sweep, with the values it fires across.
// Depth sweeps the coherent stops; framing/light sweep their option ids.
export const SWEEP_AXES: { axis: CameraAxis; label: string; values: (string | number)[] }[] = [
  { axis: "framing", label: "Framing", values: FRAMING_OPTIONS.map((o) => o.id) },
  { axis: "depth", label: "Depth", values: [10, 30, 50, 70, 90] },
  { axis: "light", label: "Light", values: LIGHT_OPTIONS.map((o) => o.id) },
];
