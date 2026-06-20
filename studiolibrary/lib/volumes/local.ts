/**
 * LocalVolume — the Phase 0 (Mac, localhost) Volume adapter over a local
 * directory tree. Read-only by construction: it exposes no mutate methods.
 * Backs `studiolibrary/test-media` now; the same adapter serves any local
 * mount. The on-prem archive switch uses SMBVolume instead (see ./smb.ts).
 */
import {
  createReadStream,
  promises as fs,
  type ReadStream,
} from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import type { Dirent } from "node:fs";
import type { WritableVolume, DiscoveredFile } from "./types";
import { extOf, kindForExt, isIgnoredPath, type VolumeKind } from "../config/index";

export class LocalVolume implements WritableVolume {
  readonly kind: VolumeKind = "local";
  /** Writable only when explicitly enabled (the local dev fixture). */
  constructor(readonly name: string, readonly root: string, readonly writable: boolean = false) {}

  absPath(relPath: string): string {
    // Defend against traversal: the resolved path must stay under root.
    const abs = join(this.root, relPath);
    const rel = relative(this.root, abs);
    if (rel.startsWith("..") || rel.startsWith(`..${sep}`)) {
      throw new Error(`path escapes volume root: ${relPath}`);
    }
    return abs;
  }

  async *walk(): AsyncIterable<DiscoveredFile> {
    yield* this.walkDir(this.root);
  }

  private async *walkDir(dir: string): AsyncIterable<DiscoveredFile> {
    // Cast through unknown: @types/node makes Dirent generic over the name
    // type; a plain string path yields string names, which is what we use.
    const entries = (await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => null)) as unknown as Dirent[] | null;
    if (!entries) return; // unreadable dir — skip, don't crash the crawl
    for (const entry of entries) {
      if (isIgnoredPath(entry.name)) continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* this.walkDir(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extOf(entry.name);
      if (!kindForExt(ext)) continue; // only index known media/doc/project kinds
      let st;
      try {
        st = await fs.stat(abs);
      } catch {
        continue;
      }
      yield {
        relPath: relative(this.root, abs).split(sep).join("/"),
        absPath: abs,
        filename: entry.name,
        ext,
        sizeBytes: st.size,
        mtime: st.mtime,
      };
    }
  }

  async list(relPath: string): Promise<{
    dirs: { name: string }[];
    files: { name: string; ext: string; sizeBytes: number; mtime: Date }[];
  }> {
    const dir = relPath ? this.absPath(relPath) : this.root;
    const dirs: { name: string }[] = [];
    const files: { name: string; ext: string; sizeBytes: number; mtime: Date }[] = [];
    const entries = (await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => null)) as unknown as Dirent[] | null;
    if (!entries) return { dirs, files };
    for (const entry of entries) {
      if (isIgnoredPath(entry.name)) continue;
      if (entry.isDirectory()) {
        dirs.push({ name: entry.name });
      } else if (entry.isFile()) {
        let st;
        try {
          st = await fs.stat(join(dir, entry.name));
        } catch {
          continue;
        }
        files.push({ name: entry.name, ext: extOf(entry.name), sizeBytes: st.size, mtime: st.mtime });
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return { dirs, files };
  }

  async stat(relPath: string): Promise<{ sizeBytes: number; mtime: Date } | null> {
    try {
      const st = await fs.stat(this.absPath(relPath));
      return { sizeBytes: st.size, mtime: st.mtime };
    } catch {
      return null;
    }
  }

  openRead(relPath: string, range?: { start: number; end: number }): ReadStream {
    return createReadStream(this.absPath(relPath), range);
  }

  async readBytes(relPath: string, start: number, end: number): Promise<Buffer> {
    const fh = await fs.open(this.absPath(relPath), "r");
    try {
      const len = Math.max(0, end - start);
      const buf = Buffer.alloc(len);
      const { bytesRead } = await fh.read(buf, 0, len, start);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  // ── Write side (WritableVolume) — only on the explicitly-writable volume ──
  private assertWritable(): void {
    if (!this.writable) throw new Error(`volume "${this.name}" is read-only`);
  }

  async move(srcRel: string, destRel: string): Promise<void> {
    this.assertWritable();
    const src = this.absPath(srcRel);
    const dest = this.absPath(destRel);
    await fs.mkdir(dirname(dest), { recursive: true });
    try {
      await fs.rename(src, dest);
    } catch (e) {
      // Cross-device or other rename failure → copy then remove.
      if ((e as NodeJS.ErrnoException).code === "EXDEV") {
        await fs.cp(src, dest, { recursive: true });
        await fs.rm(src, { recursive: true, force: true });
      } else throw e;
    }
  }

  async copy(srcRel: string, destRel: string): Promise<void> {
    this.assertWritable();
    const dest = this.absPath(destRel);
    await fs.mkdir(dirname(dest), { recursive: true });
    await fs.cp(this.absPath(srcRel), dest, { recursive: true });
  }

  async makeDir(relPath: string): Promise<void> {
    this.assertWritable();
    await fs.mkdir(this.absPath(relPath), { recursive: true });
  }

  async writeFile(relPath: string, data: Buffer): Promise<string> {
    this.assertWritable();
    // De-dup on collision: name.ext → name (2).ext, name (3).ext, …
    let rel = relPath;
    for (let i = 2; i < 1000; i++) {
      try {
        await fs.access(this.absPath(rel));
      } catch {
        break; // free slot
      }
      const dot = relPath.lastIndexOf(".");
      rel = dot > relPath.lastIndexOf("/")
        ? `${relPath.slice(0, dot)} (${i})${relPath.slice(dot)}`
        : `${relPath} (${i})`;
    }
    const abs = this.absPath(rel);
    await fs.mkdir(dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
    return rel;
  }

  /** Soft-delete: move into the volume's hidden recycle bin (re-restorable).
   *  The crawler ignores dot-folders, so trashed files leave the index. */
  async trash(relPath: string): Promise<string> {
    this.assertWritable();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const trashRel = join(".recycle-bin", `${stamp}__${basename(relPath)}`);
    const dest = this.absPath(trashRel);
    await fs.mkdir(dirname(dest), { recursive: true });
    await fs.rename(this.absPath(relPath), dest);
    return trashRel;
  }
}
