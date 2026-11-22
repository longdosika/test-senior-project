import { createPool, loadConfig } from "../container";
import { runMigrations } from "./migrate";

async function main() {
  const { databaseUrl } = loadConfig();
  if (!databaseUrl) throw new Error("DATABASE_URL is required (see .env.example)");
  const db = createPool(databaseUrl);
  try {
    const applied = await runMigrations(db);
    console.log(applied.length ? `applied: ${applied.join(", ")}` : "schema is up to date");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
