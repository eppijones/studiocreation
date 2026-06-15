import { GalleryView } from "../GalleryView";

/** Shareable deep link — /gallery/<id> opens the gallery with that render in review. */
export default async function GalleryAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assetId = Number(id);
  return <GalleryView initialOpenId={Number.isInteger(assetId) ? assetId : undefined} />;
}
