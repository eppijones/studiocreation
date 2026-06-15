/** Create-composer constants, lifted out of the page to keep page.tsx focused on
 *  behaviour. Pure data — safe to share with the sequence builder and any future
 *  create sub-components. */

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
export const MOTION_PRESETS: { id: string; label: string; phrase: string }[] = [
  { id: "push", label: "Push-in", phrase: "slow push-in" },
  { id: "orbit", label: "Orbit", phrase: "smooth orbital camera move" },
  { id: "handheld", label: "Handheld", phrase: "handheld camera, subtle natural shake" },
  { id: "locked", label: "Locked-off", phrase: "locked-off static camera" },
  { id: "crash", label: "Crash zoom", phrase: "fast crash zoom" },
];
