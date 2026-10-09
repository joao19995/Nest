// Importação única dos objetivos do Excel para a base de dados.
//
// Atualiza os objetivos EXISTENTES por nome (case-insensitive) com categoria,
// timeline, orçamento-alvo e notas. Idempotente: correr várias vezes produz o
// mesmo resultado (UPDATEs pelos ids encontrados). Nunca cria nem apaga
// objetivos: os nomes que não existirem são apenas listados no fim.
//
// NÃO executar como parte de tarefas de código. Correr manualmente:
//   node scripts/import-goals-excel.mjs
// Requer a migração 013_goal_details.sql aplicada (`npm run db:migrate`).
//
// Dados: Nome | Prioridade | Timeline | Alvo (€) | Notas.

import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");

const sql = postgres(connectionString, { ssl: "require", max: 1, prepare: false });

const PRIORITIES = new Set(["GRANDE", "PEQUENO", "NICE_TO_HAVE"]);
const TIMELINES = new Set(["T1", "T2", "T3", "T4", "ANUAL"]);

const ROWS = [
  { name: "Viagem ao Brasil no Natal", priority: "GRANDE", timeline: "T4", target: 4000, notes: "Família e memórias." },
  { name: "Bustelo (Projecto + Budget)", priority: "GRANDE", timeline: "ANUAL", target: 20000, notes: "Construção do nosso futuro lar." },
  { name: "Comprar Carro Elétrico (Budget)", priority: "GRANDE", timeline: "ANUAL", target: 5530, notes: "O Opel está a dar o berro." },
  { name: "Viagem à Madeira", priority: "PEQUENO", timeline: "T1", target: 800, notes: "Família e memórias." },
  { name: "Acampar na Freita", priority: "PEQUENO", timeline: "T3", target: 50, notes: "Fortalecer a conexão com a natureza, sair da rotina" },
  { name: "Ir spa hotel", priority: "PEQUENO", timeline: "T4", target: 300, notes: "Fortalecer a conexão, sair da rotina" },
  { name: "Freita trekking", priority: "NICE_TO_HAVE", timeline: "T2", target: 50, notes: "Bem-estar, desporto." },
  { name: "Piquenique romântico no parque", priority: "NICE_TO_HAVE", timeline: "T3", target: 50, notes: "Criar um momento especial a dois." },
  { name: "Ter um momento a dois 1x/semana", priority: "NICE_TO_HAVE", timeline: "ANUAL", target: 0, notes: "Fortalecer a conexão" },
];

const missing = [];
const ambiguous = [];
let updated = 0;

try {
  for (const row of ROWS) {
    if (!PRIORITIES.has(row.priority) || !TIMELINES.has(row.timeline) || typeof row.target !== "number" || row.target < 0) {
      console.log(`SKIP  ${row.name} — dados inválidos no script`);
      continue;
    }
    const found = await sql.unsafe("SELECT id, name FROM goal WHERE LOWER(name) = LOWER($1)", [row.name]);
    if (found.length === 0) {
      missing.push(row.name);
      continue;
    }
    if (found.length > 1) {
      ambiguous.push(`${row.name} (${found.length} correspondências)`);
      continue;
    }
    await sql.unsafe(
      "UPDATE goal SET target_amount = $2, priority = $3, timeline = $4, notes = $5 WHERE id = $1",
      [found[0].id, row.target, row.priority, row.timeline, row.notes],
    );
    updated += 1;
    console.log(`OK  ${found[0].name}`);
  }

  console.log(`\nAtualizados: ${updated}/${ROWS.length}`);
  if (missing.length) {
    console.log("Não encontrados (criar manualmente se necessário):");
    for (const name of missing) console.log(`  - ${name}`);
  }
  if (ambiguous.length) {
    console.log("Ambíguos (várias correspondências, ignorados):");
    for (const name of ambiguous) console.log(`  - ${name}`);
  }
  if (missing.length || ambiguous.length) process.exitCode = 1;
} finally {
  await sql.end();
}
