/**
 * Volume resolver — turns a config VolumeDef (or a DB volume row) into a live
 * read-only Volume adapter. The rest of the engine never news up an adapter
 * directly; it asks here, so dev↔Oslo stays a config concern.
 */
import type { Volume } from "./types";
import { LocalVolume } from "./local";
import { SMBVolume } from "./smb";
import { VOLUMES, type VolumeDef, type VolumeKind } from "../config/index";

export type { Volume, WritableVolume, DiscoveredFile } from "./types";
export { isWritable } from "./types";
export { LocalVolume } from "./local";
export { SMBVolume } from "./smb";

export function makeVolume(def: {
  name: string;
  kind: VolumeKind;
  root: string;
  readOnly?: boolean;
}): Volume {
  // The on-prem archive (SMB) is ALWAYS read-only. Local volumes are writable
  // unless the def marks them read-only.
  if (def.kind === "smb") return new SMBVolume(def.name, def.root);
  return new LocalVolume(def.name, def.root, def.readOnly === false);
}

/** All volumes declared in config (Phase 0 = the local test volume only). */
export function configuredVolumes(): { def: VolumeDef; volume: Volume }[] {
  return VOLUMES.map((def) => ({ def, volume: makeVolume(def) }));
}
