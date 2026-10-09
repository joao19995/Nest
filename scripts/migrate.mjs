import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const sql = postgres(connectionString, { ssl: "require", max: 1, prepare: false });

try {
  const migrationDirectory = join(process.cwd(), "migrations");
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();

  // Regista as migracoes aplicadas para nao executar duas vezes nem repetir
  // operacoes destrutivas. As migracoes sao idempotentes, por isso bases de
  // dados criadas antes deste registo aplicam cada ficheiro uma ultima vez.
  await sql.unsafe("CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const appliedRows = await sql.unsafe("SELECT filename FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipped ${file} (already applied)`);
      continue;
    }
    const contents = await readFile(join(migrationDirectory, file), "utf8");
    const statements = contents.split(";").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    await sql.unsafe("INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
    console.log(`Applied ${file}`);
  }
} finally {
  await sql.end();
}
