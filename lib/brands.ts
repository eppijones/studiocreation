import { sql } from "./db";
import seed from "@/config/brands.json";
import { toBrandList, type BrandMap, type BrandProfile } from "./brandTypes";

if (typeof window !== "undefined") {
  throw new Error("lib/brands.ts was imported in a client bundle");
}

const SEED = seed.profiles as unknown as BrandMap;

/**
 * Brand profiles = the seeded book (config/brands.json) with any custom brands
 * created in the app layered on top. Custom brands live in the `settings` table
 * under key `brands` (same pattern as budget settings) so they survive deploys
 * and a read-only prod filesystem.
 */
export async function getBrandMap(): Promise<BrandMap> {
  const custom = await readCustom();
  return { ...SEED, ...custom };
}

export async function getBrandList(): Promise<BrandProfile[]> {
  return toBrandList(await getBrandMap());
}

async function readCustom(): Promise<BrandMap> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'brands'`;
    if (rows[0]?.value) return rows[0].value as BrandMap;
  } catch {
    // settings table missing (pre-migration) — custom brands simply unavailable
  }
  return {};
}

async function writeCustom(custom: BrandMap, updatedBy: string): Promise<void> {
  await sql`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES ('brands', ${JSON.stringify(custom)}::jsonb, ${updatedBy}, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
  `;
}

export async function saveBrand(brand: BrandProfile, updatedBy: string): Promise<BrandProfile> {
  const custom = await readCustom();
  const { id, ...rest } = brand;
  custom[id] = rest as unknown as BrandProfile;
  // Keep the parent project's subBrands list in sync so the picker nests it.
  if (brand.parent) {
    const parent = custom[brand.parent] ?? SEED[brand.parent];
    if (parent) {
      const subs = new Set([...(parent.subBrands ?? []), id]);
      custom[brand.parent] = { ...parent, subBrands: [...subs] } as BrandProfile;
    }
  }
  await writeCustom(custom, updatedBy);
  return brand;
}

const HEX_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface SynthInput {
  name: string;
  website?: string;
  parent?: string;
  /** Pasted brand-guide text / notes the demo extractor mines for palette + tone. */
  sourceText?: string;
}

/**
 * MVP "demo mode" brand formula. A real version would hand the source material
 * to a model and get back a structured profile; for now this deterministically
 * mines any hex colors out of the pasted text and assembles a brand-DNA style
 * string from detected tone keywords. Clearly stamped source: "demo".
 */
export function synthesizeBrand(input: SynthInput): BrandProfile {
  const name = input.name.trim();
  const baseId = slugify(name) || "brand";
  const id = input.parent ? `${input.parent}-${baseId}` : baseId;
  const text = (input.sourceText ?? "").trim();

  const palette = Array.from(new Set(text.match(HEX_RE) ?? []))
    .map((h) => h.toUpperCase())
    .slice(0, 7);

  const tone = detectTone(text);
  const styleBits = [
    `${name} brand`,
    tone.length ? tone.join(", ") : "clean, modern, on-brand",
    palette.length ? `palette ${palette.join(" / ")}` : null,
    "consistent material and palette locked across every shot",
  ].filter(Boolean);

  return {
    id,
    label: name,
    kind: input.parent ? "game" : "project",
    parent: input.parent,
    website: input.website?.trim() || undefined,
    style: styleBits.join(", "),
    palette,
    notes: `Demo mode — extracted ${palette.length} colors and ${tone.length} tone cues from the supplied material. Hand-tune the style string, fonts and notes, or wire a model into synthesizeBrand() for real extraction.`,
    source: "demo",
  };
}

const TONE_LEXICON: Record<string, string> = {
  retro: "retro / vintage",
  "80s": "1980s retro-futurist",
  neon: "neon glow",
  synthwave: "synthwave / outrun",
  minimal: "minimal, lots of negative space",
  bold: "bold and high-contrast",
  playful: "playful and energetic",
  premium: "premium and refined",
  luxury: "luxury, refined",
  clean: "clean and precise",
  technical: "technical and precise",
  vibrant: "vibrant, saturated color",
  pastel: "soft pastel tones",
  dark: "dark, moody backdrops",
  gradient: "rich gradients",
  chrome: "chrome / holographic surfaces",
  arcade: "arcade-gaming energy",
};

function detectTone(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(TONE_LEXICON)
    .filter(([k]) => lower.includes(k))
    .map(([, v]) => v)
    .slice(0, 6);
}
