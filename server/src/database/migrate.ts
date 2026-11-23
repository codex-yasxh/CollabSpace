import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withTransaction, closePool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../migrations");

export async function runMigrations(): Promise<number> {
  // 1. Ensure schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 2. Fetch applied migrations
  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY name ASC;",
  );
  const appliedSet = new Set(rows.map((r) => r.name));

  // 3. Read migration files
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

  let appliedCount = 0;

  for (const file of sqlFiles) {
    if (appliedSet.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = await fs.readFile(filePath, "utf-8");

    console.log(`Applying migration: ${file}...`);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name) VALUES ($1);",
        [file],
      );
    });

    console.log(`Applied: ${file}`);
    appliedCount++;
  }

  if (appliedCount === 0) {
    console.log("No new migrations to apply.");
  } else {
    console.log(`Successfully applied ${appliedCount} migration(s).`);
  }

  return appliedCount;
}

// If executed directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Migration failed:", error);
      await closePool();
      process.exit(1);
    });
}
