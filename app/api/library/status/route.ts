/** Library dashboard: volumes, asset/job counts, folders + facets for filters. */
import { NextResponse } from "next/server";
import { libraryStats, folderCounts, facets } from "@/studiolibrary/lib/queries";
import { listReviewStates, listCustomFields } from "@/studiolibrary/lib/review";
import { listCollections } from "@/studiolibrary/lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [stats, folders, facetVals, reviewStates, customFields, collections] = await Promise.all([
      libraryStats(),
      folderCounts(),
      facets(),
      listReviewStates(),
      listCustomFields(),
      listCollections(),
    ]);
    return NextResponse.json({ ...stats, folders, facets: facetVals, reviewStates, customFields, collections });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, byKind: [], byStatus: [], jobs: {}, volumes: [], total: 0,
        folders: [], facets: { codecs: [], kinds: [] }, reviewStates: [], customFields: [], collections: [] },
      { status: 200 }
    );
  }
}
