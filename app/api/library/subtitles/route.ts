/**
 * Subtitle cues for an asset (from its Whisper transcript): read, save edits
 * (rewrites SRT/VTT sidecars), and export as SRT/VTT.
 */
import { NextResponse } from "next/server";
import { sql } from "@/studiolibrary/lib/db/client";
import { saveTranscriptEdits, toSRT, toVTT } from "@/studiolibrary/lib/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cue { start: number; end: number; text: string }

export async function GET(req: Request) {
  const u = new URL(req.url);
  const assetId = Number(u.searchParams.get("assetId"));
  const format = u.searchParams.get("format"); // srt | vtt → download
  const rows = await sql<{ language: string | null; segments: Cue[] }>`
    SELECT language, segments FROM transcripts WHERE asset_id = ${assetId}`;
  const segments = rows[0]?.segments ?? [];

  if (format === "srt" || format === "vtt") {
    const body = format === "srt" ? toSRT(segments) : toVTT(segments);
    return new Response(body, {
      headers: {
        "Content-Type": format === "srt" ? "application/x-subrip" : "text/vtt",
        "Content-Disposition": `attachment; filename="captions.${format}"`,
      },
    });
  }
  return NextResponse.json({ language: rows[0]?.language ?? null, segments });
}

export async function POST(req: Request) {
  const b = await req.json();
  const assetId = Number(b.assetId);
  const segments = (b.segments ?? []) as Cue[];
  try {
    await saveTranscriptEdits(assetId, segments, b.language ?? null);
    return NextResponse.json({ ok: true, cues: segments.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
