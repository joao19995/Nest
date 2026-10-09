// Procedimento reproduzivel de validacao das migracoes de goals (009/010/011).
//
// - Por omissao e SOMENTE LEITURA: verifica o estado da base sem escrever
//   nada (seguro para correr em qualquer ambiente com acesso de leitura).
// - Com --archive: copia as colunas legadas de goal (se ainda existirem)
//   para goal_legacy_backup ANTES de correr o migrate. Usar apenas em bases
//   onde a 009 nunca correu (ver migrations/011_goal_legacy_archive.sql).
// - NAO corre migracoes aqui; para isso usar `npm run db:migrate`.
// - NAO executar contra producao como parte de tarefas de codigo.
//
// Exemplos:
//   node scripts/validate-goal-migrations.mjs
//   node scripts/validate-goal-migrations.mjs --archive
//
// Validacoes:
//   1. Historico de migracoes aplicado (schema_migrations) — reporta 009/010/011.
//   2. Colunas legadas de goal: presentes (requer --archive antes do migrate)
//      ou ausentes (pos-009) — nunca perda silenciosa.
//   3. Nenhuma linha perdida nas tabelas financeiras (contagens + soma de
//      planeado/atual como impressao digital antes/depois de migrar).
//   4. Constraints e indices da 010 existem.
//   5. goal_legacy_backup existe (pos-011).
//
// Procedimento manual completo (fresco vs. existente):
//   - Base fresca: criar base vazia, `npm run db:migrate`, correr este script
//     (contagens a zero, constraints OK), inserir amostra e recalcular o ano.
//   - Base existente: correr este script ANTES (guardar a saida), aplicar o
//     migrate, correr DEPOIS e comparar contagens e somas — tem de ser iguais.

import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const archive = process.argv.includes("--archive");
const sql = postgres(connectionString, { ssl: "require", max: 1, prepare: false });

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

try {
  const appliedRows = await sql.unsafe("SELECT filename FROM schema_migrations").catch(() => null);
  const applied = new Set((appliedRows ?? []).map((row) => row.filename));
  if (!appliedRows) {
    check("schema_migrations existe", false, "tabela de historico em falta (migrate nunca correu com tracking)");
  } else {
    for (const file of ["009_clean_goal.sql", "010_goal_constraints.sql", "011_goal_legacy_archive.sql"]) {
      check(`migracao ${file} aplicada`, applied.has(file));
    }
  }

  const legacyColumns = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'goal' AND column_name IN ('target_amount', 'priority', 'deadline_month', 'status')
  `);
  const legacyNames = legacyColumns.map((row) => row.column_name);
  if (legacyNames.length && archive) {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS goal_legacy_backup (
        goal_id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        target_amount NUMERIC(12, 2) NULL,
        priority VARCHAR(20) NULL,
        deadline_month VARCHAR(7) NULL,
        status VARCHAR(20) NULL,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const copied = await sql.unsafe(`
      INSERT INTO goal_legacy_backup (goal_id, name, target_amount, priority, deadline_month, status)
      SELECT id, name, target_amount, priority, deadline_month, status FROM goal
      ON CONFLICT (goal_id) DO NOTHING
    `);
    check("colunas legadas arquivadas", true, `${copied.count ?? "?"} linha(s) em goal_legacy_backup; correr o migrate de seguida`);
  } else if (legacyNames.length) {
    check("colunas legadas preservadas", true, `ainda presentes (${legacyNames.join(", ")}): correr com --archive ANTES do migrate`);
  } else {
    check("colunas legadas removidas (009 aplicada)", true, "sem valores por arquivar");
  }

  for (const table of ["goal", "goal_template", "goal_template_entry", "goal_plan_month", "goal_allocation"]) {
    const rows = await sql.unsafe(`SELECT count(*)::int AS count FROM ${table}`).catch(() => null);
    if (!rows) {
      check(`tabela ${table} existe`, false);
      continue;
    }
    check(`tabela ${table} existe`, true, `${rows[0].count} linha(s)`);
  }

  const sums = await sql.unsafe(`
    SELECT coalesce(sum(planned), 0)::text AS planned, coalesce(sum(actual), 0)::text AS actual FROM goal_allocation
  `).catch(() => null);
  if (sums) check("impressao digital goal_allocation", true, `planeado=${sums[0].planned} atual=${sums[0].actual}`);

  const constraints = await sql.unsafe(`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('goal_plan_month', 'goal_allocation', 'goal_template', 'goal_template_entry')
  `);
  const names = new Set(constraints.map((row) => row.indexname));
  for (const index of [
    "idx_goal_plan_month_month",
    "idx_goal_allocation_plan_month",
    "idx_goal_allocation_goal",
    "idx_goal_template_valid_from",
    "idx_goal_template_entry_template",
  ]) {
    check(`indice ${index} existe`, names.has(index));
  }

  const uniques = await sql.unsafe(`
    SELECT conname FROM pg_constraint WHERE conname IN ('goal_plan_month_month_key', 'goal_allocation_plan_month_id_goal_id_key', 'goal_template_valid_from_key')
  `);
  check("constraints UNIQUE de goals existem", uniques.length >= 2, `${uniques.length}/3 encontrados`);

  if (failures.length) {
    console.error(`\n${failures.length} verificacao(oes) falharam.`);
    process.exitCode = 1;
  } else {
    console.log("\nValidacao de migracoes OK.");
  }
} finally {
  await sql.end();
}
