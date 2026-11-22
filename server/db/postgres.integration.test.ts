import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

/**
 * Runs the migrations against a real PostgreSQL server. Skipped unless
 * TEST_DATABASE_URL is set, e.g. TEST_DATABASE_URL=postgres://user:pass@localhost:5432/senior_test
 * Use a disposable database: this test drops and recreates the public schema.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PostgreSQL integration", () => {
  const pool = url ? new Pool({ connectionString: url }) : undefined;

  afterAll(async () => {
    await pool?.end();
  });

  it("creates the schema on a real server and is idempotent", async () => {
    if (!pool) throw new Error("pool not initialised");
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const first = await runMigrations(pool);
    expect(first).toEqual(["001_init.sql"]);
    expect(await runMigrations(pool)).toEqual([]);

    const { rows } = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(11);

    // Real constraints are enforced by PostgreSQL.
    await expect(
      pool.query("INSERT INTO tasks (id, title, status, created_by) VALUES ('x', 't', 'bogus', 'nobody')"),
    ).rejects.toThrow();
  });
});
