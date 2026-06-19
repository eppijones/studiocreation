/** Model families — the catalog has one logical model in several "driven-by"
 *  variants (Seedance 2.0 from text / from an image / from references; GPT Image 2
 *  base + edit). The composer treats the FAMILY as the primary choice and lets you
 *  swap the variant inline, so picking a model is one decision, not five. Pure
 *  derivation over the live pricing catalog — no second source of truth. */
import { type ModelInfo } from "@/lib/pricing";

export type Variant = "text" | "image" | "refs" | "edit";

export const VARIANT_META: Record<Variant, { label: string; short: string; hint: string }> = {
  text: { label: "From text", short: "Text", hint: "Generate from your prompt alone" },
  image: { label: "From an image", short: "Image", hint: "Drive from a start / subject image" },
  refs: { label: "From references", short: "Refs", hint: "Guide with several reference media" },
  edit: { label: "Edit", short: "Edit", hint: "Edit from reference image(s)" },
};

const VARIANT_ORDER: Variant[] = ["text", "image", "refs", "edit"];

export function variantOf(m: ModelInfo): Variant {
  switch (m.kind) {
    case "image-to-video":
      return "image";
    case "reference-to-video":
      return "refs";
    case "image-edit":
      return "edit";
    default:
      return "text"; // text-to-image / text-to-video
  }
}

/** Family id = model id with its variant suffix stripped, so every variant of one
 *  model collapses to the same key. */
export function familyKey(id: string): string {
  return id.replace(/\/(text-to-video|image-to-video|reference-to-video|text-to-image|edit)$/, "");
}

export interface ModelFamily {
  key: string;
  /** clean family name, e.g. "Seedance 2.0" (parenthetical / "Edit" stripped) */
  label: string;
  /** variants, ordered text → image → refs → edit */
  members: ModelInfo[];
  /** the standard variant the family lands on (prefer text/base) */
  base: ModelInfo;
  /** image vs video — every member of a family shares one unit */
  isVideo: boolean;
  /** any variant pinned as a top model */
  featured: boolean;
}

export function buildFamilies(models: ModelInfo[]): ModelFamily[] {
  const map = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const k = familyKey(m.id);
    const arr = map.get(k);
    if (arr) arr.push(m);
    else map.set(k, [m]);
  }
  const families: ModelFamily[] = [];
  for (const [key, members] of map) {
    members.sort((a, b) => VARIANT_ORDER.indexOf(variantOf(a)) - VARIANT_ORDER.indexOf(variantOf(b)));
    const base = members.find((m) => variantOf(m) === "text") ?? members[0];
    const label = base.label.replace(/\s*\(.*\)\s*$/, "").replace(/\s+Edit$/, "").trim();
    families.push({
      key,
      label,
      members,
      base,
      isVideo: base.unit === "video_second",
      featured: members.some((m) => m.featured),
    });
  }
  return families;
}

/** The family a given model id belongs to. */
export function familyOf(models: ModelInfo[], id: string): ModelFamily | undefined {
  const key = familyKey(id);
  return buildFamilies(models).find((f) => f.key === key);
}

/** Variant short labels for a family, e.g. "Text · Image · Refs" — used as a hint. */
export function variantSummary(f: ModelFamily): string {
  return f.members.map((m) => VARIANT_META[variantOf(m)].short).join(" · ");
}
