/**
 * Seed per-user accounts and backfill the free-text operator/approver strings to
 * real user ids. Idempotent — safe to re-run. Run AFTER `tsx scripts/migrate.ts`.
 *
 *   SEED_ADMIN_EMAIL=you@studio.com SEED_ADMIN_PASSWORD=secret123 \
 *   SEED_ADMIN_NAME="Eppi" tsx scripts/seed-users.ts
 *
 * - Creates/updates a first admin from SEED_ADMIN_* (defaults provided).
 * - Creates a placeholder account per distinct jobs.operator name (temp password
 *   = TEMP_PASSWORD or "changeme123"), so existing history attaches to a user.
 * - Backfills jobs.user_id / assets.approved_by_id by name match.
 * - Mirrors all users into the Media Library DB (best-effort).
 */
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../lib/password";
import { safeMirrorUser } from "../studiolibrary/lib/users-mirror";

const sql = neon(process.env.DATABASE_URL!);

function slug(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "user";
}

async function uniqueHandle(seed: string): Promise<string> {
  let handle = seed;
  for (let n = 2; n < 1000; n++) {
    const hit = await sql`SELECT 1 FROM users WHERE handle = ${handle}`;
    if (!hit.length) return handle;
    handle = `${seed}-${n}`;
  }
  return `${seed}-${Date.now()}`;
}

/** Upsert a user by email; returns the row. Only sets a password on insert. */
async function upsertUser(input: {
  email: string; name: string; role: string; password: string;
}): Promise<{ id: number; name: string; email: string; handle: string; role: string; avatar_url: string | null; active: boolean }> {
  const existing = await sql`SELECT id, email, name, handle, role, avatar_url, active FROM users WHERE lower(email) = lower(${input.email})`;
  if (existing[0]) return existing[0] as never;
  const handle = await uniqueHandle(slug(input.name));
  const r = await sql`
    INSERT INTO users (email, name, handle, role, password_hash)
    VALUES (${input.email}, ${input.name}, ${handle}, ${input.role}, ${hashPassword(input.password)})
    RETURNING id, email, name, handle, role, avatar_url, active`;
  return r[0] as never;
}

async function main() {
  // 1) First admin.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Studio Admin";
  const adminPw = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const admin = await upsertUser({ email: adminEmail, name: adminName, role: "admin", password: adminPw });
  console.log(`✅ admin: ${admin.name} <${admin.email}> (@${admin.handle})`);

  // 2) One account per distinct operator that produced jobs.
  const tempPw = process.env.TEMP_PASSWORD ?? "changeme123";
  const operators = (await sql`
    SELECT DISTINCT operator FROM jobs
    WHERE operator IS NOT NULL AND operator <> '' AND operator <> 'unknown'`) as { operator: string }[];
  for (const { operator } of operators) {
    const email = `${slug(operator)}@studio.local`;
    const u = await upsertUser({ email, name: operator, role: "creative", password: tempPw });
    console.log(`   • ${u.name} <${u.email}>`);
  }

  // 3) Backfill linkage by name match (denormalized strings → ids).
  await sql`UPDATE jobs   j SET user_id        = u.id FROM users u WHERE j.operator    = u.name AND j.user_id IS NULL`;
  await sql`UPDATE assets a SET approved_by_id = u.id FROM users u WHERE a.approved_by = u.name AND a.approved_by_id IS NULL`;

  // 4) Mirror everyone into the library DB (best-effort).
  const all = (await sql`
    SELECT id, name, email, handle, role, avatar_url, active FROM users`) as {
    id: number; name: string; email: string; handle: string; role: string; avatar_url: string | null; active: boolean;
  }[];
  for (const u of all) {
    await safeMirrorUser({
      id: u.id, name: u.name, email: u.email, handle: u.handle,
      role: u.role as never, avatar_url: u.avatar_url, active: u.active,
    });
  }
  console.log(`✅ seeded ${all.length} user(s); jobs/assets backfilled; mirror synced`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error("seed-users failed:", e); process.exit(1); });
