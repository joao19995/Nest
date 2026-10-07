import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const sql = postgres(connectionString, { ssl: "require", max: 1, prepare: false });

const seed = {
  people: [
    { id: "0f650efa-c6c4-4d84-97c9-62e9f97a1d01", name: "João" },
    { id: "d13e9e0d-beb7-4f97-a86f-a2d83e1bc220", name: "Natch" },
  ],
  accounts: [
    { id: "2eb4767d-39eb-45d3-b280-281baab67a01", name: "João", ownerPersonId: "0f650efa-c6c4-4d84-97c9-62e9f97a1d01" },
    { id: "a2e1eb66-e43c-4e5e-bb5b-7f510a110c15", name: "Natch", ownerPersonId: "d13e9e0d-beb7-4f97-a86f-a2d83e1bc220" },
    { id: "6c1dc1ca-6b0a-4ab2-8b24-25dc2d0b23be", name: "Conjunta", ownerPersonId: null },
  ],
  categories: [
    { id: "c472c0d6-4ae0-4835-bf58-34cc9801420a", name: "Casa", type: "FIXED" },
    { id: "20dd6cf8-9bb6-468b-86ac-bf47d3d96eae", name: "Carro", type: "VARIABLE" },
    { id: "e4f97dc8-ddb9-41f7-9c8a-187a2c419f51", name: "Cão", type: "VARIABLE" },
    { id: "f6d5b176-304b-4256-97fa-ce6a45e9191f", name: "Extras", type: "VARIABLE" },
  ],
};

try {
  await sql.begin(async (transaction) => {
    for (const person of seed.people) {
      await transaction`INSERT INTO person (id, name) VALUES (${person.id}, ${person.name}) ON CONFLICT (id) DO NOTHING`;
    }
    for (const account of seed.accounts) {
      await transaction`INSERT INTO account (id, name, owner_person_id) VALUES (${account.id}, ${account.name}, ${account.ownerPersonId}) ON CONFLICT (id) DO NOTHING`;
    }
    for (const category of seed.categories) {
      await transaction`INSERT INTO category (id, name, type, active) VALUES (${category.id}, ${category.name}, ${category.type}, TRUE) ON CONFLICT (id) DO NOTHING`;
    }
  });
  console.log("Seeded people, accounts and categories.");
} finally {
  await sql.end();
}
