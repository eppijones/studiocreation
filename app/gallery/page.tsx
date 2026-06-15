import { GalleryView } from "./GalleryView";

/** /gallery — the render wall. The reusable view lives in ./GalleryView so it can also
 *  back the /gallery/[id] deep link without a page file exporting a non-page symbol
 *  (Next.js only allows `default` + config exports from a page). */
export default function GalleryPage() {
  return <GalleryView />;
}
