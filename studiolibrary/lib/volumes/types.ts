/**
 * Volume adapter — the FIRST hard abstraction.
 *
 * Crawler, worker and player talk ONLY to this interface. Swapping
 * LocalVolume → SMBVolume (the Oslo switch) is then a config change, not a
 * code change. There are deliberately NO write/rename/delete methods: masters
 * are read-only at the adapter level (one of the three independent guarantees,
 * alongside the OS-level CIFS `ro` flag and proxies-to-a-separate-location).
 */
import type { Readable } from "node:stream";
import type { VolumeKind } from "../config/index";

export interface DiscoveredFile {
  /** Path relative to the volume root, POSIX-style ("Media/Video/x.mp4"). */
  relPath: string;
  /** Absolute path on this host. */
  absPath: string;
  filename: string;
  ext: string;
  sizeBytes: number;
  /** Last-modified time. */
  mtime: Date;
}

export interface Volume {
  readonly name: string;
  readonly kind: VolumeKind;
  readonly root: string;

  /** Resolve a rel path to an absolute path on this host (read-side only). */
  absPath(relPath: string): string;

  /** Walk the tree, yielding every indexable file. Read-only. */
  walk(): AsyncIterable<DiscoveredFile>;

  /** Stat a single file (for reconcile / range serving). */
  stat(relPath: string): Promise<{ sizeBytes: number; mtime: Date } | null>;

  /** Open a (optionally ranged) read stream — powers HTTP range proxy serving. */
  openRead(relPath: string, range?: { start: number; end: number }): Readable;

  /** Read raw bytes [start, end) — used for the head/tail signature sampling. */
  readBytes(relPath: string, start: number, end: number): Promise<Buffer>;

  /** Shallow, read-only directory listing for the file-explorer view: the
   *  immediate subfolders + files of `relPath` (folders are walked into by the
   *  UI, not the crawler). Hidden/junk entries are skipped. */
  list(relPath: string): Promise<{
    dirs: { name: string }[];
    files: { name: string; ext: string; sizeBytes: number; mtime: Date }[];
  }>;

  /** True only for an explicitly-writable LOCAL volume. NEVER true for SMB
   *  (the on-prem archive): masters are read-only at the adapter level. */
  readonly writable: boolean;
}

/**
 * Write-side capability — ONLY a local, explicitly-writable volume exposes
 * this. The crawler/player never touch it. File-management actions go through
 * here, and the API gates them on `volume.writable`. The SMB archive adapter
 * does not implement it, so there is no code path that mutates masters.
 */
export interface WritableVolume extends Volume {
  /** Move/rename a file or directory within the volume. */
  move(srcRel: string, destRel: string): Promise<void>;
  /** Copy a file or directory within the volume. */
  copy(srcRel: string, destRel: string): Promise<void>;
  /** Create a directory (recursive). */
  makeDir(relPath: string): Promise<void>;
  /** Write bytes to a new/overwritten file (upload). Returns the final relPath
   *  (de-duplicated if a name collision occurred). */
  writeFile(relPath: string, data: Buffer): Promise<string>;
  /** Soft-delete to the volume's recycle bin; returns the new trash relPath. */
  trash(relPath: string): Promise<string>;
}

/** Narrow a Volume to a WritableVolume when it is genuinely writable. */
export function isWritable(v: Volume): v is WritableVolume {
  return v.writable && typeof (v as WritableVolume).move === "function";
}
