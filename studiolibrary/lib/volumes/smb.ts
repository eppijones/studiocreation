/**
 * SMBVolume — the Oslo (prod) Volume adapter over the on-prem archive's CIFS mount.
 *
 * STUBBED ON PURPOSE for Phase 0. We are NOT connecting to the on-prem archive
 * before we're home. In Oslo, the archive is mounted READ-ONLY (CIFS `ro`) at a
 * native WSL2 path; this class then behaves exactly like LocalVolume over that
 * mountpoint — same read-only surface, no write methods. The only thing that
 * changes app-wide is the volume entry in config + the encoder flip to nvenc.
 *
 * Because masters are a plain read-only POSIX mount once CIFS is up, this can
 * extend LocalVolume's read logic verbatim. We keep it as a separate class so
 * Oslo-specific concerns (credential handling, offline detection, SMB retry)
 * have a home, and so nothing accidentally enables it before Oslo.
 */
import { LocalVolume } from "./local";
import type { VolumeKind } from "../config/index";

export class SMBVolume extends LocalVolume {
  readonly kind: VolumeKind = "smb";

  constructor(name: string, mountpoint: string) {
    super(name, mountpoint);
    if (!process.env.LIBRARY_ALLOW_SMB) {
      // Hard guard: refuse to construct until explicitly enabled in Oslo.
      throw new Error(
        "SMBVolume is disabled in Phase 0. Do NOT connect to the on-prem archive yet. " +
          "Set LIBRARY_ALLOW_SMB=1 only on the Oslo host, with the share mounted read-only."
      );
    }
  }

  // Inherits read-only walk/stat/openRead/readBytes from LocalVolume.
  // There are intentionally NO write/rename/delete methods — masters are
  // never mutated through the adapter (guarantee #2 of three).
}
