import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

loadEnv({ path: path.resolve(process.cwd(), ".env") });
loadEnv({ path: path.resolve(process.cwd(), ".env.production") });

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(currentDir, "../../../../drizzle"),
    });
  } finally {
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log("Database migrations completed.");
  })
  .catch((error) => {
    console.error("Database migrations failed.");
    console.error(error);
    process.exit(1);
  });
