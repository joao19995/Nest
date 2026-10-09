// Teste da migracao 014 numa base local descartavel (NUNCA producao).
// 1) aplica 001..013 ; 2) cria dados no formato antigo ; 3) snapshot ;
// 4) aplica 014 ; 5) compara meses fechados/abertos ; 6) reaplica 014 (idempotencia).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

import { readFileSync } from "node:fs";

const REPO = "C:\\Users\\joao\\Desktop\\Test";
const REPO_MIGRATIONS = join(REPO, "migrations");
// Usa o servidor configurado em .env.local, mas uma base DESCARTAVEL separada (nunca a principal).
const TEST_DB_NAME = "nest_migration_014_test";
const envText = readFileSync(join(REPO, ".env.local"), "utf8");
const configured = envText.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m)?.[1];
if (!configured) throw new Error("DATABASE_URL nao encontrado em .env.local");
const base = new URL(configured);
const adminUrl = new URL(configured); adminUrl.pathname = "/postgres";
const testUrl = new URL(configured); testUrl.pathname = `/${TEST_DB_NAME}`;
const ADMIN = adminUrl.toString();
const DB = testUrl.toString();
console.log(`Servidor: ${base.host} | base de teste: ${TEST_DB_NAME}`);

const admin = postgres(ADMIN, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
await admin.end();

const sql = postgres(DB, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
const failures = [];
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`); if (!ok) failures.push(name); };

async function applyFile(file) {
  const contents = await readFile(join(REPO_MIGRATIONS, file), "utf8");
  const noComments = contents.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const statement of noComments.split(";").map((s) => s.trim()).filter(Boolean)) await sql.unsafe(statement);
}

const files = (await readdir(REPO_MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
const before014 = files.filter((f) => f < "014_items.sql");
for (const f of before014) await applyFile(f);
console.log(`Aplicadas ${before014.length} migracoes (001..013).`);

// Dados no formato pre-014 (ids dos seeds da app).
const P1 = "0f650efa-c6c4-4d84-97c9-62e9f97a1d01", P2 = "d13e9e0d-beb7-4f97-a86f-a2d83e1bc220";
const A1 = "2eb4767d-39eb-45d3-b280-281baab67a01", A2 = "a2e1eb66-e43c-4e5e-bb5b-7f510a110c15", AJ = "6c1dc1ca-6b0a-4ab2-8b24-25dc2d0b23be";
const CASA = "c472c0d6-4ae0-4835-bf58-34cc9801420a", CARRO = "20dd6cf8-9bb6-468b-86ac-bf47d3d96eae", CAO = "e4f97dc8-ddb9-41f7-9c8a-187a2c419f51", EXTRAS = "f6d5b176-304b-4256-97fa-ce6a45e9191f";
const T1 = "11111111-1111-4111-8111-111111111111", T2 = "22222222-2222-4222-8222-222222222222";
await sql`INSERT INTO person (id, name) VALUES (${P1}, 'João'), (${P2}, 'Natch')`;
await sql`INSERT INTO account (id, name, owner_person_id) VALUES (${A1}, 'João', ${P1}), (${A2}, 'Natch', ${P2}), (${AJ}, 'Conjunta', NULL)`;
await sql`INSERT INTO category (id, name, type) VALUES (${CASA}, 'Casa', 'FIXED'), (${CARRO}, 'Carro', 'VARIABLE'), (${CAO}, 'Cão', 'VARIABLE'), (${EXTRAS}, 'Extras', 'VARIABLE')`;
await sql`INSERT INTO category_template (id, valid_from) VALUES (${T1}, '2026-01'), (${T2}, '2026-05')`;
await sql`INSERT INTO category_template_entry (id, template_id, category_id, account_id, expected_amount, active) VALUES
  (gen_random_uuid(), ${T1}, ${CASA}, ${AJ}, 1000, TRUE),
  (gen_random_uuid(), ${T1}, ${CARRO}, ${AJ}, 100, TRUE),
  (gen_random_uuid(), ${T1}, ${CAO}, ${AJ}, 80, TRUE),
  (gen_random_uuid(), ${T1}, ${EXTRAS}, ${A1}, 180, TRUE),
  (gen_random_uuid(), ${T2}, ${CASA}, ${AJ}, 1100, TRUE),
  (gen_random_uuid(), ${T2}, ${CAO}, ${AJ}, 90, FALSE)`;
// Meses: 2026-01 e 2026-02 fechados (valores finais), 2026-03 aberto, 2026-05 fechado (template 2).
const M = { "2026-01": "aaaaaaa1-0000-4000-8000-000000000001", "2026-02": "aaaaaaa2-0000-4000-8000-000000000002", "2026-03": "aaaaaaa3-0000-4000-8000-000000000003", "2026-05": "aaaaaaa5-0000-4000-8000-000000000005" };
await sql`INSERT INTO monthly_plan (id, month, template_id, closed) VALUES
  (${M["2026-01"]}, '2026-01', ${T1}, TRUE), (${M["2026-02"]}, '2026-02', ${T1}, TRUE),
  (${M["2026-03"]}, '2026-03', ${T1}, FALSE), (${M["2026-05"]}, '2026-05', ${T2}, TRUE)`;
const entryRows = [];
const plannedFor = (tpl) => tpl === T1 ? { [CASA]: [1000, AJ], [CARRO]: [100, AJ], [CAO]: [80, AJ], [EXTRAS]: [180, A1] } : { [CASA]: [1100, AJ], [CAO]: [90, AJ] };
for (const [month, tpl] of [["2026-01", T1], ["2026-02", T1], ["2026-03", T1], ["2026-05", T2]]) {
  for (const [cat, [planned, acc]] of Object.entries(plannedFor(tpl))) {
    const actual = month === "2026-02" ? Math.round(planned * 0.73 * 100) / 100 : month === "2026-05" ? planned + 12.5 : month === "2026-03" ? 0 : planned;
    entryRows.push({ id: randomId(), mid: M[month], cat, acc, planned, actual });
  }
}
function randomId() { return crypto.randomUUID(); }
for (const r of entryRows) await sql`INSERT INTO monthly_plan_entry (id, monthly_plan_id, category_id, account_id, planned, actual) VALUES (${r.id}, ${r.mid}, ${r.cat}, ${r.acc}, ${r.planned}, ${r.actual})`;

const snapshotSql = () => sql`
  SELECT p.month, p.closed, p.template_id, e.id, e.category_id, e.account_id, e.planned::text, e.actual::text
  FROM monthly_plan_entry e JOIN monthly_plan p ON p.id = e.monthly_plan_id
  ORDER BY p.month, e.category_id`;
const templateSnapshot = () => sql`SELECT template_id, category_id, account_id, expected_amount::text, active FROM category_template_entry ORDER BY template_id, category_id`;
const beforeMonths = JSON.stringify(await snapshotSql());
const beforeTemplates = JSON.stringify(await templateSnapshot());
const closedBefore = JSON.stringify((await snapshotSql()).filter((r) => r.closed));
console.log(`Snapshot: ${entryRows.length} linhas de meses, ${(await templateSnapshot()).length} linhas de template.`);

// 4) aplicar 014 (mesmo split por ';' que scripts/migrate.mjs)
await applyFile("014_items.sql");
console.log("Aplicada 014_items.sql.");

// 5) comparacoes
const afterMonths = JSON.stringify((await snapshotSql()).map(({ item_id, ...rest }) => rest));
check("meses (planeado, actual, categoria, conta) identicos", afterMonths === beforeMonths);
const closedAfter = JSON.stringify((await snapshotSql()).filter((r) => r.closed));
check("meses FECHADOS identicos (valores e ids)", closedAfter === closedBefore);
const afterTemplates = JSON.stringify((await templateSnapshot()).map(({ item_id, ...rest }) => rest));
check("templates (valores, contas, active) identicos", afterTemplates === beforeTemplates);

const items = await sql`SELECT i.name, c.name AS category, i.active FROM item i JOIN category c ON c.id = i.category_id ORDER BY c.name`;
check("1 item por categoria existente", items.length === 4, JSON.stringify(items));
check("nome do item = nome da categoria", items.every((i) => i.name === i.category));
const nullItems = await sql`SELECT count(*)::int AS n FROM monthly_plan_entry WHERE item_id IS NULL`;
const nullTpl = await sql`SELECT count(*)::int AS n FROM category_template_entry WHERE item_id IS NULL`;
check("item_id preenchido em todas as linhas", nullItems[0].n === 0 && nullTpl[0].n === 0);
const mismatch = await sql`SELECT count(*)::int AS n FROM monthly_plan_entry e JOIN item i ON i.id = e.item_id WHERE i.category_id <> e.category_id`;
check("item_id aponta para item da mesma categoria", mismatch[0].n === 0);
const mismatchT = await sql`SELECT count(*)::int AS n FROM category_template_entry e JOIN item i ON i.id = e.item_id WHERE i.category_id <> e.category_id`;
check("template: item_id aponta para item da mesma categoria", mismatchT[0].n === 0);

// 6) unicidade nova: mesma categoria com 2 itens (2 contas) no mesmo mes e template
const luz = await sql`INSERT INTO item (id, name, category_id, active) VALUES (gen_random_uuid(), 'Luz', ${CASA}, TRUE) RETURNING id`;
await sql`INSERT INTO monthly_plan_entry (id, monthly_plan_id, category_id, account_id, planned, actual, item_id) VALUES (gen_random_uuid(), ${M["2026-03"]}, ${CASA}, ${A1}, 50, 0, ${luz[0].id})`;
check("nova unicidade (plano, item) permite 2 itens da mesma categoria", true);
let dupBlocked = false;
try {
  const casaItem = (await sql`SELECT id FROM item WHERE name = 'Casa'`)[0].id;
  await sql`INSERT INTO monthly_plan_entry (id, monthly_plan_id, category_id, account_id, planned, actual, item_id) VALUES (gen_random_uuid(), ${M["2026-03"]}, ${CASA}, ${AJ}, 1, 0, ${casaItem})`;
} catch (e) { dupBlocked = true; }
check("(plano, item) continua unico", dupBlocked);

// idempotencia
await applyFile("014_items.sql");
const again = JSON.stringify((await snapshotSql()).filter((r) => r.closed));
check("reaplicar 014 e idempotente (meses fechados iguais)", again === closedBefore);
const itemCount = (await sql`SELECT count(*)::int AS n FROM item`)[0].n;
check("reaplicar 014 nao duplica itens", itemCount === 5, `itens=${itemCount}`);

await sql.end();
if (failures.length) { console.error(`\n${failures.length} falha(s).`); process.exitCode = 1; } else console.log("\nTodas as verificacoes passaram.");

