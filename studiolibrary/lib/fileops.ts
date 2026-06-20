/**
 * File-management operations on a WRITABLE local volume — move / copy / rename /
 * new-folder / delete — with DB reconciliation and activity logging. This is the
 * "manage media on disk from the web UI" layer.
 *
 * SAFETY: every op resolves a volume and refuses unless it is genuinely
 * writable (`isWritable`). The on-prem archive (SMB) is never writable, so there
 * is no path here that can mutate masters. Deletes are SOFT (recycle bin).
 */
import { rm } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { PROXY_ROOT } from "./config/index";
import { makeVolume, isWritable, type WritableVolume } from "./volumes/index";
import {
  getVolumeById, rewriteAssetPaths, assetsUnderPrefix, deleteAssetRow, addEvent, getAsset,
} from "./repo";
import { ingestFile } from "./crawler";

async function resolveWritable(volumeId: number): Promise<WritableVolume> {
  const v = await getVolumeById(volumeId);
  if (!v) throw new Error("volume not found");
  const vol = makeVolume({ name: v.name, kind: v.kind, root: v.root, readOnly: v.read_only });
  if (!isWritable(vol)) throw new Error(`volume "${v.name}" is read-only — file edits are disabled`);
  return vol;
}

/** Move a file or folder to a new path (drag-and-drop on disk). Keeps assets
 *  attached (proxies/comments survive). */
export async function movePath(volumeId: number, srcRel: string, destRel: string, actor: string | null) {
  if (!destRel || destRel === srcRel) return { moved: 0 };
  const vol = await resolveWritable(volumeId);
  await vol.move(srcRel, destRel);
  const ids = await rewriteAssetPaths(volumeId, srcRel, destRel, vol.root);
  for (const id of ids) await addEvent(id, actor, "file_op", { op: "move", from: srcRel, to: destRel });
  return { moved: ids.length };
}

/** Move a single asset into a target folder (the common drag-drop case). */
export async function moveAssetToFolder(assetId: number, destFolder: string, actor: string | null) {
  const a = await getAsset(assetId);
  if (!a) throw new Error("asset not found");
  const destRel = destFolder ? `${destFolder}/${a.filename}` : a.filename;
  return movePath(a.volume_id, a.rel_path, destRel, actor);
}

export async function renamePath(volumeId: number, relPath: string, newName: string, actor: string | null) {
  const clean = newName.replace(/[/\\]/g, "").trim();
  if (!clean) throw new Error("invalid name");
  const destRel = join(dirname(relPath), clean);
  return movePath(volumeId, relPath, destRel, actor);
}

export async function copyPath(volumeId: number, srcRel: string, destRel: string) {
  const vol = await resolveWritable(volumeId);
  await vol.copy(srcRel, destRel);
  return { ok: true, rescan: true }; // new files indexed on next crawl/rescan
}

export async function makeFolder(volumeId: number, relPath: string) {
  const vol = await resolveWritable(volumeId);
  await vol.makeDir(relPath);
  return { ok: true };
}

/**
 * Delete an asset. Modes:
 *  - "trash"     : soft-delete the original to the recycle bin AND drop the
 *                  catalog row + proxy files (recoverable from the recycle bin).
 *  - "decatalog" : remove the catalog row only; leave the original on disk
 *                  (the only mode allowed on a read-only volume).
 */
export async function deleteAsset(assetId: number, mode: "trash" | "decatalog", actor: string | null) {
  const a = await getAsset(assetId);
  if (!a) throw new Error("asset not found");

  if (mode === "trash") {
    const vol = await resolveWritable(a.volume_id);
    const trashRel = await vol.trash(a.rel_path);
    await addEvent(assetId, actor, "file_op", { op: "trash", from: a.rel_path, to: trashRel });
    await rm(join(PROXY_ROOT, String(assetId)), { recursive: true, force: true });
    await deleteAssetRow(assetId);
    return { deleted: true, trashed: trashRel };
  }
  // decatalog — never touches disk; valid on read-only volumes too.
  await rm(join(PROXY_ROOT, String(assetId)), { recursive: true, force: true });
  await deleteAssetRow(assetId);
  return { deleted: true, trashed: null };
}

/** Upload files into a folder on the writable volume, then index each (which
 *  fires the ingest automation → proxy/transcribe). Returns the new assets. */
export async function uploadFiles(
  volumeId: number, destFolder: string, files: { name: string; data: Buffer }[], _actor: string | null
) {
  const vol = await resolveWritable(volumeId);
  const added: { id: number; kind: string; relPath: string }[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    const safeName = basename(f.name).replace(/[/\\]/g, "_");
    const target = destFolder ? `${destFolder}/${safeName}` : safeName;
    const finalRel = await vol.writeFile(target, f.data);
    const ing = await ingestFile(vol, finalRel);
    if (ing) added.push({ ...ing, relPath: finalRel });
    else skipped.push(safeName); // unsupported kind — file written but not indexed
  }
  return { added, skipped };
}

/** Soft-delete a whole folder subtree: trash on disk + drop its asset rows.
 *  (Per-asset events aren't logged — the rows are removed by cascade.) */
export async function trashFolder(volumeId: number, relPath: string, _actor: string | null) {
  const vol = await resolveWritable(volumeId);
  const assets = await assetsUnderPrefix(volumeId, relPath);
  const trashRel = await vol.trash(relPath);
  for (const a of assets) {
    await rm(join(PROXY_ROOT, String(a.id)), { recursive: true, force: true });
    await deleteAssetRow(a.id);
  }
  return { deleted: assets.length, trashed: trashRel, folder: basename(relPath) };
}
