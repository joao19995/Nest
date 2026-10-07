import postgres from "postgres";

type PostgresClient = ReturnType<typeof postgres>;

const globalForPostgres = globalThis as typeof globalThis & { financePostgres?: PostgresClient };

export function getPostgres() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  globalForPostgres.financePostgres ??= postgres(connectionString, {
    ssl: "require",
    max: 1,
    prepare: false,
  });

  return globalForPostgres.financePostgres;
}
