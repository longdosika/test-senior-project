import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

export const DEFAULT_MIGRATIONS_DIR = path.resolve(process.cwd(), "server/db/migrations");

async function ensureMigrationTable(db: Pick<Pool, "query">): Promise<void> {
  try {
    await db.query("SELECT 1 FROM schema_migrations LIMIT 1");
  } catch {
    // Table missing (first run). Created without IF NOT EXISTS so the check above
    // is the only existence test.
    await db.query(
      "CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
  }
}

/**
 * Applies every *.sql file in `dir` (sorted by name) that has not been recorded
 * in `schema_migrations`. Returns the names applied during this call.
 */
export async function runMigrations(db: Pick<Pool, "query">, dir = DEFAULT_MIGRATIONS_DIR): Promise<string[]> {
  await ensureMigrationTable(db);
  const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    const statements = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await db.query(statement);
    }
    await db.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    applied.push(file);
  }
  return applied;
}
