import { createServer } from "node:http";
import { createApp } from "./app";
import { loadConfig, createDeps, createPool } from "./container";
import { runMigrations } from "./db/migrate";
import { attachRealtime } from "./realtime";

async function main() {
  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required (see .env.example)");
  }
  const db = createPool(config.databaseUrl);
  const applied = await runMigrations(db);
  if (applied.length) console.log(`applied migrations: ${applied.join(", ")}`);

  const server = createServer();
  const realtime = attachRealtime(server);
  const deps = createDeps({ db, config, events: realtime });
  server.on("request", createApp(deps));

  server.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port} (WebSocket: /ws)`);
  });

  const shutdown = async () => {
    await realtime.close();
    server.close();
    await db.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
