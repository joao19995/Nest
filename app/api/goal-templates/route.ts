import { NextResponse } from "next/server";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { isValidTemplateTotal } from "@/features/goals/domain/goal-template";
import type { GoalTemplateEntry } from "@/features/goals/domain/goal-template";
import { goalTemplateRepository, GoalTemplateVersionError } from "@/shared/repositories/goal-template-repository";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { goalRepository } from "@/shared/repositories/goal-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { buildTemplateChangeSeeds, previewTemplateChange } from "@/shared/lib/goal-year-planner";
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

/** As entradas só podem referir objetivos ativos (P3: sem reintroduzir inativos). */
function findInactiveEntryGoal(entries: GoalTemplateEntry[], activeGoalIds: Set<string>): GoalTemplateEntry | undefined {
  return entries.find((entry) => !activeGoalIds.has(entry.goalId));
}

function versionErrorResponse(error: unknown) {
  if (error instanceof GoalTemplateVersionError) {
    const status = error.code === "duplicate_valid_from" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return null;
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
    const body = (await request.json()) as { validFrom?: unknown; annualTotal?: unknown; entries?: unknown; dryRun?: unknown };
    if (!isValidMonth(body.validFrom)) return NextResponse.json({ error: "Indica um mês de início válido (YYYY-MM)." }, { status: 400 });
    if (typeof body.annualTotal !== "number" || !Number.isFinite(body.annualTotal) || body.annualTotal < 0) {
      return NextResponse.json({ error: "O valor anual deve ser um número não negativo." }, { status: 400 });
    }
    const parsed = parseGoalTemplateEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const activeGoals = await goalRepository.list();
    const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
    if (findInactiveEntryGoal(parsed.entries, activeGoalIds)) {
      return NextResponse.json({ error: "A tabela refere um objetivo inexistente ou desativado. Reativa o objetivo ou remove-o da tabela." }, { status: 400 });
    }
    if (await goalTemplateRepository.findByValidFrom(body.validFrom)) {
      return NextResponse.json({ error: `Já existe uma versão com efeito a partir de ${body.validFrom}. Se ainda não for usada por nenhum mês, edita-a; senão escolhe outro mês para a nova versão.` }, { status: 409 });
    }

    const year = Number((body.validFrom as string).slice(0, 4));
    const [funding, templates, yearPlans] = await Promise.all([
      getYearFunding(year),
      goalTemplateRepository.findAll(),
      goalPlanRepository.listByYear(year),
    ]);
    const fundingByMonth = new Map(funding.months.map((item) => [item.month, item.available]));
    const storedPlans = yearPlans.map((item) => ({
      planId: item.id,
      month: item.month,
      availableAmount: item.availableAmount,
      closed: item.closed,
      allocations: item.allocations.map((entry) => ({ goalId: entry.goalId, planned: entry.planned })),
    }));
    const effectiveTemplates = [...templates, { id: "pending", validFrom: body.validFrom as string, annualTotal: 0, entries: parsed.entries }];

    // Antevisão só de leitura: valida e mostra o efeito sem escrever nada.
    if (body.dryRun === true) {
      const preview = previewTemplateChange({
        validFrom: body.validFrom as string,
        proposedEntries: parsed.entries,
        storedPlans,
        fundingByMonth,
        templates,
        activeGoalIds,
      });
      return NextResponse.json({ preview: true as const, validFrom: body.validFrom, ...preview });
    }

    // Gravação atómica: versão + pré-cálculo do ano na mesma transação —
    // nunca fica uma versão gravada com os meses por recalcular. As seeds são
    // o mesmo conjunto que o preview mostra (meses abertos >= validFrom mais
    // criações em falta); meses anteriores e fechados nunca são tocados.
    const { seeds } = buildTemplateChangeSeeds({
      year,
      validFrom: body.validFrom as string,
      fundingByMonth,
      storedPlans,
      templates: effectiveTemplates,
      activeGoalIds,
    });
    try {
      const created = await goalTemplateRepository.createWithYearSeeds(
        body.validFrom as string,
        body.annualTotal as number,
        parsed.entries,
        year,
        seeds,
      );
      const plans = await goalPlanRepository.listByYear(year);
      return NextResponse.json({ preview: false as const, template: created, plans }, { status: 201 });
    } catch (error) {
      const mapped = versionErrorResponse(error);
      if (mapped) return mapped;
      throw error;
    }
  } catch (error) {
    console.error("Could not create goal template.", error);
    return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });
  }
}
