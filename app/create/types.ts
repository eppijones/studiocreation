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
