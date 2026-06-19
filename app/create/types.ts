/** Shared create-page types, lifted out so both page.tsx and the extracted
 *  composer components (components.tsx) reference one definition. */

export type RefKind = "image" | "video" | "audio";

// Slot a reference by its mime type so each model's per-type cap is enforced.
export function refKind(a: { content_type: string | null }): RefKind {
  const ct = a.content_type ?? "";
  if (ct.startsWith("video")) return "video";
  if (ct.startsWith("audio")) return "audio";
  return "image";
}

export interface RefAsset {
  id: number;
  blob_url: string;
  content_type: string | null;
  label: string;
  status?: string;
}

/** Camera direction as creative INTENT, compiled to prompt language at submit
 *  (cameraPhrase in constants.ts) — never raw model params. Three axes, because
 *  three things actually change the frame:
 *    framing — how much of the subject fills the frame (FRAMING_OPTIONS id)
 *    depth   — 0 (deep focus, everything sharp) → 100 (shallow, creamy bokeh).
 *              One continuous axis replacing the focal+aperture spec-sheet, so a
 *              physically impossible frame (85mm at f/11 deep focus) can't be built.
 *              `undefined` = no depth direction.
 *    light   — mood / direction (LIGHT_OPTIONS id)
 *  Every field optional — an empty recipe adds nothing to the prompt. */
export interface CameraRecipe {
  framing?: string;
  depth?: number;
  light?: string;
}

/** Which single axis a one-variable re-roll sweeps. */
export type CameraAxis = "framing" | "depth" | "light";
