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

  for (const file of files) {
    const contents = await readFile(join(migrationDirectory, file), "utf8");
    const statements = contents.split(";").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    console.log(`Applied ${file}`);
  }
} finally {
  await sql.end();
}
