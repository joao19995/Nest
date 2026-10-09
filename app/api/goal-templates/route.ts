import { NextResponse } from "next/server";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { isValidTemplateTotal } from "@/features/goals/domain/goal-template";
import type { GoalTemplateEntry } from "@/features/goals/domain/goal-template";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { buildYearSeeds } from "@/shared/lib/goal-year-planner";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function parseGoalTemplateEntries(value: unknown): { entries: GoalTemplateEntry[] } | { error: string } {
  if (!Array.isArray(value) || !value.length) return { error: "Indica pelo menos um objetivo na tabela." };
  const seen = new Set<string>();
  const entries: GoalTemplateEntry[] = [];
  for (const item of value as { goalId?: unknown; percentage?: unknown }[]) {
    if (!item || typeof item !== "object") return { error: "Linha da tabela inválida." };
    if (typeof item.goalId !== "string" || !isUuid(item.goalId)) return { error: "ID de objetivo inválido." };
    if (typeof item.percentage !== "number" || !Number.isFinite(item.percentage) || item.percentage < 0 || item.percentage > 100) {
      return { error: "Cada percentagem deve estar entre 0 e 100." };
    }
    if (seen.has(item.goalId)) return { error: "O mesmo objetivo não pode aparecer duas vezes." };
    seen.add(item.goalId);
    entries.push({ goalId: item.goalId, percentage: item.percentage });
  }
  if (!isValidTemplateTotal(entries)) return { error: "A tabela tem de somar 100%." };
  return { entries };
}

// Depois de gravar uma versão, pré-calcula o ano: cria os meses em falta e
// recalcula os meses abertos com o template aplicável a cada mês. Os meses
// fechados nunca são tocados (garantido no repositório, na transação).
async function precalculateYear(validFrom: string) {
  const year = Number(validFrom.slice(0, 4));
  const funding = await getYearFunding(year);
  const templates = await goalTemplateRepository.findAll();
  const { seeds } = buildYearSeeds({
    year,
    funding: funding.months.map((item) => ({ month: item.month, available: item.available })),
    templates,
  });
  if (seeds.length) await goalPlanRepository.ensureYearPlansAtomic(year, seeds);
}

export async function GET(request: Request) {
  try {
    const applicableTo = new URL(request.url).searchParams.get("applicableTo");
    if (applicableTo !== null) {
      if (!isValidMonth(applicableTo)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
      return NextResponse.json(await goalTemplateRepository.findApplicable(applicableTo));
    }
    return NextResponse.json(await goalTemplateRepository.findAll());
  } catch (error) {
    console.error("Could not list goal templates.", error);
    return NextResponse.json({ error: "Não foi possível carregar os templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { validFrom?: unknown; annualTotal?: unknown; entries?: unknown };
    if (!isValidMonth(body.validFrom)) return NextResponse.json({ error: "Indica um mês de início válido (YYYY-MM)." }, { status: 400 });
    if (typeof body.annualTotal !== "number" || !Number.isFinite(body.annualTotal) || body.annualTotal < 0) {
      return NextResponse.json({ error: "O valor anual deve ser um número não negativo." }, { status: 400 });
    }
    const parsed = parseGoalTemplateEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (await goalTemplateRepository.findByValidFrom(body.validFrom)) {
      return NextResponse.json({ error: `Já existe um template a partir de ${body.validFrom}. Atualiza esse template.` }, { status: 409 });
    }
    const created = await goalTemplateRepository.create(body.validFrom, body.annualTotal, parsed.entries);
    await precalculateYear(body.validFrom);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Could not create goal template.", error);
    return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });
  }
}
