/**
 * StudioLibrary DB client — LOCAL Postgres + pgvector, via node-postgres.
 *
 * This is the Media Library's OWN database (DATABASE_URL_LIBRARY), entirely
 * separate from the app's Neon `sql` client in lib/db.ts. Used by the worker
 * (tsx) and by the /api/library/* routes (nodejs runtime). Never edge, never
 * the client bundle.
 */
import { Pool, type QueryResultRow } from "pg";

if (typeof window !== "undefined") {
  throw new Error("studiolibrary/lib/db/client.ts imported in a client bundle");
}

/** Defaults to the local docker-compose DB so dev works with zero env setup. */
const CONNECTION =
  process.env.DATABASE_URL_LIBRARY ??
  "postgresql://studio:studio@localhost:5433/studiolibrary";

// Reuse one pool across hot-reloads / route invocations.
const g = globalThis as unknown as { __libraryPool?: Pool };
export const pool: Pool =
  g.__libraryPool ??
  new Pool({ connectionString: CONNECTION, max: 8, idleTimeoutMillis: 30_000 });
if (!g.__libraryPool) g.__libraryPool = pool;

/** Tagged-template query, mirroring the ergonomics of the app's neon `sql`. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let text = "";
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) text += `$${i + 1}`;
  }
  const res = await pool.query<T>(text, values);
  return res.rows;
}

/** Plain parameterized query when a tagged template is awkward. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function closePool(): Promise<void> {
  await pool.end();
  g.__libraryPool = undefined;
}
