import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { createApp } from "../app";
import type { AppDeps } from "../deps";
import { runMigrations } from "../db/migrate";
import { createFakeProviders } from "../providers/fakes";
import type { RealtimeEvent } from "../realtime";

/**
 * Builds the real Express app on an in-memory PostgreSQL-compatible database
 * (pg-mem) with all migrations applied, plus recording fakes for external services.
 */
export async function createTestApp(opts: { startAt?: Date } = {}) {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const db = new Pool() as unknown as Pool;
  await runMigrations(db);

  const fakes = createFakeProviders();
  const events: RealtimeEvent[] = [];
  let clock = opts.startAt ?? new Date("2026-11-22T10:00:00Z");

  const deps: AppDeps = {
    db,
    adminEmails: ["boss@example.com"],
    corsOrigin: "http://localhost:3000",
    storage: fakes.storage,
    payments: fakes.payments,
    ai: fakes.ai,
    push: fakes.push,
    line: fakes.line,
    events: { publish: (event) => events.push(event) },
    now: () => clock,
  };

  return {
    app: createApp(deps),
    deps,
    db,
    fakes,
    events,
    setNow(next: Date) {
      clock = next;
    },
    async close() {
      await db.end();
    },
  };
}
