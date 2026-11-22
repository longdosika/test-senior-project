import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MIGRATIONS_DIR, runMigrations } from "./migrate";

function memoryPool(): Pool {
  const { Pool: MemPool } = newDb().adapters.createPg();
  return new MemPool() as unknown as Pool;
}

describe("database migrations", () => {
  let dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
    dirs = [];
  });

  it("applies the bundled schema once and is idempotent", async () => {
    const db = memoryPool();
    const first = await runMigrations(db);
    expect(first).toEqual(["001_init.sql"]);
    expect(await runMigrations(db)).toEqual([]);

    const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
    expect(rows.map((r) => r.name)).toEqual(["001_init.sql"]);
  });

  it("creates every table the API depends on", async () => {
    const db = memoryPool();
    await runMigrations(db);
    for (const table of ["users", "sessions", "tasks", "files", "payments", "quizzes", "quiz_questions", "quiz_attempts", "user_badges", "push_subscriptions"]) {
      await expect(db.query(`SELECT COUNT(*) FROM ${table}`)).resolves.toBeDefined();
    }
  });

  it("applies new migration files in name order", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sp-mig-"));
    dirs.push(dir);
    await writeFile(path.join(dir, "002_b.sql"), "CREATE TABLE b (id TEXT PRIMARY KEY);");
    await writeFile(path.join(dir, "001_a.sql"), "-- comment\nCREATE TABLE a (id TEXT PRIMARY KEY);");
    const db = memoryPool();
    expect(await runMigrations(db, dir)).toEqual(["001_a.sql", "002_b.sql"]);
  });

  it("points at the server migrations directory by default", () => {
    expect(DEFAULT_MIGRATIONS_DIR.endsWith(path.join("server", "db", "migrations"))).toBe(true);
  });
});
