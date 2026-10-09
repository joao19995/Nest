import { NextResponse } from "next/server";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { goalRepository } from "@/shared/repositories/goal-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { computeAdjustRecalc } from "@/shared/lib/goal-year-planner";
import { allocateMonth, AllocationError } from "@/features/goals/domain/allocate-month";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdjustInput = { goalId: string; planned: number };

function parseAllocations(value: unknown): { allocations: AdjustInput[] } | { error: string } {
  if (!Array.isArray(value) || !value.length) return { error: "Indica as alocações do mês." };
  const seen = new Set<string>();
  const allocations: AdjustInput[] = [];
  for (const item of value as { goalId?: unknown; planned?: unknown }[]) {
    if (typeof item?.goalId !== "string" || !isUuid(item.goalId)) return { error: "ID de objetivo inválido." };
    if (typeof item?.planned !== "number" || !Number.isFinite(item.planned) || item.planned < 0) {
      return { error: "Os valores devem ser números não negativos." };
    }
    if (seen.has(item.goalId)) return { error: "O mesmo objetivo não pode aparecer duas vezes." };
    seen.add(item.goalId);
    allocations.push({ goalId: item.goalId, planned: Math.round(item.planned * 100) / 100 });
  }
  return { allocations };
}

/**
 * Ajuste manual de um mês aberto. Com dryRun=true devolve a antevisão das
 * alterações (mês + futuros meses abertos) sem gravar nada. Com
 * dryRun=false (confirmação explícita) grava tudo numa única transação:
 * ou todos os meses são atualizados ou nenhum é.
 *
 * Com fromTemplate=true o planeado do mês é distribuído pela tabela aplicável
 * no servidor (allocateMonth sobre o disponível guardado), em vez de receber
 * as alocações do cliente. Assim cliente e servidor nunca divergem em cêntimos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { month?: unknown; allocations?: unknown; dryRun?: unknown; fromTemplate?: unknown };
    if (!isValidMonth(body.month)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
    const month = body.month;
    const dryRun = body.dryRun === true;

    const plan = await goalPlanRepository.findByMonth(month);
    if (!plan) return NextResponse.json({ error: "Este mês ainda não foi criado." }, { status: 404 });
    if (plan.closed) return NextResponse.json({ error: "Mês fechado — apenas leitura." }, { status: 409 });

    let allocations: AdjustInput[];
    if (body.fromTemplate === true) {
      const template = await goalTemplateRepository.findApplicable(month);
      try {
        allocations = allocateMonth({ availableAmount: plan.availableAmount, entries: template?.entries ?? [] }).allocations;
      } catch (error) {
        if (error instanceof AllocationError) return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
      }
    } else {
      const parsed = parseAllocations(body.allocations);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      allocations = parsed.allocations;
    }

    const totalCents = Math.round(allocations.reduce((sum, item) => sum + item.planned, 0) * 100);
    const availableCents = Math.round(plan.availableAmount * 100);
    if (totalCents !== availableCents) {
      const diff = (plan.availableAmount - totalCents / 100).toFixed(2);
      return NextResponse.json(
        { error: `A soma das alocações tem de igualar o disponível (${diff} € por distribuir).` },
        { status: 400 },
      );
    }

    const year = Number(month.slice(0, 4));
    const [funding, templates, yearPlans, activeGoals] = await Promise.all([
      getYearFunding(year),
      goalTemplateRepository.findAll(),
      goalPlanRepository.listByYear(year),
      goalRepository.list(),
    ]);

    // O mês ajustado fica exatamente como o utilizador definiu; os futuros
    // meses abertos são recalculados com o template aplicável a cada mês.
    const { toApply, futureChanges, missingMonths, closedSkipped, invalidMonths } = computeAdjustRecalc({
      targetMonth: month,
      targetAvailable: plan.availableAmount,
      targetAllocations: allocations,
      storedPlans: yearPlans.map((item) => ({
        planId: item.id,
        month: item.month,
        availableAmount: item.availableAmount,
        closed: item.closed,
        allocations: item.allocations.map((entry) => ({ goalId: entry.goalId, planned: entry.planned })),
      })),
      fundingByMonth: new Map(funding.months.map((item) => [item.month, item.available])),
      templates,
      activeGoalIds: new Set(activeGoals.map((goal) => goal.id)),
    });

    if (dryRun) {
      return NextResponse.json({
        preview: true as const,
        month,
        availableAmount: plan.availableAmount,
        newAllocations: allocations,
        futureChanges,
        missingMonths,
        closedSkipped,
        invalidMonths,
      });
    }

    try {
      await goalPlanRepository.applyMonthsAtomic(toApply);
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause) {
        const code = (cause as { code: string }).code;
        if (code === "closed") return NextResponse.json({ error: "Um dos meses foi fechado entretanto. Recarrega e tenta de novo." }, { status: 409 });
        if (code === "invalid_total") return NextResponse.json({ error: "A soma das alocações deixou de igualar o disponível. Recarrega e tenta de novo." }, { status: 400 });
        return NextResponse.json({ error: "Mês não encontrado." }, { status: 404 });
      }
      throw cause;
    }
    const plans = await goalPlanRepository.listByYear(year);
    return NextResponse.json({ preview: false as const, plans, futureChanges, missingMonths, closedSkipped, invalidMonths });
  } catch (error) {
    console.error("Could not adjust goal month.", error);
    return NextResponse.json({ error: "Não foi possível ajustar o mês." }, { status: 500 });
  }
}
