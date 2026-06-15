// Pure types + helpers for brand profiles. NO server imports — safe to use
// from client components (the Create composer, the Brands site) and the API.

export interface BrandFonts {
  heading?: string;
  accent?: string;
  body?: string;
  display?: string;
}

export interface BrandProfile {
  /** Stable slug id, also the key in the profiles map. */
  id: string;
  label: string;
  /** project = top-level brand · game = a sub-brand of a project · none = the empty pick. */
  kind?: "project" | "game" | "none";
  /** id of the parent project, for sub-brands. */
  parent?: string;
  /** ids of child sub-brands, for projects. */
  subBrands?: string[];
  website?: string;
  tagline?: string;
  /** The style string appended to prompts — the brand-DNA lock. */
  style: string;
  /** Optional extra direction for video / motion jobs. */
  motion?: string;
  palette: string[];
  fonts?: BrandFonts;
  principles?: string[];
  values?: string;
  notes?: string;
  /** guide = authored from a real brand book · stub = placeholder · demo = AI-extracted (demo mode). */
  source?: "guide" | "stub" | "demo";
}

export type BrandMap = Record<string, BrandProfile>;

/** Materialise the raw profiles map into id-stamped objects. */
export function toBrandList(profiles: Record<string, Omit<BrandProfile, "id">>): BrandProfile[] {
  return Object.entries(profiles).map(([id, p]) => ({ id, ...p }));
}

/** Top-level brands (projects) — everything that isn't a sub-brand or the "none" pick. */
export function topLevelBrands(list: BrandProfile[]): BrandProfile[] {
  return list.filter((b) => b.id !== "none" && !b.parent);
}

/** The sub-brands belonging to a given project, in declared order where possible. */
export function subBrandsOf(list: BrandProfile[], parentId: string): BrandProfile[] {
  return list.filter((b) => b.parent === parentId);
}

/**
 * Resolve the full style suffix for a selected brand id, walking the parent
 * chain so a game inherits its project's DNA (project style first, then the
 * game skin on top). Returns "" for "none" / unknown.
 */
export function resolveBrandStyle(list: BrandProfile[], id: string): string {
  const brand = list.find((b) => b.id === id);
  if (!brand || !brand.style) return "";
  const parent = brand.parent ? list.find((b) => b.id === brand.parent) : null;
  return [parent?.style, brand.style].filter(Boolean).join(", ");
}

/** Human label including the project, e.g. "PortalOne · Centipede". */
export function brandPath(list: BrandProfile[], id: string): string {
  const brand = list.find((b) => b.id === id);
  if (!brand) return "";
  const parent = brand.parent ? list.find((b) => b.id === brand.parent) : null;
  return parent ? `${parent.label} · ${brand.label}` : brand.label;
}
