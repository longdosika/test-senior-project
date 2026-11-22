import { createServer } from "node:http";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { createApp } from "../server/app";
import { createDeps, createPool, loadConfig } from "../server/container";
import { runMigrations } from "../server/db/migrate";
import { attachRealtime } from "../server/realtime";

/**
 * Starts the real Express API for the browser tests. Uses PostgreSQL when TEST_DATABASE_URL is
 * set (its public schema is reset, so point it at a disposable database); otherwise an in-memory
 * pg-mem database so `pnpm e2e` also runs on a machine without PostgreSQL.
 */
async function openDatabase(): Promise<Pool> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pool = createPool(url);
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    return pool;
  }
  const { Pool: MemPool } = newDb().adapters.createPg();
  return new MemPool() as unknown as Pool;
}

async function main() {
  const config = loadConfig(process.env);
  const db = await openDatabase();
  const applied = await runMigrations(db);
  console.log(`[e2e api] database: ${process.env.TEST_DATABASE_URL ? "PostgreSQL" : "pg-mem"}; migrations: ${applied.length}`);

  const server = createServer();
  const realtime = attachRealtime(server);
  server.on("request", createApp(createDeps({ db, config, events: realtime })));
  server.listen(config.port, () => console.log(`[e2e api] listening on ${config.port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
