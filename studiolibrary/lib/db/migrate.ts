/**
 * Apply the Media Library schema. Idempotent — `CREATE ... IF NOT EXISTS`
 * throughout, so re-running is safe. Also seeds the volumes from config.
 *
 *   pnpm library:migrate
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, sql } from "./client";
import { VOLUMES } from "../config/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  // Apply base schema, then the review/management migration. Both idempotent.
  for (const file of ["schema.sql", "review.sql"]) {
    await pool.query(readFileSync(join(__dirname, file), "utf8"));
    console.log(`✅ applied ${file}`);
  }

  // Seed / reconcile volumes from config (the source of truth).
  for (const v of VOLUMES) {
    await sql`
      INSERT INTO volumes (name, kind, root, read_only)
      VALUES (${v.name}, ${v.kind}, ${v.root}, ${v.readOnly})
      ON CONFLICT (name) DO UPDATE SET
        root = EXCLUDED.root, kind = EXCLUDED.kind, read_only = EXCLUDED.read_only
    `;
    console.log(`   • volume "${v.name}" (${v.kind}) → ${v.root}`);
  }
}

migrate()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("migration failed:", e);
    process.exit(1);
  });
